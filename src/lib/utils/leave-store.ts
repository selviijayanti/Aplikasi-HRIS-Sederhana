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
 */
export function refundLeaveQuotaStore(karyawanId: string, jumlahHari: number) {
  if (typeof window === "undefined" || !karyawanId || jumlahHari <= 0) return;
  try {
    const profile = (profilesData as any[]).find(
      (p) =>
        p.id === karyawanId ||
        p.nik_karyawan === karyawanId ||
        p.nama_lengkap?.toLowerCase() === karyawanId?.toLowerCase()
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
          const currentTerpakai = Number(item.terpakai_hari ?? item.terpakai ?? 0);
          const jatah = Number(item.jatah_hari ?? item.jatah ?? 12);
          const newTerpakai = Math.max(0, currentTerpakai - jumlahHari);
          const newSisa = Math.max(0, jatah - newTerpakai);
          return {
            ...item,
            terpakai_hari: newTerpakai,
            terpakai: newTerpakai,
            sisa_kuota: newSisa,
            sisa: newSisa,
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
 * - Jatah per tahun (default 12 hari)
 * - Hanya cuti tahunan aktif (diajukan, disetujui_atasan, disetujui) yang memotong kuota
 * - Ditolak dan dibatalkan TIDAK memotong kuota
 * - Dilakukan deduplikasi ketat agar tidak ada double counting
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
  const nama = userQuery.nama_lengkap?.toLowerCase();

  // 1. Master jatah kuota dari karsahr_kuota_cuti_store atau kuotaCutiData
  let masterJatah = 12;
  try {
    const list = (() => {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("karsahr_kuota_cuti_store");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      return kuotaCutiData as Array<any>;
    })();

    const qRec = list.find((k: any) => {
      const yr = Number(k.tahun);
      if (yr !== targetYear) return false;
      if (uid && (k.karyawan_id === uid || k.karyawan_id === seedId)) return true;
      if (seedId && k.karyawan_id === seedId) return true;
      if (nik && k.nik_karyawan === nik) return true;
      if (nama && k["nama (bantu)"]?.toLowerCase() === nama) return true;
      return false;
    });

    if (qRec) {
      masterJatah = Number(qRec.jatah_hari ?? qRec.jatah ?? 12);
    }
  } catch {}

  // 2. Kumpulkan seluruh permohonan cuti milik user dengan deduplikasi
  const overrides = explicitOverrides || getLeaveStatusOverrides();
  const submitted = explicitSubmitted || getSubmittedLeaves();

  const userSeeds = (pengajuanCutiData as Array<any>).filter((p) => {
    if (uid && (p.karyawan_id === uid || p.karyawan_id === seedId)) return true;
    if (seedId && p.karyawan_id === seedId) return true;
    if (nik && p.nik_karyawan === nik) return true;
    if (nama && p["pemohon (bantu)"]?.toLowerCase() === nama) return true;
    return false;
  });

  const userSubmitted = submitted.filter((s) => {
    if (uid && (s.karyawan_id === uid || s.karyawan_id === seedId)) return true;
    if (seedId && s.karyawan_id === seedId) return true;
    if (nik && s.nik_karyawan === nik) return true;
    if (nama && s.nama_karyawan?.toLowerCase() === nama) return true;
    return false;
  });

  const uniqueLeaves = new Map<string, { jumlah_hari: number; status: string }>();

  // Masukkan dari seeds
  userSeeds.forEach((item) => {
    const sMulai = item.tanggal_mulai?.split("T")[0];
    const sSelesai = (item.tanggal_selesai || item.tanggal_mulai)?.split("T")[0];
    if (!sMulai || !sMulai.startsWith(String(targetYear))) return;
    if (item.jenis !== "cuti_tahunan") return;

    const rangeKey = `${sMulai}_${sSelesai}`;
    const aliasId = item.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : undefined;
    const currentStatus = (overrides[item.id]?.status || (aliasId && overrides[aliasId]?.status) || item.status || "diajukan").toLowerCase();

    uniqueLeaves.set(rangeKey, {
      jumlah_hari: Number(item.jumlah_hari) || 1,
      status: currentStatus,
    });
  });

  // Masukkan dari submitted
  userSubmitted.forEach((item) => {
    const sMulai = item.tanggal_mulai?.split("T")[0];
    const sSelesai = (item.tanggal_selesai || item.tanggal_mulai)?.split("T")[0];
    if (!sMulai || !sMulai.startsWith(String(targetYear))) return;
    const isTahunan = item.jenis === "cuti_tahunan" || item.jenis?.toLowerCase().includes("tahunan");
    if (!isTahunan) return;

    const rangeKey = `${sMulai}_${sSelesai}`;
    const currentStatus = (overrides[item.id]?.status || item.status || "diajukan").toLowerCase();

    uniqueLeaves.set(rangeKey, {
      jumlah_hari: Number(item.jumlah_hari) || 1,
      status: currentStatus,
    });
  });

  // 3. Hitung hari kerja aktif (diajukan, disetujui_atasan, disetujui)
  let totalTerpakai = 0;
  uniqueLeaves.forEach((val) => {
    if (val.status === "diajukan" || val.status === "disetujui_atasan" || val.status === "disetujui") {
      totalTerpakai += val.jumlah_hari;
    }
  });

  const terpakai = Math.min(masterJatah, Math.max(0, totalTerpakai));
  const sisa = Math.max(0, masterJatah - terpakai);

  return {
    jatahHari: masterJatah,
    terpakai,
    sisa,
  };
}
