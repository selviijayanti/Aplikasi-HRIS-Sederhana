import { collection, doc, getDocs, updateDoc, query, where, setDoc } from "firebase/firestore";
import { db } from "./config";
import { deduplicateAuditLogs } from "./audit-service";
import absensiSeedData from "../../../data/seeds/absensi.json";
import profilesData from "../../../data/seeds/profiles.json";
import pengajuanCutiSeed from "../../../data/seeds/pengajuan_cuti.json";
import { AuthUser } from "../auth/auth-context";
import { formatWIBDateString } from "../utils/time";

export const ABSENSI_STORE_KEY = "karsahr_absensi_store";
export const AUDIT_LOG_STORE_KEY = "karsahr_audit_log_store";

export const DIVISION_CODE_MAP: Record<string, string> = {
  SLS: "Penjualan",
  OPS: "Operasional Gudang",
  HR: "Human Resources",
  FIN: "Keuangan",
};

let cachedAttendanceProfiles: any[] | null = null;
let lastFetchAttendanceProfilesTime = 0;

/**
 * Format kode divisi menjadi nama divisi resmi (contoh: SLS -> Penjualan)
 */
export function formatDivisionName(divisiRaw?: string | null, profileDivisi?: string | null): string {
  if (divisiRaw) {
    const upper = divisiRaw.trim().toUpperCase();
    if (DIVISION_CODE_MAP[upper]) return DIVISION_CODE_MAP[upper];
    if (divisiRaw.trim().length > 0) return divisiRaw.trim();
  }
  if (profileDivisi) {
    const upper = profileDivisi.trim().toUpperCase();
    if (DIVISION_CODE_MAP[upper]) return DIVISION_CODE_MAP[upper];
    if (profileDivisi.trim().length > 0) return profileDivisi.trim();
  }
  return "Operasional Gudang";
}

export interface AttendanceRecord {
  id: string;
  karyawan_id: string;
  tanggal: string;
  jam_masuk?: string | null;
  jam_pulang?: string | null;
  status: string;
  dikoreksi_oleh?: string | null;
  alasan_koreksi?: string | null;
  "nama (bantu)"?: string | null;
  "divisi (bantu)"?: string | null;
  nik_karyawan?: string | null;
  catatan?: string | null;
  [key: string]: any;
}

export interface AttendanceQueryFilter {
  date?: string;
  month?: string; // YYYY-MM
  divisionId?: string;
  status?: string;
  viewScope?: "personal" | "team" | "company";
}

export interface AttendanceCorrectionPayload {
  jamMasuk: string;
  jamPulang: string | null;
  status: "hadir" | "terlambat";
  alasanKoreksi: string;
}

/**
 * Mendapatkan seluruh master profiles untuk relasi profil & divisi
 */
export function getProfilesMap() {
  const map = new Map<string, { nik: string; nama: string; divisi: string; divisi_id: string }>();
  (profilesData as Array<any>).forEach((p) => {
    const fullDiv = formatDivisionName(p["divisi (bantu)"], p["divisi (bantu)"]);
    map.set(p.id, {
      nik: p.nik_karyawan,
      nama: p.nama_lengkap,
      divisi: fullDiv,
      divisi_id: p.divisi_id,
    });
  });
  return map;
}

/**
 * Mengambil master data absensi dari localStorage (dengan fallback seed JSON)
 */
export function getRawAttendanceStore(): AttendanceRecord[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ABSENSI_STORE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Gagal membaca storage absensi:", e);
    }
  }
  return absensiSeedData as AttendanceRecord[];
}

/**
 * Menyimpan data absensi ke localStorage
 */
export function persistAttendanceStore(data: AttendanceRecord[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ABSENSI_STORE_KEY, JSON.stringify(data));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("Gagal menyimpan data absensi:", e);
    }
  }
}

/**
 * Mencatat log audit ke localStorage & Firestore
 */
