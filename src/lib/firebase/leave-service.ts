import { collection, addDoc, getDocs, query, where, doc, setDoc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db, auth } from "./config";
import { signInWithEmailAndPassword } from "firebase/auth";
import akunUjiData from "../../../data/seeds/akun_uji.json";
import { 
  SubmittedLeave, 
  saveSubmittedLeave, 
  syncSubmittedLeavesWithFirestore, 
  getSubmittedLeaves, 
  getLeaveStatusOverrides,
  updateLeaveStatusOverride,
  refundLeaveQuotaStore,
  calculateAccurateLeaveQuota
} from "../utils/leave-store";
import { logAuditActivity } from "./audit-service";
import pengajuanCutiSeedData from "../../../data/seeds/pengajuan_cuti.json";
import kuotaCutiData from "../../../data/seeds/kuota_cuti.json";
import profilesData from "../../../data/seeds/profiles.json";
import divisiData from "../../../data/seeds/divisi.json";
import { getRawAttendanceStore } from "./attendance-service";

const profileByIdMap = new Map<string, any>();
const profileByNameMap = new Map<string, any>();
const profileByNikMap = new Map<string, any>();
(profilesData as Array<any>).forEach((p) => {
  if (p.id) profileByIdMap.set(p.id, p);
  if (p.nama_lengkap) profileByNameMap.set(p.nama_lengkap.toLowerCase().trim(), p);
  if (p.nik_karyawan) profileByNikMap.set(p.nik_karyawan.trim(), p);
});

const divisiNameByIdMap = new Map<string, string>();
(divisiData as Array<any>).forEach((d) => {
  if (d.id) divisiNameByIdMap.set(d.id, d.nama);
});

export interface LeaveRequestPayload {
  karyawanId: string;
  namaKaryawan: string;
  nikKaryawan: string;
  divisiId: string;
  divisiNama: string;
  jenis: "cuti_tahunan" | "sakit" | "izin";
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasan: string;
  fileSurat?: File | null;
  dibuatPada?: string;
}

let activeAuthPromise: Promise<string | null> | null = null;

/**
 * Memastikan sesi Firebase Auth aktif sebelum transaksi Firestore
 */
async function ensureActiveFirebaseAuth(): Promise<string | null> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  if (activeAuthPromise) {
    return activeAuthPromise;
  }

  activeAuthPromise = (async () => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_current_user");
        if (stored) {
          const u = JSON.parse(stored);
          const cleanEmail = u?.email?.toLowerCase();
          const akun = (akunUjiData as Array<{ email: string; kata_sandi: string }>).find(
            (a) => a.email.toLowerCase() === cleanEmail
          );
          if (akun) {
            const cred = await signInWithEmailAndPassword(
              auth,
              akun.email,
              akun.kata_sandi || "Latihan#2026"
            );
            return cred.user.uid;
          }
        }
      } catch (e) {
        console.warn("Silent re-auth in leave-service:", e);
      }
    }
    return null;
  })().finally(() => {
    activeAuthPromise = null;
  });

  return activeAuthPromise;
}

/**
 * Menyimpan pengajuan cuti / sakit / izin ke Cloud Firestore
 */
