"use client";

import kuotaCutiData from "../../../data/seeds/kuota_cuti.json";
import pengajuanCutiData from "../../../data/seeds/pengajuan_cuti.json";

// Shared Leave Status & Submissions Store untuk sinkronisasi menyeluruh antar halaman
// (Dashboard, Cuti, dan Persetujuan)
const STATUS_STORE_KEY = "karsahr_leave_status_overrides";
const SUBMISSIONS_STORE_KEY = "karsahr_submitted_leaves";

export interface StatusOverride {
  status: "diajukan" | "disetujui_atasan" | "disetujui" | "ditolak" | "dibatalkan";
  approvedBy?: string;
  approvedAt?: string;
  alasanPenolakan?: string;
}

export interface SubmittedLeave {
  id: string;
  karyawan_id: string;
  nama_karyawan: string;
  nik_karyawan: string;
  divisi_id: string;
  divisi_nama: string;
  jabatan?: string;
  status_kerja?: string;
  jenis: "cuti_tahunan" | "sakit" | "izin";
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  alasan: string;
  status: "diajukan" | "disetujui_atasan" | "disetujui" | "ditolak" | "dibatalkan";
  tahap_persetujuan: "atasan" | "hrd" | "selesai";
  perlu_atasan?: boolean;
  created_at: string;
  lampiran_path?: string | null;
  surat_dokter_nama?: string | null;
  surat_dokter_size?: number | null;
  approved_by?: string;
  alasan_penolakan?: string;
}

export function getLeaveStatusOverrides(): Record<string, StatusOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STATUS_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const LEAVE_ID_ALIASES: Record<string, string> = {
  "cuti-01": "feaf39cf-e72b-5830-bb52-efe413bc1c55",
  "feaf39cf-e72b-5830-bb52-efe413bc1c55": "cuti-01",
};

export function updateLeaveStatusOverride(
  id: string,
  newStatus: "diajukan" | "disetujui_atasan" | "disetujui" | "ditolak" | "dibatalkan",
  approvedBy?: string,
  alasanPenolakan?: string
) {
  if (typeof window === "undefined") return;
  try {
    const current = getLeaveStatusOverrides();
    const entry: StatusOverride = {
      status: newStatus,
      approvedBy,
      approvedAt: new Date().toISOString(),
      alasanPenolakan,
    };

    current[id] = entry;

    // Sinkronisasi ID alias (misal mock 'cuti-01' dengan UUID asli seed Andi Wijaya)
    const aliasId = LEAVE_ID_ALIASES[id];
    if (aliasId) {
      current[aliasId] = entry;
    }

    localStorage.setItem(STATUS_STORE_KEY, JSON.stringify(current));

    // Update juga di daftar submissions jika ada
    const list = getSubmittedLeaves();
    const updatedList = list.map((item) => {
      if (item.id === id || (aliasId && item.id === aliasId)) {
        return {
          ...item,
          status: newStatus,
          approved_by: approvedBy || item.approved_by,
          alasan_penolakan: alasanPenolakan || item.alasan_penolakan,
          tahap_persetujuan: (newStatus === "disetujui_atasan" ? "hrd" : "selesai") as "atasan" | "hrd" | "selesai",
        };
      }
      return item;
    });
    localStorage.setItem(SUBMISSIONS_STORE_KEY, JSON.stringify(updatedList));

    // Trigger storage event for cross-component re-renders
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("Gagal update status pengajuan", e);
  }
}

import profilesData from "../../../data/seeds/profiles.json";

/**
 * Mengembalikan kuota cuti tahunan di localStorage (PRD BR-06 & BR-10)
 * Sinkronisasi idempotent dengan calculateAccurateLeaveQuota agar tidak pernah terjadi pengurangan ganda (double-refund).
 */