export async function recordAuditLog(entry: {
  pelakuId: string;
  pelakuNama: string;
  aksi: string;
  namaTabel: string;
  dataId: string;
  nilaiSebelum: any;
  nilaiSesudah: any;
}) {
  const auditEntry = {
    id: "audit-absensi-" + Date.now(),
    pelaku_id: entry.pelakuId,
    "pelaku (bantu)": entry.pelakuNama,
    aksi: entry.aksi,
    nama_tabel: entry.namaTabel,
    data_id: entry.dataId,
    nilai_sebelum: JSON.stringify(entry.nilaiSebelum),
    nilai_sesudah: JSON.stringify(entry.nilaiSesudah),
    dibuat_pada: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(AUDIT_LOG_STORE_KEY);
      const list = stored ? JSON.parse(stored) : [];
      const cleanList = deduplicateAuditLogs([auditEntry, ...list]);
      localStorage.setItem(AUDIT_LOG_STORE_KEY, JSON.stringify(cleanList));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.warn("Gagal simpan audit log ke storage:", e);
    }
  }

  try {
    await setDoc(doc(db, "audit_log", auditEntry.id), auditEntry);
  } catch (err) {
    // Silent fail jika Firestore offline/unauthenticated
  }
}

/**
 * QUERY SERVICE DENGAN PENEGAKAN RBAC KETAT DI SISI QUERY / BACKEND:
 * 1. Karyawan: Terkunci HANYA data miliknya sendiri (WHERE karyawan_id = user.id / seed_id).
 * 2. Atasan: Tab 'Tim Divisi' terkunci HANYA data divisi miliknya (WHERE divisi_id = user.divisi_id).
 * 3. HRD: Akses penuh seluruh perusahaan dengan filter divisi bebas.
 */