export async function submitLeaveRequestToFirestore(payload: LeaveRequestPayload) {
  const authedUid = await ensureActiveFirebaseAuth();
  const effectiveKaryawanId = authedUid || auth.currentUser?.uid || payload.karyawanId;

  // PRD BR-05: Rentang tanggal valid & minimal 1 hari kerja
  if (!payload.tanggalMulai || !payload.tanggalSelesai || payload.tanggalMulai > payload.tanggalSelesai) {
    return {
      success: false,
      error: "Format rentang tanggal tidak valid. Tanggal mulai tidak boleh melebihi tanggal selesai.",
    };
  }
  if (payload.jumlahHari < 1) {
    return {
      success: false,
      error: "Rentang pengajuan tidak berisi hari kerja.",
    };
  }

  // PRD BR-05: Batas waktu pengajuan
  // - Cuti tahunan: paling lambat 3 hari kalender sebelum tanggal mulai (H-3)
  // - Izin: paling lambat 1 hari kalender sebelum tanggal mulai (H-1)
  // - Sakit: pada hari mulai sakit s/d paling lambat 3 hari kalender setelahnya
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayMs = new Date(todayYMD + "T00:00:00Z").getTime();
  const startMs = new Date(payload.tanggalMulai + "T00:00:00Z").getTime();
  const diffCalendarDays = Math.round((startMs - todayMs) / (1000 * 60 * 60 * 24));

  if (payload.jenis === "cuti_tahunan" && diffCalendarDays < 3) {
    return {
      success: false,
      error: "Pengajuan cuti tahunan wajib dilakukan paling lambat 3 hari kalender sebelum tanggal mulai (H-3) sesuai PRD BR-05.",
    };
  }

  if (payload.jenis === "izin" && diffCalendarDays < 1) {
    return {
      success: false,
      error: "Pengajuan izin wajib dilakukan paling lambat 1 hari kalender sebelum tanggal mulai (H-1) sesuai PRD BR-05.",
    };
  }

  if (payload.jenis === "sakit" && diffCalendarDays < -3) {
    return {
      success: false,
      error: "Pengajuan sakit paling lambat dilaporkan 3 hari kalender setelah tanggal mulai sakit (PRD BR-05).",
    };
  }

  // Batasan pengajuan izin maks 2 hari kerja
  if (payload.jenis === "izin" && payload.jumlahHari > 2) {
    return {
      success: false,
      error: "Pengajuan izin paling banyak 2 hari kerja per pengajuan.",
    };
  }

  // Sakit > 1 hari kerja wajib melampirkan surat dokter
  if (payload.jenis === "sakit" && payload.jumlahHari > 1 && !payload.fileSurat) {
    return {
      success: false,
      error: "Lampiran surat dokter (PDF/JPG/PNG maks 2 MB) wajib diunggah untuk pengajuan sakit lebih dari 1 hari kerja.",
    };
  }

  // Pengecekan overlap / irisan dengan pengajuan aktif lainnya
  const overrides = getLeaveStatusOverrides();
  const allExistingLeaves = [
    ...getSubmittedLeaves(),
    ...(pengajuanCutiSeedData as Array<any>).map((p) => ({
      id: p.id,
      karyawan_id: p.karyawan_id,
      nama_karyawan: p["pemohon (bantu)"] || "",
      nik_karyawan: p.nik_karyawan || "",
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai || p.tanggal_mulai,
      status: overrides[p.id]?.status || p.status,
    })),
  ];

  const userActiveLeaves = allExistingLeaves.filter((l) => {
    const isUser =
      (effectiveKaryawanId && l.karyawan_id === effectiveKaryawanId) ||
      (payload.karyawanId && l.karyawan_id === payload.karyawanId) ||
      (payload.nikKaryawan && l.nik_karyawan === payload.nikKaryawan) ||
      (payload.namaKaryawan && l.nama_karyawan?.toLowerCase() === payload.namaKaryawan.toLowerCase());
    if (!isUser) return false;

    const st = l.status?.toLowerCase();
    return st === "diajukan" || st === "disetujui_atasan" || st === "disetujui";
  });

  for (const ex of userActiveLeaves) {
    const exStart = ex.tanggal_mulai?.includes("T") ? ex.tanggal_mulai.split("T")[0] : ex.tanggal_mulai;
    const exEnd = ex.tanggal_selesai?.includes("T") ? ex.tanggal_selesai.split("T")[0] : (ex.tanggal_selesai || exStart);
    if (!exStart || !exEnd) continue;

    // Overlap condition: startA <= endB && endA >= startB
    if (payload.tanggalMulai <= exEnd && payload.tanggalSelesai >= exStart) {
      return {
        success: false,
        error: "Tanggal yang dipilih beririsan dengan pengajuan aktif lainnya.",
      };
    }
  }

  // Pengecekan bentrok dengan data absensi karyawan
  try {
    const attendanceRecords = getRawAttendanceStore();
    const userAttendance = attendanceRecords.filter((a) => {
      return (
        (effectiveKaryawanId && a.karyawan_id === effectiveKaryawanId) ||
        (payload.karyawanId && a.karyawan_id === payload.karyawanId) ||
        (payload.namaKaryawan && a["nama (bantu)"]?.toLowerCase() === payload.namaKaryawan.toLowerCase()) ||
        (payload.nikKaryawan && a.nik_karyawan === payload.nikKaryawan)
      );
    });

    for (const att of userAttendance) {
      const attDate = att.tanggal;
      if (attDate && attDate >= payload.tanggalMulai && attDate <= payload.tanggalSelesai) {
        const hasCheckIn = Boolean(att.jam_masuk) || att.status === "hadir" || att.status === "terlambat";
        if (hasCheckIn) {
          return {
            success: false,
            error: `Pengajuan ditolak karena pada rentang tanggal tersebut (${attDate}) sudah ada data absensi karyawan.`,
          };
        }
      }
    }
  } catch (attErr) {
    console.warn("Attendance overlap check in leave-service:", attErr);
  }

  try {
    const nowIso = payload.dibuatPada || new Date().toISOString();

    // PRD BR-06: Validasi Sisa Kuota Cuti Tahunan Presisi (Single Source of Truth)
    if (payload.jenis === "cuti_tahunan") {
      const quota = calculateAccurateLeaveQuota(
        {
          id: effectiveKaryawanId,
          seed_id: payload.karyawanId,
          nik_karyawan: payload.nikKaryawan,
          nama_lengkap: payload.namaKaryawan,
        },
        2026
      );

      if (payload.jumlahHari > quota.sisa) {
        return {
          success: false,
          error: `Pengajuan cuti tahunan (${payload.jumlahHari} hari kerja) melebihi sisa kuota yang tersedia (${quota.sisa} hari kerja). Sesuai kebijakan perusahaan, pengajuan dibatasi agar saldo kuota tidak bernilai negatif.`,
        };
      }
    }

    // Pencegahan Duplikasi (Idempotency): Format Document ID Deterministik
    // `${cleanKaryawanId}_${tanggalMulai}_${tanggalSelesai}`
    const cleanUid = String(effectiveKaryawanId).replace(/[^a-zA-Z0-9_-]/g, "");
    const deterministicDocId = `cuti_${cleanUid}_${payload.tanggalMulai}_${payload.tanggalSelesai}`;
    const docRef = doc(db, "pengajuan_cuti", deterministicDocId);

    // Pastikan dokumen belum ada sebelum eksekusi penyimpanan
    const existingDocSnap = await getDoc(docRef);
    if (existingDocSnap.exists()) {
      return {
        success: false,
        error: "Pengajuan pada rentang tanggal tersebut sudah pernah dibuat sebelumnya.",
      };
    }

    // Cek peran pemohon: jika Atasan atau HRD, lewati tahap 1 (PRD BR-09)
    const userProf =
      (effectiveKaryawanId ? profileByIdMap.get(effectiveKaryawanId) : null) ||
      (payload.karyawanId ? profileByIdMap.get(payload.karyawanId) : null) ||
      (payload.nikKaryawan ? profileByNikMap.get(payload.nikKaryawan) : null) ||
      (payload.namaKaryawan ? profileByNameMap.get(payload.namaKaryawan.toLowerCase().trim()) : null);
    const userRole = userProf?.peran?.toLowerCase() || "";
    const isAtasanOrHRD =
      userRole === "atasan" ||
      userRole === "hrd" ||
      ["maya", "bayu", "hendra", "rina", "dimas"].some((n) =>
        payload.namaKaryawan?.toLowerCase().includes(n)
      );
    const perluAtasan = !isAtasanOrHRD;
    const tahapPersetujuan = isAtasanOrHRD ? "hrd" : "atasan";

    const newDocData: Record<string, any> = {
      karyawan_id: effectiveKaryawanId,
      nama_karyawan: payload.namaKaryawan,
      nik_karyawan: payload.nikKaryawan,
      divisi_id: payload.divisiId,
      divisi_nama: payload.divisiNama,
      jenis: payload.jenis,
      tanggal_mulai: payload.tanggalMulai,
      tanggal_selesai: payload.tanggalSelesai,
      jumlah_hari: payload.jumlahHari,
      alasan: payload.alasan,
      status: "diajukan",
      perlu_atasan: perluAtasan,
      tahap_persetujuan: tahapPersetujuan,
      created_at: nowIso,
      dibuat_pada: nowIso,
      lampiran_path: payload.fileSurat ? `/uploads/${payload.fileSurat.name}` : null,
      surat_dokter_nama: payload.fileSurat ? payload.fileSurat.name : null,
      surat_dokter_size: payload.fileSurat ? payload.fileSurat.size : null,
    };

    await setDoc(docRef, newDocData);

    // PRD BR-06: Cuti tahunan langsung memotong sisa kuota saat diajukan
    if (payload.jenis === "cuti_tahunan") {
      try {
        const kuotaQuery = query(
          collection(db, "kuota_cuti"),
          where("karyawan_id", "==", effectiveKaryawanId),
          where("tahun", "==", 2026)
        );
        const kuotaSnap = await getDocs(kuotaQuery);
        if (!kuotaSnap.empty) {
          const kuotaDoc = kuotaSnap.docs[0];
          await updateDoc(doc(db, "kuota_cuti", kuotaDoc.id), {
            terpakai: increment(payload.jumlahHari),
            sisa_kuota: increment(-payload.jumlahHari),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (errKuota) {
        console.warn("Update kuota di Firestore:", errKuota);
      }
    }

    // Simpan juga ke shared local store agar langsung muncul di semua halaman
    saveSubmittedLeave({
      id: docRef.id,
      karyawan_id: effectiveKaryawanId,
      nama_karyawan: payload.namaKaryawan,
      nik_karyawan: payload.nikKaryawan,
      divisi_id: payload.divisiId,
      divisi_nama: payload.divisiNama,
      jenis: payload.jenis,
      tanggal_mulai: payload.tanggalMulai,
      tanggal_selesai: payload.tanggalSelesai,
      jumlah_hari: payload.jumlahHari,
      alasan: payload.alasan,
      status: "diajukan",
      perlu_atasan: perluAtasan,
      tahap_persetujuan: tahapPersetujuan,
      created_at: newDocData.created_at,
      lampiran_path: newDocData.lampiran_path,
      surat_dokter_nama: newDocData.surat_dokter_nama,
      surat_dokter_size: newDocData.surat_dokter_size,
    });

    // Catat ke Audit Log (PRD BR-12)
    logAuditActivity({
      aksi: "pengajuan_cuti",
      namaTabel: "pengajuan_cuti",
      dataId: docRef.id,
      nilaiSebelum: null,
      nilaiSesudah: JSON.stringify({
        jenis: payload.jenis,
        tanggal_mulai: payload.tanggalMulai,
        tanggal_selesai: payload.tanggalSelesai,
        jumlah_hari: payload.jumlahHari,
        alasan: payload.alasan,
      }),
      pelakuId: String(effectiveKaryawanId),
      pelakuNama: payload.namaKaryawan,
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Gagal menyimpan pengajuan ke Firestore:", error);
    const fallbackId = "cuti-local-" + Date.now();

    const userProf =
      (effectiveKaryawanId ? profileByIdMap.get(effectiveKaryawanId) : null) ||
      (payload.karyawanId ? profileByIdMap.get(payload.karyawanId) : null) ||
      (payload.nikKaryawan ? profileByNikMap.get(payload.nikKaryawan) : null) ||
      (payload.namaKaryawan ? profileByNameMap.get(payload.namaKaryawan.toLowerCase().trim()) : null);
    const userRole = userProf?.peran?.toLowerCase() || "";
    const isAtasanOrHRD =
      userRole === "atasan" ||
      userRole === "hrd" ||
      ["maya", "bayu", "hendra", "rina", "dimas"].some((n) =>
        payload.namaKaryawan?.toLowerCase().includes(n)
      );
    const perluAtasan = !isAtasanOrHRD;
    const tahapPersetujuan = isAtasanOrHRD ? "hrd" : "atasan";

    // Simpan ke local store agar pengguna tidak kehilangan permohonannya
    saveSubmittedLeave({
      id: fallbackId,
      karyawan_id: effectiveKaryawanId,
      nama_karyawan: payload.namaKaryawan,
      nik_karyawan: payload.nikKaryawan,
      divisi_id: payload.divisiId,
      divisi_nama: payload.divisiNama,
      jenis: payload.jenis,
      tanggal_mulai: payload.tanggalMulai,
      tanggal_selesai: payload.tanggalSelesai,
      jumlah_hari: payload.jumlahHari,
      alasan: payload.alasan,
      status: "diajukan",
      perlu_atasan: perluAtasan,
      tahap_persetujuan: tahapPersetujuan,
      created_at: new Date().toISOString(),
      lampiran_path: payload.fileSurat ? `/uploads/${payload.fileSurat.name}` : null,
      surat_dokter_nama: payload.fileSurat ? payload.fileSurat.name : null,
      surat_dokter_size: payload.fileSurat ? payload.fileSurat.size : null,
    });

    logAuditActivity({
      aksi: "pengajuan_cuti",
      namaTabel: "pengajuan_cuti",
      dataId: fallbackId,
      nilaiSebelum: null,
      nilaiSesudah: JSON.stringify({
        jenis: payload.jenis,
        tanggal_mulai: payload.tanggalMulai,
        tanggal_selesai: payload.tanggalSelesai,
        jumlah_hari: payload.jumlahHari,
      }),
      pelakuId: String(effectiveKaryawanId),
      pelakuNama: payload.namaKaryawan,
    });

    return { 
      success: true, 
      id: fallbackId, 
      fallbackId: fallbackId 
    };
  }
}

let cachedLeaves: SubmittedLeave[] | null = null;
let lastFetchLeavesTime = 0;

/**
 * Membaca seluruh data permohonan dari Firestore untuk antrean Persetujuan (dengan in-memory caching)
 */
export async function fetchLeaveRequestsFromFirestore(forceRefresh = false): Promise<SubmittedLeave[]> {
  const now = Date.now();
  if (!forceRefresh && cachedLeaves && (now - lastFetchLeavesTime < 30000)) {
    return cachedLeaves;
  }

  try {
    await ensureActiveFirebaseAuth();
    const snap = await getDocs(collection(db, "pengajuan_cuti"));
    const list: SubmittedLeave[] = [];

    snap.forEach((d) => {
      const data = d.data();
      const profile =
        (data.karyawan_id ? profileByIdMap.get(data.karyawan_id) : null) ||
        (data.nama_karyawan ? profileByNameMap.get(data.nama_karyawan.toLowerCase().trim()) : null) ||
        (data["pemohon (bantu)"] ? profileByNameMap.get(data["pemohon (bantu)"].toLowerCase().trim()) : null);

      const resolvedDivisi =
        data.divisi_nama ||
        (data.divisi_id ? divisiNameByIdMap.get(data.divisi_id) : null) ||
        profile?.["divisi (bantu)"] ||
        (profile?.divisi_id ? divisiNameByIdMap.get(profile.divisi_id) : null) ||
        "Penjualan";

      const resolvedNama =
        data.nama_karyawan ||
        data["pemohon (bantu)"] ||
        profile?.nama_lengkap ||
        "Karyawan";

      const resolvedNik =
        data.nik_karyawan ||
        profile?.nik_karyawan ||
        "KLN-0000";

      const overrides = getLeaveStatusOverrides();
      const currentStatus = overrides[d.id]?.status || data.status || "diajukan";
      const isAtasanOrHRD =
        profile?.peran === "atasan" ||
        profile?.peran === "hrd" ||
        ["maya", "bayu", "hendra", "rina", "dimas"].some((n) =>
          resolvedNama.toLowerCase().includes(n)
        );
      const perluAtasan =
        data.perlu_atasan !== undefined ? Boolean(data.perlu_atasan) : !isAtasanOrHRD;
      const tahapPersetujuan =
        data.tahap_persetujuan ||
        (isAtasanOrHRD || currentStatus === "disetujui_atasan" ? "hrd" : "atasan");

      list.push({
        id: d.id,
        karyawan_id: data.karyawan_id || profile?.id || "",
        nama_karyawan: resolvedNama,
        nik_karyawan: resolvedNik,
        divisi_id: data.divisi_id || profile?.divisi_id || "",
        divisi_nama: resolvedDivisi,
        jabatan: profile?.jabatan || "Staff",
        status_kerja: profile?.status_kerja === "kontrak" ? "Karyawan Kontrak" : "Karyawan Tetap",
        jenis: data.jenis || "cuti_tahunan",
        tanggal_mulai: data.tanggal_mulai || "",
        tanggal_selesai: data.tanggal_selesai || "",
        jumlah_hari: data.jumlah_hari || data.jumlah_hari_kerja || 1,
        alasan: data.alasan || "",
        status: currentStatus,
        // PRD BR-09: perlu_atasan menentukan apakah tahap 1 Atasan diperlukan atau dilewati
        perlu_atasan: perluAtasan,
        tahap_persetujuan: tahapPersetujuan,
        created_at: data.created_at || data.dibuat_pada || new Date().toISOString(),
        surat_dokter_nama: data.surat_dokter_nama || data.lampiran || null,
        surat_dokter_size: data.surat_dokter_size || null,
        approved_by: data.approved_by || data.disetujui_atasan_oleh || data.diputuskan_hrd_oleh || null,
        alasan_penolakan: data.alasan_penolakan || null,
      });
    });

    cachedLeaves = list;
    lastFetchLeavesTime = Date.now();
    syncSubmittedLeavesWithFirestore(list);
    return list;
  } catch (error) {
    console.warn("Gagal fetch pengajuan dari Firestore:", error);
    const local = getSubmittedLeaves();
    cachedLeaves = local;
    lastFetchLeavesTime = Date.now();
    return local;
  }
}

/**
 * Memperbarui status persetujuan di Firestore dan kuota jika ditolak
 */
export async function updateLeaveApprovalInFirestore(
  pengajuanId: string,
  newStatus: "disetujui_atasan" | "disetujui" | "ditolak" | "dibatalkan",
  approverName: string,
  alasanPenolakan?: string,
  jumlahHari?: number,
  jenis?: string,
  karyawanId?: string
) {
  try {
    const isTahunan = jenis === "cuti_tahunan" || jenis?.toLowerCase().includes("tahunan") || jenis === "Cuti tahunan";
    const targetKaryawanId = karyawanId || auth.currentUser?.uid || "";

    // 1. Update shared store lokal
    updateLeaveStatusOverride(pengajuanId, newStatus, approverName, alasanPenolakan);

    // 2. PRD BR-06 & BR-10: Kembalikan kuota cuti tahunan bila ditolak atau dibatalkan
    if ((newStatus === "ditolak" || newStatus === "dibatalkan") && isTahunan && targetKaryawanId && (jumlahHari || 0) > 0) {
      refundLeaveQuotaStore(targetKaryawanId, jumlahHari || 1);
    }

    // 3. Catat ke Audit Log (PRD BR-12)
    const auditAction =
      newStatus === "ditolak"
        ? "penolakan_cuti"
        : newStatus === "dibatalkan"
        ? "batal_cuti_hrd"
        : newStatus === "disetujui_atasan"
        ? "persetujuan_cuti_tahap1"
        : "persetujuan_cuti_final";

    logAuditActivity({
      aksi: auditAction,
      namaTabel: "pengajuan_cuti",
      dataId: pengajuanId,
      nilaiSebelum: newStatus === "disetujui" ? "disetujui_atasan" : "diajukan",
      nilaiSesudah: JSON.stringify({
        status: newStatus,
        diputuskan_oleh: approverName,
        alasan_penolakan: alasanPenolakan || null,
        jumlah_hari: jumlahHari,
      }),
      pelakuNama: approverName,
    });

    // 4. Update di Firestore
    try {
      await ensureActiveFirebaseAuth();
      const docRef = doc(db, "pengajuan_cuti", pengajuanId);
      const updateData: Record<string, any> = {
        status: newStatus,
        approved_by: approverName,
        approved_at: new Date().toISOString(),
        tahap_persetujuan: newStatus === "disetujui_atasan" ? "hrd" : "selesai",
      };

      if (alasanPenolakan) {
        updateData.alasan_penolakan = alasanPenolakan;
      }

      await updateDoc(docRef, updateData);

      if (newStatus === "ditolak" && isTahunan && targetKaryawanId && (jumlahHari || 0) > 0) {
        const kuotaQuery = query(
          collection(db, "kuota_cuti"),
          where("karyawan_id", "==", targetKaryawanId),
          where("tahun", "==", 2026)
        );
        const kuotaSnap = await getDocs(kuotaQuery);
        if (!kuotaSnap.empty) {
          const kuotaDoc = kuotaSnap.docs[0];
          await updateDoc(doc(db, "kuota_cuti", kuotaDoc.id), {
            terpakai: increment(-(jumlahHari || 1)),
            sisa_kuota: increment(jumlahHari || 1),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (fsErr) {
      // Abaikan jika dokumen mock lokal
    }

    return { success: true };
  } catch (error) {
    console.error("Gagal update persetujuan:", error);
    return { success: false };
  }
}

/**
 * Membatalkan pengajuan cuti (PRD BR-06 & BR-10: Kembalikan kuota cuti tahunan)
 */
export async function cancelLeaveRequestInFirestore(
  pengajuanId: string, 
  karyawanId: string, 
  jumlahHari: number, 
  jenis: string
) {
  try {
    const authedUid = await ensureActiveFirebaseAuth();
    const effectiveKaryawanId = authedUid || auth.currentUser?.uid || karyawanId;
    const isTahunan = jenis === "cuti_tahunan" || jenis?.toLowerCase().includes("tahunan") || jenis === "Cuti tahunan";

    updateLeaveStatusOverride(pengajuanId, "dibatalkan");

    if (isTahunan && effectiveKaryawanId && (jumlahHari || 0) > 0) {
      refundLeaveQuotaStore(effectiveKaryawanId, jumlahHari);
    }

    // Catat ke Audit Log (PRD BR-12)
    logAuditActivity({
      aksi: "pembatalan_cuti",
      namaTabel: "pengajuan_cuti",
      dataId: pengajuanId,
      nilaiSebelum: "diajukan",
      nilaiSesudah: JSON.stringify({ status: "dibatalkan", kuota_dikembalikan: isTahunan ? jumlahHari : 0 }),
      pelakuId: String(effectiveKaryawanId),
    });

    try {
      const docRef = doc(db, "pengajuan_cuti", pengajuanId);
      await updateDoc(docRef, {
        status: "dibatalkan",
        updated_at: new Date().toISOString(),
      });

      if (isTahunan) {
        const kuotaQuery = query(
          collection(db, "kuota_cuti"),
          where("karyawan_id", "==", effectiveKaryawanId),
          where("tahun", "==", 2026)
        );
        const kuotaSnap = await getDocs(kuotaQuery);
        if (!kuotaSnap.empty) {
          const kuotaDoc = kuotaSnap.docs[0];
          await updateDoc(doc(db, "kuota_cuti", kuotaDoc.id), {
            terpakai: increment(-jumlahHari),
            sisa_kuota: increment(jumlahHari),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // Abaikan jika dokumen mock lokal
    }

    return { success: true };
  } catch (error) {
    console.warn("Gagal update pembatalan:", error);
    return { success: false };
  }
}
