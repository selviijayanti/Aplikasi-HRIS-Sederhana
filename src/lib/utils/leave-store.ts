"use client";

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

export function updateLeaveStatusOverride(
  id: string,
  newStatus: "diajukan" | "disetujui_atasan" | "disetujui" | "ditolak" | "dibatalkan",
  approvedBy?: string,
  alasanPenolakan?: string
) {
  if (typeof window === "undefined") return;
  try {
    const current = getLeaveStatusOverrides();
    current[id] = {
      status: newStatus,
      approvedBy,
      approvedAt: new Date().toISOString(),
      alasanPenolakan,
    };
    localStorage.setItem(STATUS_STORE_KEY, JSON.stringify(current));

    // Update juga di daftar submissions jika ada
    const list = getSubmittedLeaves();
    const updatedList = list.map((item) => {
      if (item.id === id) {
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