export async function fetchAttendanceRecords(
  user: AuthUser,
  filter: AttendanceQueryFilter
): Promise<AttendanceRecord[]> {
  if (!user) {
    throw new Error("Autentikasi diperlukan untuk mengakses data absensi.");
  }

  const allRecords = getRawAttendanceStore();
  const profileMap = getProfilesMap();
  const currentUserId = user.seed_id || user.id;

  // Helper filter absensi pribadi menyeluruh
  const matchPersonalAttendance = (a: AttendanceRecord) => {
    if (user.id && (a.karyawan_id === user.id || a.id?.includes(user.id))) return true;
    if (user.seed_id && a.karyawan_id === user.seed_id) return true;
    if (user.nik_karyawan && (a.nik_karyawan === user.nik_karyawan || (a as any).nik === user.nik_karyawan)) return true;
    if (user.nama_lengkap && a["nama (bantu)"]?.toLowerCase()?.trim() === user.nama_lengkap.toLowerCase().trim()) return true;
    return false;
  };

  // 1. ROLE KARYAWAN: Hak akses terkunci mutlak ke data pribadi (WHERE karyawan_id = current_user.id)
  if (user.peran === "karyawan") {
    let personalList = allRecords.filter(matchPersonalAttendance);

    // Filter bulan jika disediakan (YYYY-MM)
    if (filter.month && filter.month !== "Semua") {
      personalList = personalList.filter((a) => a.tanggal.startsWith(filter.month!));
    }

    return personalList.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }

  // 2. ROLE ATASAN: Memiliki dua scope (Pribadi & Tim Divisinya)
  if (user.peran === "atasan") {
    if (filter.viewScope === "personal") {
      let personalList = allRecords.filter(matchPersonalAttendance);
      if (filter.month && filter.month !== "Semua") {
        personalList = personalList.filter((a) => a.tanggal.startsWith(filter.month!));
      }
      return personalList.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    }

    // Tab "Tim Divisi": Wajib saring HANYA anggota divisinya (Atasan DILARANG melihat divisi lain)
    const atasanProfile = (profilesData as Array<any>).find(
      (p) =>
        p.id === user.id ||
        p.id === user.seed_id ||
        p.email?.toLowerCase() === user.email?.toLowerCase()
    );
    const atasanDivisiId = atasanProfile?.divisi_id || user.divisi_id;
    const atasanDivisiNama = formatDivisionName(
      atasanProfile?.["divisi (bantu)"],
      user.divisi_nama
    );
    const targetDate = filter.date || formatWIBDateString(new Date());

    // 1. Ambil data profil dari Firestore / seed dengan deduplikasi ketat per user (email / NIK)
    let allProfiles = profilesData as Array<any>;
    const nowTime = Date.now();
    if (cachedAttendanceProfiles && (nowTime - lastFetchAttendanceProfilesTime < 60000)) {
      allProfiles = cachedAttendanceProfiles;
    } else {
      try {
        const profSnap = await getDocs(collection(db, "profiles"));
        if (!profSnap.empty) {
          const fsProfiles: any[] = [];
          profSnap.forEach((d) => fsProfiles.push({ id: d.id, ...d.data() }));
          if (fsProfiles.length > 0) {
            const pMap = new Map<string, any>();
            profilesData.forEach((p: any) => {
              const key = (p.email || p.nik_karyawan || p.nama_lengkap || p.id).toLowerCase();
              pMap.set(key, { ...p });
            });
            fsProfiles.forEach((p: any) => {
              const key = (p.email || p.nik_karyawan || p.nama_lengkap || p.id).toLowerCase();
              const existing = pMap.get(key) || {};
              pMap.set(key, { ...existing, ...p, uid: p.id, id: existing.id || p.id });
            });
            allProfiles = Array.from(pMap.values());
            cachedAttendanceProfiles = allProfiles;
            lastFetchAttendanceProfilesTime = Date.now();
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    // 2. Filter dan deduplikasi seluruh anggota aktif divisi Atasan (tepat sesuai divisi Atasan)
    const divMemberMap = new Map<string, any>();
    allProfiles.forEach((p) => {
      if (p.aktif === false) return;
      const memberDivName = formatDivisionName(p["divisi (bantu)"], p["divisi (bantu)"]);
      const isDivMatch =
        (atasanDivisiId && p.divisi_id === atasanDivisiId) ||
        memberDivName.toLowerCase() === atasanDivisiNama.toLowerCase();

      if (isDivMatch) {
        const key = (p.nik_karyawan || p.email || p.nama_lengkap || p.id).toLowerCase();
        if (!divMemberMap.has(key)) {
          divMemberMap.set(key, p);
        }
      }
    });
    const divisionMembers = Array.from(divMemberMap.values());

    // 3. Ambil log absensi dari Firestore / store
    let recordsStore = allRecords;
    try {
      const qAbs = query(collection(db, "absensi"), where("tanggal", "==", targetDate));
      const absSnap = await getDocs(qAbs);
      if (!absSnap.empty) {
        const fsAbs: any[] = [];
        absSnap.forEach((d) => fsAbs.push({ id: d.id, ...d.data() }));
        const existingMap = new Map();
        recordsStore.forEach((r) => existingMap.set(r.id, r));
        fsAbs.forEach((r) => existingMap.set(r.id, { ...(existingMap.get(r.id) || {}), ...r }));
        recordsStore = Array.from(existingMap.values());
      }
    } catch (e) {
      // Fallback
    }

    // 4. Ambil pengajuan cuti/izin aktif pada tanggal tersebut dari Firestore / seed
    let leavesList: any[] = pengajuanCutiSeed as any[];
    try {
      const cutiSnap = await getDocs(collection(db, "pengajuan_cuti"));
      if (!cutiSnap.empty) {
        const fsCuti: any[] = [];
        cutiSnap.forEach((d) => fsCuti.push({ id: d.id, ...d.data() }));
        if (fsCuti.length > 0) {
          leavesList = fsCuti;
        }
      }
    } catch (e) {
      // Fallback
    }

    // 5. Merging data: pastikan seluruh anggota aktif divisi muncul (5 orang)
    let teamList: AttendanceRecord[] = divisionMembers.map((member) => {
      const existingRecord = recordsStore.find(
        (a) =>
          a.tanggal === targetDate &&
          (a.karyawan_id === member.id ||
            a.karyawan_id === member.uid ||
            a.karyawan_id === member.seed_id ||
            (a["nama (bantu)"] && a["nama (bantu)"].toLowerCase() === member.nama_lengkap.toLowerCase()))
      );

      const fullDivName = formatDivisionName(member["divisi (bantu)"], atasanDivisiNama);

      if (existingRecord) {
        return {
          ...existingRecord,
          nik_karyawan: member.nik_karyawan,
          "nama (bantu)": existingRecord["nama (bantu)"] || member.nama_lengkap,
          "divisi (bantu)": fullDivName,
        };
      }

      // Periksa apakah sedang cuti/izin pada tanggal tersebut
      const approvedLeave = leavesList.find((c) => {
        const isMatchUser =
          c.karyawan_id === member.id ||
          c.karyawan_id === member.uid ||
          (c["pemohon (bantu)"] && c["pemohon (bantu)"].toLowerCase() === member.nama_lengkap.toLowerCase());
        const isApproved = c.status === "disetujui";
        const inDateRange = c.tanggal_mulai <= targetDate && targetDate <= c.tanggal_selesai;
        return isMatchUser && isApproved && inDateRange;
      });

      if (approvedLeave) {
        const leaveStatus =
          approvedLeave.jenis === "cuti_tahunan"
            ? "Cuti"
            : approvedLeave.jenis === "izin_sakit"
            ? "Sakit"
            : "Izin";
        return {
          id: `cuti-${member.id}-${targetDate}`,
          karyawan_id: member.id,
          tanggal: targetDate,
          jam_masuk: null,
          jam_pulang: null,
          status: leaveStatus,
          "nama (bantu)": member.nama_lengkap,
          "divisi (bantu)": fullDivName,
          nik_karyawan: member.nik_karyawan,
          alasan_koreksi: approvedLeave.alasan,
          catatan: approvedLeave.alasan || `Cuti/Izin ${leaveStatus}`,
        };
      }

      // Belum check-in dan tidak sedang cuti: Tanpa Keterangan
      return {
        id: `tanpa-keterangan-${member.id}-${targetDate}`,
        karyawan_id: member.id,
        tanggal: targetDate,
        jam_masuk: null,
        jam_pulang: null,
        status: "Tanpa Keterangan",
        "nama (bantu)": member.nama_lengkap,
        "divisi (bantu)": fullDivName,
        nik_karyawan: member.nik_karyawan,
        catatan: "-",
      };
    });

    // Deduplikasi ketat pada teamList agar 1 karyawan hanya memiliki tepat 1 baris
    const uniqueTeamMap = new Map<string, AttendanceRecord>();
    teamList.forEach((rec) => {
      const key = (rec.nik_karyawan || rec["nama (bantu)"] || rec.karyawan_id).trim().toLowerCase();
      if (!uniqueTeamMap.has(key)) {
        uniqueTeamMap.set(key, rec);
      }
    });
    teamList = Array.from(uniqueTeamMap.values());

    if (filter.status && filter.status !== "Semua") {
      const st = filter.status.toLowerCase();
      teamList = teamList.filter((a) => {
        const itemStatus = (a.status || "").toLowerCase();
        if (st === "hadir") return itemStatus === "hadir";
        if (st === "terlambat") return itemStatus === "terlambat";
        if (st === "sakit" || st.includes("cuti")) return ["sakit", "cuti", "izin"].includes(itemStatus);
        if (st.includes("tanpa") || st.includes("belum")) return itemStatus.includes("tanpa") || itemStatus.includes("belum");
        return itemStatus === st;
      });
    }

    return teamList.sort((a, b) => {
      return (a["nama (bantu)"] || "").localeCompare(b["nama (bantu)"] || "");
    });
  }

  // 3. ROLE HRD: Rekap seluruh perusahaan dengan filter tanggal, divisi, dan status
  if (user.peran === "hrd") {
    let companyList = [...allRecords];

    if (filter.viewScope === "personal") {
      companyList = companyList.filter(matchPersonalAttendance);
      if (filter.month && filter.month !== "Semua") {
        companyList = companyList.filter((a) => a.tanggal.startsWith(filter.month!));
      }
      return companyList.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    }

    if (filter.date) {
      companyList = companyList.filter((a) => a.tanggal === filter.date);
    }

    if (filter.divisionId && filter.divisionId !== "Semua") {
      const targetDiv = filter.divisionId.toLowerCase();
      companyList = companyList.filter((a) => {
        const p = profileMap.get(a.karyawan_id);
        const divName = a["divisi (bantu)"] || p?.divisi;
        return (
          p?.divisi_id === filter.divisionId ||
          divName?.toLowerCase() === targetDiv
        );
      });
    }

    if (filter.status && filter.status !== "Semua") {
      companyList = companyList.filter(
        (a) => a.status.toLowerCase() === filter.status!.toLowerCase()
      );
    }

    return companyList;
  }

  return [];
}

/**
 * MUTATION SERVICE DENGAN ATURAN BISNIS BR-03:
 * Hanya HRD yang dapat mengoreksi absensi, dengan alasan wajib minimal 10 karakter.
 */
export async function executeAttendanceCorrection(
  user: AuthUser,
  recordId: string,
  payload: AttendanceCorrectionPayload
): Promise<AttendanceRecord> {
  // Validasi RBAC
  if (!user || user.peran !== "hrd") {
    throw new Error(
      "Akses ditolak: Hanya pengguna dengan peran HRD yang memiliki wewenang mengoreksi absensi."
    );
  }

  // Validasi Panjang Karakter Alasan Koreksi
  if (!payload.alasanKoreksi || payload.alasanKoreksi.trim().length < 10) {
    throw new Error(
      "Alasan koreksi bersifat wajib dan harus minimal 10 karakter."
    );
  }

  const allRecords = getRawAttendanceStore();
  const existing = allRecords.find((a) => a.id === recordId);
  if (!existing) {
    throw new Error("Data absensi tidak ditemukan.");
  }

  const dateOfRow = existing.tanggal;
  const newJamMasukIso = `${dateOfRow}T${payload.jamMasuk}:00+07:00`;
  const newJamPulangIso = payload.jamPulang ? `${dateOfRow}T${payload.jamPulang}:00+07:00` : null;

  const hrdProfileId = user.seed_id || user.id || "391a65a7-cf37-5806-8e65-bba91e3c42e4";
  const hrdNama = user.nama_lengkap || "Rina Kusumawardani";

  // Catat Audit Log
  await recordAuditLog({
    pelakuId: hrdProfileId,
    pelakuNama: hrdNama,
    aksi: "absensi_koreksi",
    namaTabel: "absensi",
    dataId: recordId,
    nilaiSebelum: {
      jam_masuk: existing.jam_masuk,
      jam_pulang: existing.jam_pulang,
      status: existing.status,
    },
    nilaiSesudah: {
      jam_masuk: newJamMasukIso,
      jam_pulang: newJamPulangIso,
      status: payload.status,
      alasan_koreksi: payload.alasanKoreksi.trim(),
      dikoreksi_oleh: hrdProfileId,
    },
  });

  const updatedRecord: AttendanceRecord = {
    ...existing,
    jam_masuk: newJamMasukIso,
    jam_pulang: newJamPulangIso,
    status: payload.status,
    dikoreksi_oleh: hrdProfileId,
    alasan_koreksi: payload.alasanKoreksi.trim(),
  };

  const updatedList = allRecords.map((item) => (item.id === recordId ? updatedRecord : item));
  persistAttendanceStore(updatedList);

  // Sync ke Firestore jika online
  try {
    const docRef = doc(db, "absensi", recordId);
    await updateDoc(docRef, {
      jam_masuk: newJamMasukIso,
      jam_pulang: newJamPulangIso,
      status: payload.status,
      dikoreksi_oleh: hrdProfileId,
      alasan_koreksi: payload.alasanKoreksi.trim(),
    });
  } catch (err) {
    // Fallback gracefully jika Firestore document belum terindeks
  }

  return updatedRecord;
}