export function refundLeaveQuotaStore(karyawanId: string, _jumlahHari?: number) {
  if (typeof window === "undefined" || !karyawanId) return;
  try {
    const profile = (profilesData as any[]).find(
      (p) =>
        p.id === karyawanId ||
        p.nik_karyawan === karyawanId ||
        p.nama_lengkap?.toLowerCase() === karyawanId?.toLowerCase()
    );

    const accurate = calculateAccurateLeaveQuota(
      {
        id: karyawanId,
        seed_id: profile?.id,
        nik_karyawan: profile?.nik_karyawan,
        nama_lengkap: profile?.nama_lengkap || karyawanId,
      },
      2026
    );

    const raw = localStorage.getItem("karsahr_kuota_cuti_store");
    const list = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(kuotaCutiData));
    if (Array.isArray(list)) {
      let changed = false;
      const updated = list.map((item: any) => {
        const match =
          item.karyawan_id === karyawanId ||
          (profile && item.karyawan_id === profile.id) ||
          (profile && item.nik_karyawan === profile.nik_karyawan) ||
          (profile && item["nama (bantu)"]?.toLowerCase() === profile.nama_lengkap?.toLowerCase()) ||
          (karyawanId.toLowerCase().includes("siti") && item["nama (bantu)"]?.toLowerCase().includes("siti")) ||
          (karyawanId.toLowerCase().includes("andi") && item["nama (bantu)"]?.toLowerCase().includes("andi"));

        if (match && Number(item.tahun) === 2026) {
          changed = true;
          return {
            ...item,
            jatah_hari: accurate.jatahHari,
            terpakai_hari: accurate.terpakai,
            terpakai: accurate.terpakai,
            sisa_kuota: accurate.sisa,
            sisa: accurate.sisa,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem("karsahr_kuota_cuti_store", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      }
    }
  } catch (err) {
    console.warn("Gagal refund kuota di local store:", err);
  }
}

export function getSubmittedLeaves(): SubmittedLeave[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSubmittedLeave(leave: SubmittedLeave) {
  if (typeof window === "undefined") return;
  try {
    const list = getSubmittedLeaves();
    const existingIndex = list.findIndex((item) => item.id === leave.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...leave };
    } else {
      list.unshift(leave);
    }
    localStorage.setItem(SUBMISSIONS_STORE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("Gagal menyimpan submission lokal", e);
  }
}

export function syncSubmittedLeavesWithFirestore(firestoreLeaves: SubmittedLeave[]) {
  if (typeof window === "undefined") return;
  try {
    const localList = getSubmittedLeaves();
    const map = new Map<string, SubmittedLeave>();

    // 1. Masukkan data lokal terlebih dahulu
    localList.forEach((item) => map.set(item.id, item));

    // 2. Gabungkan dengan data terbaru dari Firestore
    firestoreLeaves.forEach((item) => map.set(item.id, item));

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    localStorage.setItem(SUBMISSIONS_STORE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.warn("Gagal sinkronisasi data permohonan:", e);
  }
}

export interface AccurateLeaveQuota {
  jatahHari: number;
  terpakai: number;
  sisa: number;
}

/**
 * Single Source of Truth untuk perhitungan kuota cuti tahunan presisi
 * Sesuai aturan PRD BR-04 & BR-06:
 * - Jatah per tahun (default 12 hari atau sesuai pengaturan HRD)
 * - Baseline terpakai awal tahun 2026 diambil dari kuotaCutiData
 * - Pengajuan cuti baru aktif (diajukan, disetujui_atasan, disetujui) memotong kuota
 * - Pengajuan ditolak dan dibatalkan TIDAK memotong kuota
 * - Pengembalian kuota cuti (refund) terhitung persis 1 banding 1 secara idempotent
 */
export function calculateAccurateLeaveQuota(
  userQuery: {
    id?: string;
    seed_id?: string;
    nik_karyawan?: string;
    nama_lengkap?: string;
  },
  targetYear: number = 2026,
  explicitOverrides?: Record<string, any>,
  explicitSubmitted?: any[]
): AccurateLeaveQuota {
  const uid = userQuery.id;
  const seedId = userQuery.seed_id;
  const nik = userQuery.nik_karyawan;
  const nama = userQuery.nama_lengkap?.toLowerCase()?.trim();

  // 1. Master jatah dan baseline terpakai dari kuotaCutiData / karsahr_kuota_cuti_store
  let masterJatah = 12;
  let baseTerpakai = 0;

  try {
    const rawCustom = typeof window !== "undefined" ? localStorage.getItem("karsahr_kuota_cuti_store") : null;
    const customList = rawCustom ? JSON.parse(rawCustom) : null;

    // Cari di kuotaCutiData (seed baseline resmi 2026)
    const seedRec = (kuotaCutiData as Array<any>).find((k: any) => {
      const yr = Number(k.tahun);
      if (yr !== targetYear) return false;
      if (uid && (k.karyawan_id === uid || k.karyawan_id === seedId)) return true;
      if (seedId && k.karyawan_id === seedId) return true;
      if (nik && k.nik_karyawan === nik) return true;
      if (nama && k["nama (bantu)"]?.toLowerCase()?.trim() === nama) return true;
      return false;
    });

    if (seedRec) {
      masterJatah = Number(seedRec.jatah_hari ?? seedRec.jatah ?? 12);
      baseTerpakai = Number(seedRec.terpakai_hari ?? seedRec.terpakai ?? 0);
    }

    // Jika HRD pernah mengubah jatah_hari di menu Pengaturan, gunakan jatah_hari terbaru
    if (Array.isArray(customList)) {
      const customRec = customList.find((k: any) => {
        const yr = Number(k.tahun);
        if (yr !== targetYear) return false;
        if (uid && (k.karyawan_id === uid || k.karyawan_id === seedId)) return true;
        if (seedId && k.karyawan_id === seedId) return true;
        if (nik && k.nik_karyawan === nik) return true;
        if (nama && k["nama (bantu)"]?.toLowerCase()?.trim() === nama) return true;
        return false;
      });
      if (customRec && customRec.jatah_hari !== undefined) {
        masterJatah = Number(customRec.jatah_hari);
      }
    }
  } catch {}

  const overrides = explicitOverrides || getLeaveStatusOverrides();
  const submitted = explicitSubmitted || getSubmittedLeaves();

  // 2. Cek apakah ada pengajuan seed bawaan (sebelum 15 Okt 2026) yang dibatalkan / ditolak
  let cancelledSeedDays = 0;
  const userSeeds = (pengajuanCutiData as Array<any>).filter((p) => {
    if (uid && (p.karyawan_id === uid || p.karyawan_id === seedId)) return true;
    if (seedId && p.karyawan_id === seedId) return true;
    if (nik && p.nik_karyawan === nik) return true;
    if (nama && p["pemohon (bantu)"]?.toLowerCase()?.trim() === nama) return true;
    return false;
  });

  userSeeds.forEach((item) => {
    const sMulai = item.tanggal_mulai?.split("T")[0];
    if (!sMulai || !sMulai.startsWith(String(targetYear))) return;
    if (item.jenis !== "cuti_tahunan") return;

    const aliasId = item.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : undefined;
    const currentStatus = (overrides[item.id]?.status || (aliasId && overrides[aliasId]?.status) || item.status || "disetujui").toLowerCase();
    if (currentStatus === "dibatalkan" || currentStatus === "ditolak") {
      cancelledSeedDays += Number(item.jumlah_hari) || 1;
    }
  });

  // 3. Hitung hari kerja dari pengajuan baru di aplikasi (submitted leaves)
  let activeSubmittedDays = 0;
  const userSubmitted = submitted.filter((s) => {
    if (uid && (s.karyawan_id === uid || s.karyawan_id === seedId)) return true;
    if (seedId && s.karyawan_id === seedId) return true;
    if (nik && s.nik_karyawan === nik) return true;
    if (nama && s.nama_karyawan?.toLowerCase()?.trim() === nama) return true;
    return false;
  });

  userSubmitted.forEach((item) => {
    const sMulai = item.tanggal_mulai?.split("T")[0];
    if (!sMulai || !sMulai.startsWith(String(targetYear))) return;
    const isTahunan = item.jenis === "cuti_tahunan" || item.jenis?.toLowerCase().includes("tahunan") || item.jenis === "Cuti tahunan";
    if (!isTahunan) return;

    const currentStatus = (overrides[item.id]?.status || item.status || "diajukan").toLowerCase();
    if (currentStatus === "diajukan" || currentStatus === "disetujui_atasan" || currentStatus === "disetujui") {
      activeSubmittedDays += Number(item.jumlah_hari) || 1;
    }
  });

  const terpakai = Math.min(masterJatah, Math.max(0, baseTerpakai - cancelledSeedDays + activeSubmittedDays));
  const sisa = Math.max(0, masterJatah - terpakai);

  return {
    jatahHari: masterJatah,
    terpakai,
    sisa,
  };
}
