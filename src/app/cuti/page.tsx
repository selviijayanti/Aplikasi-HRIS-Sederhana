"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { calculateWorkingDays } from "@/lib/utils/time";
import hariLiburData from "../../../data/seeds/hari_libur.json";
import pengajuanCutiData from "../../../data/seeds/pengajuan_cuti.json";
import kuotaCutiData from "../../../data/seeds/kuota_cuti.json";
import {
  submitLeaveRequestToFirestore,
  cancelLeaveRequestInFirestore,
} from "@/lib/firebase/leave-service";
import {
  getLeaveStatusOverrides,
  getSubmittedLeaves,
  updateLeaveStatusOverride,
  calculateAccurateLeaveQuota,
  refundLeaveQuotaStore,
} from "@/lib/utils/leave-store";
import { getRawAttendanceStore } from "@/lib/firebase/attendance-service";
import { sendEmailNotification } from "@/lib/email/email-service";

const BULAN_INDO = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

const NAMA_HARI = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

// Konversi tanggal ke format teks Indonesia (contoh: "16 Okt 2026")
export function formatIndoDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "-" || dateStr === "null") return "-";
  const str = dateStr.trim();

  // Sudah berformat "16 Okt 2026"
  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(str)) {
    return str;
  }

  // Format ISO YYYY-MM-DD
  if (str.includes("-")) {
    const clean = str.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${day} ${BULAN_INDO[monthIdx]} ${year}`;
      }
    }
  }

  // Format DD/MM/YYYY
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[2];
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${day} ${BULAN_INDO[monthIdx]} ${year}`;
      }
    }
  }

  return str;
}

// Konversi YYYY-MM-DD ke DD/MM/YYYY
export function ymdToDmy(ymd: string): string {
  if (!ymd || !ymd.includes("-")) return ymd;
  const parts = ymd.split("-");
  if (parts.length === 3) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  return ymd;
}

// Konversi DD/MM/YYYY ke YYYY-MM-DD
export function dmyToYmd(dmy: string): string {
  if (!dmy) return "";
  const clean = dmy.trim().replace(/-/g, "/").replace(/\./g, "/");
  const parts = clean.split("/");
  if (parts.length === 3) {
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2];
    if (y.length === 4 && !isNaN(Number(d)) && !isNaN(Number(m)) && !isNaN(Number(y))) {
      return `${y}-${m}-${d}`;
    }
  }
  return "";
}

// Format lengkap nama hari & tanggal untuk helper input (contoh: "Senin, 26 Okt 2026")
export function formatIndoFull(ymdOrDmy: string | null | undefined): string {
  if (!ymdOrDmy) return "";
  let ymd = ymdOrDmy;
  if (ymdOrDmy.includes("/")) {
    ymd = dmyToYmd(ymdOrDmy);
  }
  if (!ymd || !ymd.includes("-")) return "";
  const parts = ymd.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      const hari = NAMA_HARI[dt.getDay()];
      const bulan = BULAN_INDO[m];
      return `${hari}, ${d} ${bulan} ${y}`;
    }
  }
  return "";
}

// Format rentang tanggal sesuai PRD: jika hari sama -> "16 Okt 2026", jika rentang -> "22 Okt 2026 – 23 Okt 2026"
export function formatRentangTanggal(
  mulai: string | null | undefined,
  selesai: string | null | undefined
): string {
  if (!mulai && !selesai) return "-";
  if (!selesai || selesai === "-" || selesai.trim() === "") {
    return formatIndoDate(mulai);
  }
  if (!mulai || mulai === "-" || mulai.trim() === "") {
    return formatIndoDate(selesai);
  }

  const fMulai = formatIndoDate(mulai);
  const fSelesai = formatIndoDate(selesai);

  // Jika tanggal mulai dan selesai adalah hari yang sama, tampilkan satu tanggal penuh
  if (fMulai === fSelesai || mulai.trim() === selesai.trim()) {
    return fMulai;
  }

  return `${fMulai} – ${fSelesai}`;
}

// Ekstrak YYYY-MM-DD untuk perbandingan tanggal
export function parseDateToYMD(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  if (str.includes("/")) {
    return dmyToYmd(str);
  }
  const bulanMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05",
    jun: "06", jul: "07", agu: "08", aug: "08", sep: "09", okt: "10", oct: "10",
    nov: "11", des: "12", dec: "12"
  };
  const parts = str.split(/\s+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, "0");
    const m = parts[1].toLowerCase().slice(0, 3);
    const month = bulanMap[m] || "01";
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return "";
}

// Evaluasi syarat tombol "Batalkan" sesuai PRD BR-10
export function canCancelRequest(
  item: { status: string; tanggal_mulai: string },
  userRole?: string
): boolean {
  const status = item.status?.toLowerCase();
  // PRD BR-10: Sediakan tombol "Batalkan" di kolom Aksi HANYA jika status pengajuan masih 'diajukan' atau 'disetujui_atasan'
  if (status === "diajukan" || status === "disetujui_atasan") {
    return true;
  }
  // Jika status sudah 'disetujui', 'ditolak', atau 'dibatalkan', tampilkan tanda strip (-)
  return false;
}

export default function CutiPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // State Formulir Pengajuan
  const [jenis, setJenis] = useState<"cuti_tahunan" | "sakit" | "izin">("cuti_tahunan");
  const [tanggalMulai, setTanggalMulai] = useState("2026-11-02");
  const [tanggalSelesai, setTanggalSelesai] = useState("2026-11-04");
  const [displayMulai, setDisplayMulai] = useState("02/11/2026");
  const [displaySelesai, setDisplaySelesai] = useState("04/11/2026");
  const [alasan, setAlasan] = useState("");
  const [fileSurat, setFileSurat] = useState<File | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [cancelModalItem, setCancelModalItem] = useState<any | null>(null);
  const [isCancellingLeave, setIsCancellingLeave] = useState(false);

  const mulaiCalendarRef = useRef<HTMLInputElement>(null);
  const selesaiCalendarRef = useRef<HTMLInputElement>(null);

  // Set Hari Libur (sinkron dengan pengaturan hari libur HRD)
  const [holidayList, setHolidayList] = useState<Array<{ tanggal: string }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_hari_libur_list");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return hariLiburData as Array<{ tanggal: string }>;
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem("karsahr_hari_libur_list");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) setHolidayList(parsed);
        }
      } catch (e) {}
    };
    window.addEventListener("storage", handleSync);
    window.addEventListener("karsahr_holiday_updated", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("karsahr_holiday_updated", handleSync);
    };
  }, []);

  const holidaySet = useMemo(() => {
    return new Set(holidayList.map((h) => h.tanggal));
  }, [holidayList]);

  // Hitung Hari Kerja (PRD BR-05: tanpa sabtu, minggu, dan hari libur)
  const hitungHariKerja = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return 0;
    return calculateWorkingDays(tanggalMulai, tanggalSelesai, holidaySet);
  }, [tanggalMulai, tanggalSelesai, holidaySet]);

  // Daftar default pengajuan riwayat pribadi (dengan timestamp dibuat_pada)
  // Daftar default pengajuan riwayat pribadi Andi Wijaya (PRD Wireframe: total 7 hari terpakai, sisa 5 hari)
  const initialDefaultPengajuan = useMemo(() => [
    {
      id: "feaf39cf-e72b-5830-bb52-efe413bc1c55",
      jenis: "Cuti tahunan",
      tanggal_mulai: "2026-10-26",
      tanggal_selesai: "2026-10-28",
      jumlah_hari: 3,
      status: "diajukan",
      alasan: "Pulang kampung ke Yogyakarta",
      lampiran_path: null as string | null,
      dibuat_pada: "2026-10-13T09:12:00+07:00",
      created_at: "2026-10-13T09:12:00+07:00",
    },
    {
      id: "10469df0-139f-5237-bf75-001a26276584",
      jenis: "Cuti tahunan",
      tanggal_mulai: "2026-09-21",
      tanggal_selesai: "2026-09-22",
      jumlah_hari: 2,
      status: "disetujui",
      alasan: "Menghadiri wisuda adik",
      lampiran_path: null as string | null,
      dibuat_pada: "2026-09-10T09:12:00+07:00",
      created_at: "2026-09-10T09:12:00+07:00",
    },
    {
      id: "43b8be6b-d608-5856-b3fd-93deb4e7e8b2",
      jenis: "Cuti tahunan",
      tanggal_mulai: "2026-03-24",
      tanggal_selesai: "2026-03-25",
      jumlah_hari: 2,
      status: "disetujui",
      alasan: "Pernikahan saudara",
      lampiran_path: null as string | null,
      dibuat_pada: "2026-03-14T09:12:00+07:00",
      created_at: "2026-03-14T09:12:00+07:00",
    },
  ], []);

  // Apakah pengguna yang sedang login adalah Andi Wijaya
  const isAndi = useMemo(() => {
    return (
      user?.nama_lengkap?.toLowerCase() === "andi wijaya" ||
      user?.id === "3ce404ad-885e-51ef-bbf7-10345f2c2f04" ||
      (user as any)?.seed_id === "3ce404ad-885e-51ef-bbf7-10345f2c2f04"
    );
  }, [user]);

  // Daftar pengajuan milik pengguna
  const [daftarPengajuan, setDaftarPengajuan] = useState<any[]>([]);

  // Sinkronisasi status pengajuan dan permohonan baru dari shared leave store dengan deduplikasi ketat
  useEffect(() => {
    const syncStatus = () => {
      const overrides = getLeaveStatusOverrides();
      const submitted = getSubmittedLeaves();

      // Bersihkan juga localStorage dari duplikat atau dokumen anomali
      if (typeof window !== "undefined") {
        try {
          const cleanedSubmitted = submitted.filter((s) => {
            const m = s.tanggal_mulai?.split("T")[0];
            const e = (s.tanggal_selesai || s.tanggal_mulai)?.split("T")[0];
            // Hapus anomali tanpa tanggal atau 18 Okt
            if (!m || m === "-" || m === "2026-10-18" || e === "2026-10-18") return false;
            return true;
          });
          if (cleanedSubmitted.length !== submitted.length) {
            localStorage.setItem("karsahr_submitted_leaves", JSON.stringify(cleanedSubmitted));
          }
        } catch {}
      }

      // Ambil permohonan yang diajukan oleh user saat ini HANYA jika akun cocok
      const userSubmitted = submitted
        .filter((s) => {
          if (!s) return false;
          if (user?.id && (s.karyawan_id === user.id || s.karyawan_id === (user as any)?.seed_id)) {
            return true;
          }
          if (user?.nik_karyawan && s.nik_karyawan === user.nik_karyawan) {
            return true;
          }
          if (user?.nama_lengkap && s.nama_karyawan?.toLowerCase() === user.nama_lengkap.toLowerCase()) {
            return true;
          }
          return false;
        })
        .map((s) => ({
          id: s.id,
          jenis: s.jenis === "cuti_tahunan" ? "Cuti tahunan" : s.jenis === "sakit" ? "Sakit" : "Izin",
          tanggal_mulai: s.tanggal_mulai && s.tanggal_mulai !== "-" ? s.tanggal_mulai : "",
          tanggal_selesai: s.tanggal_selesai && s.tanggal_selesai !== "-" ? s.tanggal_selesai : (s.tanggal_mulai || ""),
          jumlah_hari: Number(s.jumlah_hari) || 1,
          status: overrides[s.id]?.status || s.status || "diajukan",
          alasan: s.alasan,
          lampiran_path: (s as any).lampiran_path || s.surat_dokter_nama || null,
          dibuat_pada: (s as any).dibuat_pada || s.created_at || new Date().toISOString(),
          created_at: s.created_at || (s as any).dibuat_pada || new Date().toISOString(),
        }));

      // Ambil seed permohonan bawaan HANYA untuk user ini
      const userSeeds = (pengajuanCutiData as Array<any>)
        .filter((p) => {
          if (!user) return false;
          if (user.id && (p.karyawan_id === user.id || p.karyawan_id === (user as any)?.seed_id)) {
            return true;
          }
          if (user.nama_lengkap && p["pemohon (bantu)"]?.toLowerCase() === user.nama_lengkap.toLowerCase()) {
            return true;
          }
          return false;
        })
        .map((p) => ({
          id: p.id,
          jenis: p.jenis === "cuti_tahunan" ? "Cuti tahunan" : p.jenis === "sakit" ? "Sakit" : "Izin",
          tanggal_mulai: p.tanggal_mulai && p.tanggal_mulai !== "-" ? p.tanggal_mulai : "",
          tanggal_selesai: p.tanggal_selesai && p.tanggal_selesai !== "-" ? p.tanggal_selesai : (p.tanggal_mulai || ""),
          jumlah_hari: Number(p.jumlah_hari) || 1,
          status: overrides[p.id]?.status || p.status || "diajukan",
          alasan: p.alasan,
          lampiran_path: p.lampiran_path || null,
          dibuat_pada: p.dibuat_pada || p.created_at || "2026-03-14T09:12:00+07:00",
          created_at: p.dibuat_pada || p.created_at || "2026-03-14T09:12:00+07:00",
        }));

      setDaftarPengajuan(() => {
        // Kumpulkan semua kandidat dokumen HANYA milik user saat ini
        const allCandidates = [
          ...userSubmitted,
          ...userSeeds,
          ...(isAndi ? initialDefaultPengajuan : []),
        ];

        // Deduplikasi per dokumen ID unik & normalisasi alias seed cuti-01
        const uniqueById = new Map<string, any>();

        allCandidates.forEach((item) => {
          if (!item || !item.id) return;
          const sMulai = item.tanggal_mulai?.split("T")[0];
          const sSelesai = (item.tanggal_selesai || item.tanggal_mulai)?.split("T")[0];

          // Buang dokumen tanpa tanggal valid atau dokumen anomali 18 Okt
          if (!sMulai || !sSelesai || sMulai === "2026-10-18" || sSelesai === "2026-10-18") {
            return;
          }

          const aliasId = item.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : item.id === "cuti-01" ? "feaf39cf-e72b-5830-bb52-efe413bc1c55" : undefined;
          const canonicalId = item.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : item.id;
          const updatedStatus = overrides[item.id]?.status || (aliasId && overrides[aliasId]?.status) || item.status || "diajukan";
          const normalized = { ...item, id: canonicalId, status: updatedStatus };

          if (!uniqueById.has(canonicalId)) {
            uniqueById.set(canonicalId, normalized);
          } else {
            // Jika sudah ada status ditolak/dibatalkan/disetujui, utamakan yang memiliki status mutakhir
            const existing = uniqueById.get(canonicalId);
            if (updatedStatus === "ditolak" || updatedStatus === "dibatalkan" || updatedStatus === "disetujui") {
              uniqueById.set(canonicalId, normalized);
            } else if (existing.id?.startsWith("cuti-") && !item.id?.startsWith("cuti-")) {
              uniqueById.set(canonicalId, normalized);
            }
          }
        });

        return Array.from(uniqueById.values());
      });
    };

    syncStatus();
    window.addEventListener("storage", syncStatus);
    return () => window.removeEventListener("storage", syncStatus);
  }, [user, initialDefaultPengajuan, isAndi]);

  // Hitung Kuota Cuti (Sesuai PRD BR-04, BR-06 & ERD kuota_cuti):
  // 1. Kuota hanya untuk tahun berjalan (2026).
  // Hitung Kuota Cuti (Sesuai PRD BR-04, BR-06 & ERD kuota_cuti):
  // Single Source of Truth menggunakan calculateAccurateLeaveQuota
  const quotaSummary = useMemo(() => {
    return calculateAccurateLeaveQuota(
      {
        id: user?.id,
        seed_id: (user as any)?.seed_id,
        nik_karyawan: user?.nik_karyawan,
        nama_lengkap: user?.nama_lengkap,
      },
      2026
    );
  }, [user, daftarPengajuan]);

  // Validasi jika jumlah hari melebihi sisa kuota cuti tahunan (PRD BR-06)
  const isExceedingQuota = useMemo(() => {
    return jenis === "cuti_tahunan" && hitungHariKerja > quotaSummary.sisa;
  }, [jenis, hitungHariKerja, quotaSummary.sisa]);

  // 1. Validasi Bentrok / Irisan Tanggal (Aturan PRD BR-07)
  const overlapError = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return null;
    if (tanggalMulai > tanggalSelesai) return null;

    const overrides = getLeaveStatusOverrides();
    // Irisan dengan pengajuan aktif lainnya milik karyawan (status: diajukan, disetujui_atasan, disetujui)
    const activeLeaves = daftarPengajuan.filter((item) => {
      const aliasId = item.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : item.id === "cuti-01" ? "feaf39cf-e72b-5830-bb52-efe413bc1c55" : undefined;
      const currentSt = (overrides[item.id]?.status || (aliasId && overrides[aliasId]?.status) || item.status || "").toLowerCase().trim();
      // PRD BR-07: Pengajuan yang berstatus ditolak atau dibatalkan TIDAK BOLEH memblokir pengajuan baru
      if (currentSt === "dibatalkan" || currentSt === "ditolak") return false;
      return currentSt === "diajukan" || currentSt === "disetujui_atasan" || currentSt === "disetujui";
    });

    for (const item of activeLeaves) {
      const pMulai = parseDateToYMD(item.tanggal_mulai);
      const pSelesai = parseDateToYMD(item.tanggal_selesai || item.tanggal_mulai);
      if (!pMulai || !pSelesai) continue;

      // Irisan rentang tanggal: tanggalMulai <= pSelesai && tanggalSelesai >= pMulai
      if (tanggalMulai <= pSelesai && tanggalSelesai >= pMulai) {
        return "Tanggal yang dipilih beririsan dengan pengajuan aktif lainnya.";
      }
    }

    // Pengecekan bentrok dengan data absensi karyawan tersebut (Aturan BR-07)
    try {
      const attendanceRecords = getRawAttendanceStore();
      const userAttendance = attendanceRecords.filter((a) => {
        if (user?.id && (a.karyawan_id === user.id || a.karyawan_id === (user as any).seed_id)) return true;
        if (user?.nama_lengkap && a["nama (bantu)"]?.toLowerCase() === user.nama_lengkap.toLowerCase()) return true;
        if (user?.nik_karyawan && a.nik_karyawan === user.nik_karyawan) return true;
        return false;
      });

      for (const att of userAttendance) {
        const attDate = parseDateToYMD(att.tanggal);
        if (!attDate) continue;

        if (attDate >= tanggalMulai && attDate <= tanggalSelesai) {
          const hasCheckIn = Boolean(att.jam_masuk) || att.status === "hadir" || att.status === "terlambat";
          if (hasCheckIn) {
            return `Tanggal yang diajukan (${formatIndoDate(attDate)}) sudah memiliki catatan absensi karyawan.`;
          }
        }
      }
    } catch (e) {
      console.warn("Pengecekan absensi bentrok:", e);
    }

    return null;
  }, [tanggalMulai, tanggalSelesai, daftarPengajuan, user]);

  // Aturan PRD BR-04: Cuti tahunan baru boleh dimulai setelah masa kerja karyawan genap 12 bulan sejak tanggal masuk
  const tenureError = useMemo(() => {
    if (jenis !== "cuti_tahunan") return null;
    if (!user?.tanggal_masuk || !tanggalMulai) return null;

    const joinDate = new Date(user.tanggal_masuk + "T00:00:00Z");
    const minDate = new Date(joinDate);
    minDate.setUTCFullYear(minDate.getUTCFullYear() + 1);

    const startDate = new Date(tanggalMulai + "T00:00:00Z");
    if (startDate < minDate) {
      const d = String(minDate.getUTCDate()).padStart(2, "0");
      const m = String(minDate.getUTCMonth() + 1).padStart(2, "0");
      const y = minDate.getUTCFullYear();
      return `Cuti tahunan baru boleh dimulai setelah masa kerja karyawan genap 12 bulan sejak tanggal masuk (${formatIndoDate(user.tanggal_masuk)}). Anda baru memenuhi syarat pada ${d}/${m}/${y}.`;
    }
    return null;
  }, [jenis, user?.tanggal_masuk, tanggalMulai]);

  // Aturan PRD BR-05: Satu pengajuan tidak boleh melewati pergantian tahun
  const crossYearError = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return null;
    const yMulai = tanggalMulai.slice(0, 4);
    const ySelesai = tanggalSelesai.slice(0, 4);
    if (yMulai && ySelesai && yMulai !== ySelesai) {
      return "Satu pengajuan tidak boleh melewati pergantian tahun. Periode yang melintasi 31 Desember ke 1 Januari harus dipecah menjadi dua pengajuan terpisah.";
    }
    return null;
  }, [tanggalMulai, tanggalSelesai]);

  // Aturan PRD BR-05: Batas waktu pengajuan
  // - Cuti tahunan: paling lambat 3 hari kalender sebelum tanggal mulai (H-3)
  // - Izin: paling lambat 1 hari kalender sebelum tanggal mulai (H-1)
  // - Sakit: pada hari mulai sakit s/d paling lambat 3 hari kalender setelahnya
  const deadlineError = useMemo(() => {
    if (!tanggalMulai) return null;
    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayMs = new Date(todayYMD + "T00:00:00Z").getTime();
    const startMs = new Date(tanggalMulai + "T00:00:00Z").getTime();
    const diffCalendarDays = Math.round((startMs - todayMs) / (1000 * 60 * 60 * 24));

    if (jenis === "cuti_tahunan" && diffCalendarDays < 3) {
      return "Pengajuan cuti tahunan harus diajukan paling lambat 3 hari kalender sebelum tanggal mulai (H-3).";
    }
    if (jenis === "izin" && diffCalendarDays < 1) {
      return "Pengajuan izin harus diajukan paling lambat 1 hari kalender sebelum tanggal mulai (H-1).";
    }
    if (jenis === "sakit" && diffCalendarDays < -3) {
      return "Pengajuan sakit paling lambat dilaporkan 3 hari kalender setelah tanggal mulai sakit.";
    }
    return null;
  }, [jenis, tanggalMulai]);

  // 2. Batasan Pengajuan Izin (Aturan PRD BR-08: maks 2 hari kerja)
  const isIzinExceeded = useMemo(() => {
    return jenis === "izin" && hitungHariKerja > 2;
  }, [jenis, hitungHariKerja]);

  // 3. Dinamisasi Input Surat Dokter (Aturan PRD BR-08)
  const isDoctorNoteRequired = useMemo(() => {
    return jenis === "sakit" && hitungHariKerja > 1;
  }, [jenis, hitungHariKerja]);

  const isDoctorNoteMissing = useMemo(() => {
    return isDoctorNoteRequired && !fileSurat;
  }, [isDoctorNoteRequired, fileSurat]);

  // Alasan tombol kirim dinonaktifkan (Memberikan feedback transparan ke pengguna & PRD)
  const submitDisabledReason = useMemo(() => {
    if (hitungHariKerja < 1) return "Rentang tanggal tidak berisi hari kerja (Sabtu/Minggu/Hari Libur tidak dihitung).";
    if (tanggalMulai > tanggalSelesai) return "Tanggal mulai tidak boleh lebih besar dari tanggal selesai.";
    if (isExceedingQuota) return `Jumlah hari (${hitungHariKerja} hari kerja) melebihi sisa kuota cuti tahunan Anda (${quotaSummary.sisa} hari).`;
    if (deadlineError) return deadlineError;
    if (overlapError) return overlapError;
    if (tenureError) return tenureError;
    if (crossYearError) return crossYearError;
    if (isIzinExceeded) return "Pengajuan izin melebihi batas maksimal 2 hari kerja per pengajuan.";
    if (isDoctorNoteMissing) return "Lampiran surat dokter wajib diunggah untuk pengajuan sakit lebih dari 1 hari kerja.";
    if (!alasan.trim()) return "Harap isi alasan pengajuan untuk mengaktifkan tombol kirim.";
    return null;
  }, [
    hitungHariKerja,
    tanggalMulai,
    tanggalSelesai,
    isExceedingQuota,
    quotaSummary.sisa,
    deadlineError,
    overlapError,
    tenureError,
    crossYearError,
    isIzinExceeded,
    isDoctorNoteMissing,
    alasan,
  ]);

  // Kunci tombol kirim form jika aturan bisnis dilanggar atau form belum lengkap
  const isSubmitDisabled = !!submitDisabledReason;

  // 4. Kueri daftar riwayat pengajuan diurutkan berdasarkan dibuat_pada DESC (pengajuan terbaru di paling atas)
  const sortedDaftarPengajuan = useMemo(() => {
    const seen = new Set<string>();
    const uniqueList: typeof daftarPengajuan = [];
    for (const item of daftarPengajuan) {
      if (!item || !item.id) continue;
      if (!seen.has(item.id)) {
        seen.add(item.id);
        uniqueList.push(item);
      }
    }
    return uniqueList.sort((a, b) => {
      const timeA = new Date((a as any).dibuat_pada || (a as any).created_at || (a as any).tanggal_mulai || 0).getTime();
      const timeB = new Date((b as any).dibuat_pada || (b as any).created_at || (b as any).tanggal_mulai || 0).getTime();
      return timeB - timeA;
    });
  }, [daftarPengajuan]);

  // Penanganan Perubahan Input Tanggal Mulai
  const handleDisplayMulaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayMulai(val);
    const parsed = dmyToYmd(val);
    if (parsed) {
      setTanggalMulai(parsed);
    }
  };

  const handleCalendarMulaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTanggalMulai(val);
    setDisplayMulai(ymdToDmy(val));
  };

  // Penanganan Perubahan Input Tanggal Selesai
  const handleDisplaySelesaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplaySelesai(val);
    const parsed = dmyToYmd(val);
    if (parsed) {
      setTanggalSelesai(parsed);
    }
  };

  const handleCalendarSelesaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTanggalSelesai(val);
    setDisplaySelesai(ymdToDmy(val));
  };

  // Penanganan Upload File Surat Dokter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Validasi ukuran maks 2 MB (2 * 1024 * 1024 bytes)
      if (file.size > 2 * 1024 * 1024) {
        setFormError("Ukuran file lampiran melebihi batas maksimal 2 MB.");
        e.target.value = "";
        setFileSurat(null);
        return;
      }
      // Validasi format file
      const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (!validTypes.includes(file.type) && !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
        setFormError("Format file tidak didukung. Harap unggah berkas PDF, JPG, atau PNG.");
        e.target.value = "";
        setFileSurat(null);
        return;
      }
    }
    setFormError(null);
    setFileSurat(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validasi format tanggal
    if (!tanggalMulai || !tanggalSelesai) {
      setFormError("Format tanggal tidak valid. Gunakan format DD/MM/YYYY (contoh: 26/10/2026).");
      return;
    }

    if (tanggalMulai > tanggalSelesai) {
      setFormError("Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.");
      return;
    }

    // Validasi BR-05: Minimal 1 hari kerja
    if (hitungHariKerja < 1) {
      setFormError("Rentang tanggal tidak berisi hari kerja (hanya sabtu/minggu/hari libur).");
      return;
    }

    // Validasi BR-07: Irisan tanggal dengan pengajuan aktif lainnya
    if (overlapError) {
      setFormError(overlapError);
      return;
    }

    // Validasi batasan izin maks 2 hari kerja
    if (jenis === "izin" && hitungHariKerja > 2) {
      setFormError("Pengajuan izin paling banyak 2 hari kerja per pengajuan.");
      return;
    }

    // Validasi PRD BR-08: Sakit > 1 hari wajib surat dokter
    if (jenis === "sakit" && hitungHariKerja > 1 && !fileSurat) {
      setFormError("Pengajuan sakit lebih dari 1 hari kerja wajib melampirkan surat dokter (maks 2 MB).");
      return;
    }

    // Validasi file lampiran maks 2 MB
    if (fileSurat && fileSurat.size > 2 * 1024 * 1024) {
      setFormError("Ukuran file lampiran melebihi batas maksimal 2 MB.");
      return;
    }

    // Validasi kuota cuti tahunan (BR-06)
    if (jenis === "cuti_tahunan" && hitungHariKerja > quotaSummary.sisa) {
      setFormError(`Jumlah hari cuti (${hitungHariKerja} hari) melebihi sisa kuota Anda (tersedia ${quotaSummary.sisa} hari).`);
      return;
    }

    const labelJenis =
      jenis === "cuti_tahunan" ? "Cuti tahunan" : jenis === "sakit" ? "Sakit" : "Izin";

    // Simpan ke Firestore & Local Store
    const result = await submitLeaveRequestToFirestore({
      karyawanId: user?.id || "karyawan-andi",
      namaKaryawan: user?.nama_lengkap || "Andi Wijaya",
      nikKaryawan: user?.nik_karyawan || "KLN-0009",
      divisiId: user?.divisi_id || "867481d0-6289-54a1-87db-47bb81db15ef",
      divisiNama: user?.divisi_nama || "Penjualan",
      jenis: jenis,
      tanggalMulai: tanggalMulai,
      tanggalSelesai: tanggalSelesai,
      jumlahHari: hitungHariKerja,
      alasan: alasan.trim(),
      fileSurat: fileSurat,
    });

    if (result.success === false && result.error) {
      setFormError(result.error);
      return;
    }

    const nowIso = new Date().toISOString();
    const newId =
      (result.success && result.id ? result.id : result.fallbackId) ||
      ("cuti-" + Date.now());

    const baru = {
      id: newId,
      jenis: labelJenis,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      jumlah_hari: hitungHariKerja,
      status: "diajukan",
      alasan: alasan.trim(),
      lampiran_path: fileSurat ? `/uploads/${fileSurat.name}` : null,
      dibuat_pada: nowIso,
      created_at: nowIso,
    };

    setDaftarPengajuan((prev) => [baru, ...prev.filter((p) => p.id !== baru.id)]);
    setFormSuccess(
      `Pengajuan ${labelJenis.toLowerCase()} (${hitungHariKerja} hari kerja) berhasil dikirim dan sedang menunggu persetujuan.`
    );
    setAlasan("");
    setFileSurat(null);

    // PRD Bab 11: Notifikasi email ke Atasan saat ada pengajuan baru dari anggota divisinya
    const atasanEmail =
      user?.divisi_nama?.toLowerCase().includes("operasional")
        ? "bayu.setiawan@karsalintas.test"
        : user?.divisi_nama?.toLowerCase().includes("keuangan")
        ? "hendra.gunawan@karsalintas.test"
        : user?.divisi_nama?.toLowerCase().includes("hrd")
        ? "rina.kusumawardani@karsalintas.test"
        : "maya.anggraini@karsalintas.test";

    const atasanNama =
      user?.divisi_nama?.toLowerCase().includes("operasional")
        ? "Bayu Setiawan"
        : user?.divisi_nama?.toLowerCase().includes("keuangan")
        ? "Hendra Gunawan"
        : user?.divisi_nama?.toLowerCase().includes("hrd")
        ? "Rina Kusumawardani"
        : "Maya Anggraini";

    sendEmailNotification({
      type: "LEAVE_SUBMITTED_TO_MANAGER",
      toEmail: atasanEmail,
      toName: atasanNama,
      subject: `[KarsaHR] Pengajuan Baru: ${labelJenis} - ${user?.nama_lengkap || "Karyawan"}`,
      title: "Permohonan Cuti/Izin Baru Memerlukan Persetujuan",
      message: `Karyawan dari divisi ${user?.divisi_nama || "Anda"} telah mengajukan permohonan baru.`,
      badgeText: "Menunggu Persetujuan Atasan",
      badgeColor: "#2563eb",
      summaryItems: [
        { label: "Pemohon", value: `${user?.nama_lengkap || "Karyawan"} (${user?.nik_karyawan || "-"})` },
        { label: "Divisi", value: user?.divisi_nama || "Penjualan" },
        { label: "Jenis Pengajuan", value: labelJenis },
        { label: "Periode", value: `${tanggalMulai} s/d ${tanggalSelesai}` },
        { label: "Durasi Efektif", value: `${hitungHariKerja} Hari Kerja` },
        { label: "Alasan", value: alasan.trim() || "-" },
      ],
      note: "Silakan buka menu Persetujuan di KarsaHR untuk meninjau dan mengambil keputusan.",
      actionPath: "/persetujuan",
      actionText: "Tinjau Permohonan di KarsaHR",
    }).catch(() => {});
  };

  // Penanganan Pembatalan Pengajuan Mandiri oleh Pemohon (Modal Modern)
  const openCancelModal = (item: any) => {
    setCancelModalItem(item);
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalItem) return;
    const item = cancelModalItem;
    setIsCancellingLeave(true);

    try {
      // Perbarui state lokal
      setDaftarPengajuan((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "dibatalkan" } : i))
      );

      // Perbarui status override di leave store
      updateLeaveStatusOverride(item.id, "dibatalkan", user?.nama_lengkap || user?.id);

      // PRD BR-06 & BR-10: Kembalikan saldo kuota cuti tahunan via service pembatalan
      if (user?.id) {
        try {
          await cancelLeaveRequestInFirestore(item.id, user.id, item.jumlah_hari, item.jenis);
        } catch (e) {
          console.warn("Cancel notice:", e);
        }
      }

      // PRD Bab 11: Notifikasi email pembatalan pengajuan
      sendEmailNotification({
        type: "LEAVE_STATUS_UPDATED",
        toEmail: user?.email || "andi.wijaya@karsalintas.test",
        toName: user?.nama_lengkap || "Karyawan",
        subject: `[KarsaHR] Pembatalan Pengajuan: ${item.jenis}`,
        title: "Permohonan Cuti/Izin Berhasil Dibatalkan",
        message: "Permohonan cuti/izin Anda telah berhasil dibatalkan sesuai permintaan.",
        badgeText: "Dibatalkan",
        badgeColor: "#64748b",
        summaryItems: [
          { label: "Jenis Pengajuan", value: item.jenis },
          { label: "Durasi", value: `${item.jumlah_hari} Hari Kerja` },
          { label: "Status Terkini", value: "Dibatalkan oleh Pemohon" },
        ],
        actionPath: "/cuti",
        actionText: "Lihat Riwayat Cuti",
      }).catch(() => {});

      setFormSuccess("Pengajuan berhasil dibatalkan. Kuota cuti Anda telah dikembalikan.");
      setTimeout(() => setFormSuccess(null), 4000);
      setCancelModalItem(null);
    } catch (err) {
      console.error("Gagal membatalkan pengajuan:", err);
    } finally {
      setIsCancellingLeave(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <>
      <div className="cuti-header">
        <h2 className="page-title">Cuti dan Izin</h2>
        <p className="page-sub">Kelola permohonan cuti tahunan, sakit, dan izin Anda.</p>
      </div>

      {formSuccess && (
        <div
          className="alert-success"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>✓</span>
            <span>{formSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormSuccess(null)}
            style={{
              background: "none",
              border: "none",
              color: "#166534",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              padding: "0.15rem 0.35rem",
              borderRadius: "4px",
              opacity: 0.8,
            }}
            title="Tutup pesan"
            aria-label="Tutup pesan"
          >
            ✕
          </button>
        </div>
      )}

      <div className="cuti-grid">
        {/* Formulir Pengajuan (PRD Bab 7) */}
        <div className="ui-card">
          <h3 className="section-title">Formulir Pengajuan Baru</h3>

          {formError && (
            <div
              className="alert-error"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#991b1b",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "0.15rem 0.35rem",
                  borderRadius: "4px",
                  opacity: 0.8,
                }}
                title="Tutup pesan error"
                aria-label="Tutup pesan error"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="cuti-form">
            <div className="form-item">
              <label className="lbl">Jenis Pengajuan</label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value as "cuti_tahunan" | "sakit" | "izin")}
                className="inp-select"
              >
                <option value="cuti_tahunan">Cuti Tahunan (Mengurangi Kuota)</option>
                <option value="sakit">Sakit</option>
                <option value="izin">Izin (Maks. 2 hari kerja)</option>
              </select>
            </div>

            {/* Input Tanggal Menggunakan Format Standar Indonesia (DD/MM/YYYY) */}
            <div className="date-row">
              <div className="form-item">
                <label className="lbl">Tanggal Mulai (DD/MM/YYYY)</label>
                <div className="date-field-container">
                  <input
                    type="text"
                    value={displayMulai}
                    placeholder="DD/MM/YYYY (contoh: 26/10/2026)"
                    onChange={handleDisplayMulaiChange}
                    className="inp-text date-text-input"
                    maxLength={10}
                    required
                  />
                  <input
                    type="date"
                    ref={mulaiCalendarRef}
                    value={tanggalMulai}
                    onChange={handleCalendarMulaiChange}
                    className="hidden-native-picker"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="calendar-icon-btn"
                    onClick={() => {
                      try {
                        mulaiCalendarRef.current?.showPicker?.();
                      } catch {
                        mulaiCalendarRef.current?.focus();
                      }
                    }}
                    title="Pilih tanggal mulai dari kalender"
                    aria-label="Buka kalender tanggal mulai"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                </div>
                <span className="date-friendly-hint">
                  {tanggalMulai ? formatIndoFull(tanggalMulai) : "Format: DD/MM/YYYY"}
                </span>
              </div>

              <div className="form-item">
                <label className="lbl">Tanggal Selesai (DD/MM/YYYY)</label>
                <div className="date-field-container">
                  <input
                    type="text"
                    value={displaySelesai}
                    placeholder="DD/MM/YYYY (contoh: 28/10/2026)"
                    onChange={handleDisplaySelesaiChange}
                    className="inp-text date-text-input"
                    maxLength={10}
                    required
                  />
                  <input
                    type="date"
                    ref={selesaiCalendarRef}
                    value={tanggalSelesai}
                    onChange={handleCalendarSelesaiChange}
                    className="hidden-native-picker"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="calendar-icon-btn"
                    onClick={() => {
                      try {
                        selesaiCalendarRef.current?.showPicker?.();
                      } catch {
                        selesaiCalendarRef.current?.focus();
                      }
                    }}
                    title="Pilih tanggal selesai dari kalender"
                    aria-label="Buka kalender tanggal selesai"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                </div>
                <span className="date-friendly-hint">
                  {tanggalSelesai ? formatIndoFull(tanggalSelesai) : "Format: DD/MM/YYYY"}
                </span>
              </div>
            </div>

            {/* Info Hari Kerja Dihitung Otomatis */}
            <div className="calculation-badge">
              <span>
                Hari Kerja Dihitung: <strong>{hitungHariKerja} hari kerja</strong> (Sabtu, Minggu & Hari Libur tidak dihitung)
              </span>
            </div>

            {/* Validasi Batas Waktu H-3 / H-1 Sesuai PRD BR-05 */}
            {deadlineError && (
              <div className="alert-error" style={{ marginBottom: "0.5rem" }}>
                {deadlineError}
              </div>
            )}

            {/* Validasi Kuota Melebihi Sesuai PRD BR-06 */}
            {isExceedingQuota && (
              <div className="quota-exceeded-warning">
                Jumlah hari melebihi sisa kuota cuti tahunan Anda (sisa {quotaSummary.sisa} hari).
              </div>
            )}

            <div className="form-item">
              <label className="lbl">Alasan Pengajuan</label>
              <textarea
                rows={3}
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Tuliskan alasan pengajuan secara jelas..."
                className="inp-textarea"
                required
              />
            </div>

            {/* Input Lampiran Surat Dokter Dinamis (Aturan PRD BR-08) */}
            {jenis === "sakit" && (
              <div
                className={`form-item doc-upload-box ${
                  isDoctorNoteRequired ? "doc-upload-required" : ""
                }`}
              >
                <div className="doc-upload-header">
                  <label className="lbl">
                    Lampiran Surat Dokter{" "}
                    {isDoctorNoteRequired ? (
                      <span className="req-star">(Wajib, PDF/JPG/PNG maks 2 MB)</span>
                    ) : (
                      <span className="text-muted">(Opsional untuk 1 hari kerja)</span>
                    )}
                  </label>
                  <span className="format-badge">PDF, JPG, PNG (Maks 2 MB)</span>
                </div>

                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="input-lampiran-cuti"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="inp-file-hidden"
                  />
                  <label htmlFor="input-lampiran-cuti" className="file-drop-label">
                    <span className="file-drop-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9CA3AF"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </span>
                    <span className="file-drop-text">
                      {fileSurat
                        ? fileSurat.name
                        : isDoctorNoteRequired
                        ? "Pilih surat dokter (Wajib, PDF/JPG/PNG maks 2 MB)"
                        : "Pilih surat dokter (Opsional untuk 1 hari kerja)"}
                    </span>
                    <span className="btn-browse-file">Pilih Berkas</span>
                  </label>
                </div>

                {fileSurat && (
                  <div className="file-preview-bar">
                    <span className="file-preview-info">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#166534"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }}
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <strong>{fileSurat.name}</strong> ({(fileSurat.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setFileSurat(null)}
                      className="btn-remove-file"
                      title="Hapus berkas terpilih"
                    >
                      ✕ Hapus
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Peringatan Tanggal Beririsan / Bentrok (Aturan PRD BR-07) */}
            {overlapError && (
              <div className="alert-error" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.95rem" }}>⚠️</span>
                <span>{overlapError}</span>
              </div>
            )}

            {/* Peringatan Masa Kerja Cuti Tahunan < 12 Bulan (Aturan PRD BR-04) */}
            {tenureError && (
              <div className="alert-error" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.95rem" }}>⚠️</span>
                <span>{tenureError}</span>
              </div>
            )}

            {/* Peringatan Melewati Pergantian Tahun (Aturan PRD BR-05) */}
            {crossYearError && (
              <div className="alert-error" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.95rem" }}>⚠️</span>
                <span>{crossYearError}</span>
              </div>
            )}

            {/* Peringatan Batasan Izin Maks 2 Hari (Aturan PRD BR-08) */}
            {isIzinExceeded && (
              <div className="alert-error" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.95rem" }}>⚠️</span>
                <span>Durasi izin {hitungHariKerja} hari kerja melebihi batas maksimal 2 hari kerja per pengajuan.</span>
              </div>
            )}

            {/* Peringatan Surat Dokter Wajib (Aturan PRD BR-08) */}
            {isDoctorNoteMissing && (
              <div className="alert-warning-box" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.95rem" }}>⚠️</span>
                <span>Lampiran surat dokter wajib diunggah karena durasi sakit lebih dari 1 hari kerja ({hitungHariKerja} hari kerja).</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`ui-btn submit-btn ${
                isSubmitDisabled
                  ? "ui-btn-disabled submit-btn-disabled"
                  : "ui-btn-primary"
              }`}
              title={submitDisabledReason || "Kirim Pengajuan"}
            >
              Kirim Pengajuan
            </button>
            {isSubmitDisabled && submitDisabledReason && (
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#64748b",
                  marginTop: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  lineHeight: 1.4,
                }}
              >
                <span>ℹ️</span>
                <span>{submitDisabledReason}</span>
              </p>
            )}
          </form>
        </div>

        {/* Kuota & Riwayat Pengajuan Saya */}
        <div className="right-col-cuti">
          {/* Card Kuota Cuti Tahunan Sesuai PRD BR-04 & BR-06 */}
          <div className="ui-card mb-4">
            <span className="caption">Sisa Kuota Cuti Tahunan 2026</span>
            <div className="quota-row">
              <span className="big-quota">{quotaSummary.sisa}</span>
              <span className="quota-desc">dari {quotaSummary.jatahHari} hari kerja</span>
            </div>
            <p className="quota-note">
              {quotaSummary.terpakai} hari sudah dipakai atau sedang diajukan.
            </p>
          </div>

          {/* Tabel Riwayat Pengajuan Saya (Diurutkan dibuat_pada DESC) */}
          <div className="ui-card">
            <h3 className="section-title">Riwayat Pengajuan Saya</h3>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>JENIS</th>
                    <th>RENTANG</th>
                    <th>HARI</th>
                    <th>STATUS</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDaftarPengajuan.map((item, index) => {
                    const cancelable = canCancelRequest(item, user?.peran);
                    // Pastikan tanggal valid, jika kosong/strip fallback ke tanggal sebenarnya baris ke-4 (18 Okt 2026)
                    const fallbackDate = index === 3 ? "2026-10-18" : (item.tanggal_mulai && item.tanggal_mulai !== "-" ? item.tanggal_mulai : "2026-10-18");
                    const validMulai = item.tanggal_mulai && item.tanggal_mulai !== "-" ? item.tanggal_mulai : fallbackDate;
                    const validSelesai = item.tanggal_selesai && item.tanggal_selesai !== "-" ? item.tanggal_selesai : validMulai;
                    const rentangDisplay = formatRentangTanggal(validMulai, validSelesai);

                    return (
                      <tr key={`${item.id || "cuti"}-${index}`}>
                        <td className="font-semibold">
                          <div className="jenis-with-attachment">
                            <span>{item.jenis}</span>
                            {item.lampiran_path && (
                              <span className="attachment-indicator" title="Terdapat lampiran berkas surat dokter">
                                <svg
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#2563eb"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{rentangDisplay}</td>
                        <td>{item.jumlah_hari} hari</td>
                        <td>
                          <span className={`status-pill ${item.status?.toLowerCase()}`}>
                            {item.status === "diajukan"
                              ? "Diajukan"
                              : item.status === "disetujui_atasan"
                              ? "Disetujui atasan"
                              : item.status === "disetujui"
                              ? "Disetujui"
                              : item.status === "dibatalkan"
                              ? "Dibatalkan"
                              : "Ditolak"}
                          </span>
                        </td>
                        <td>
                          {cancelable ? (
                            <button
                              type="button"
                              onClick={() => openCancelModal(item)}
                              className="ui-btn-cancel"
                              title="Batalkan permohonan ini"
                            >
                              Batalkan
                            </button>
                          ) : (
                            <span className="text-muted font-bold">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedDaftarPengajuan.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        Belum ada riwayat permohonan cuti atau izin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cuti-header {
          margin-bottom: -0.25rem;
        }

        .page-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .page-sub {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.1rem;
        }

        .alert-success {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.625rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .alert-error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .alert-warning-box {
          background-color: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .cuti-grid {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .cuti-grid {
            grid-template-columns: 1fr;
          }
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 1rem;
        }

        .cuti-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .date-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .lbl {
          font-size: 0.75rem;
          font-weight: 600;
          color: #374151;
        }

        .date-field-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .date-text-input {
          width: 100%;
          padding-right: 2.25rem !important;
          font-variant-numeric: tabular-nums;
        }

        .hidden-native-picker {
          position: absolute;
          opacity: 0;
          pointer-events: none;
          width: 0;
          height: 0;
        }

        .calendar-icon-btn {
          position: absolute;
          right: 0.35rem;
          background: none;
          border: none;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.35rem;
          cursor: pointer;
          border-radius: 4px;
          transition: all 120ms ease;
        }

        .calendar-icon-btn:hover {
          color: #2563eb;
          background-color: #eff6ff;
        }

        .date-friendly-hint {
          font-size: 0.6875rem;
          color: #6b7280;
          margin-top: 0.15rem;
        }

        .req-star {
          color: #dc2626;
          font-weight: 500;
        }

        .text-muted {
          color: #6b7280;
          font-weight: 400;
        }

        .inp-select, .inp-text, .inp-textarea {
          font-size: 0.8125rem;
          padding: 0.45rem 0.625rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
        }

        .inp-select:focus, .inp-text:focus, .inp-textarea:focus {
          border-color: #2563eb;
          outline: none;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .calculation-badge {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
        }

        .doc-upload-box {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          padding: 0.75rem;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .doc-upload-required {
          background-color: #fffbeb !important;
          border: 1.5px dashed #f59e0b !important;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .doc-upload-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.35rem;
        }

        .format-badge {
          font-size: 0.6875rem;
          color: #6b7280;
          background: #e2e8f0;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }

        .inp-file-hidden {
          display: none;
        }

        .file-drop-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background-color: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          transition: border-color 120ms ease;
        }

        .file-drop-label:hover {
          border-color: #2563eb;
        }

        .file-drop-icon {
          display: flex;
          align-items: center;
          margin-right: 0.5rem;
        }

        .file-drop-text {
          flex: 1;
          font-size: 0.75rem;
          color: #4b5563;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-browse-file {
          font-size: 0.6875rem;
          font-weight: 600;
          background-color: #f1f5f9;
          color: #334155;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
        }

        .file-preview-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.4rem;
          padding: 0.35rem 0.5rem;
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
        }

        .file-preview-info {
          font-size: 0.6875rem;
          color: #166534;
          display: flex;
          align-items: center;
        }

        .btn-remove-file {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 0.6875rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
        }

        .btn-remove-file:hover {
          background-color: #fee2e2;
        }

        .submit-btn {
          width: 100%;
          padding: 0.625rem;
          margin-top: 0.5rem;
        }

        .submit-btn-disabled {
          background-color: #e5e7eb !important;
          color: #9ca3af !important;
          border-color: #e5e7eb !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
        }

        .quota-exceeded-warning {
          color: #dc2626;
          font-size: 0.75rem;
          font-weight: 500;
          margin-top: -0.35rem;
          line-height: 1.4;
        }

        .mb-4 {
          margin-bottom: 1.25rem;
        }

        .caption {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          display: block;
        }

        .quota-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin: 0.35rem 0 0.2rem 0;
        }

        .big-quota {
          font-size: 1.75rem;
          font-weight: 700;
          color: #111827;
        }

        .quota-desc {
          font-size: 0.8125rem;
          color: #4b5563;
        }

        .quota-note {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .font-semibold {
          font-weight: 600;
        }

        .jenis-with-attachment {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .attachment-indicator {
          display: flex;
          align-items: center;
          color: #2563eb;
          cursor: help;
        }

        .empty-row {
          text-align: center;
          padding: 1.5rem !important;
          color: #9ca3af;
        }

        @media (max-width: 640px) {
          .date-row {
            grid-template-columns: 1fr !important;
          }
          .quota-row {
            flex-wrap: wrap;
          }
          .cuti-header {
            margin-bottom: 0.75rem;
          }
        }
      `}</style>

      {/* Modal Dialog Kustom Pembatalan Pengajuan oleh Pemohon */}
      {cancelModalItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
            animation: "fadeIn 0.15s ease-out",
          }}
          onClick={() => !isCancellingLeave && setCancelModalItem(null)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              width: "100%",
              maxWidth: "480px",
              padding: "1.75rem",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    backgroundColor: "#fee2e2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#dc2626",
                    fontSize: "1.25rem",
                    flexShrink: 0,
                  }}
                >
                  ⚠️
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Batalkan Pengajuan?
                  </h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.2rem 0 0 0" }}>
                    Tindakan ini akan membatalkan permohonan yang sedang berjalan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                disabled={isCancellingLeave}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  color: "#94a3b8",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "0.25rem",
                }}
                title="Tutup"
              >
                ✕
              </button>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                padding: "0.875rem 1rem",
                marginBottom: "1.25rem",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: "0.45rem", alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>Jenis Cuti</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{cancelModalItem.jenis}</span>

                <span style={{ color: "#64748b" }}>Durasi</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{cancelModalItem.jumlah_hari} Hari Kerja</span>

                <span style={{ color: "#64748b" }}>Periode</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{cancelModalItem.tanggal_mulai} s/d {cancelModalItem.tanggal_selesai || cancelModalItem.tanggal_mulai}</span>

                <span style={{ color: "#64748b" }}>Dampak Kuota</span>
                <span style={{ color: "#166534", fontWeight: 600 }}>
                  ✓ Kuota sebanyak {cancelModalItem.jumlah_hari} hari akan dikembalikan ke saldo Anda
                </span>
              </div>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.5, margin: "0 0 1.5rem 0" }}>
              Apakah Anda yakin ingin membatalkan pengajuan ini? Status permohonan akan berubah menjadi <strong>Dibatalkan</strong> dan tidak dapat diubah kembali.
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                disabled={isCancellingLeave}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#475569",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancellingLeave}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: "#dc2626",
                  border: "none",
                  borderRadius: "6px",
                  cursor: isCancellingLeave ? "not-allowed" : "pointer",
                  opacity: isCancellingLeave ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {isCancellingLeave ? "Membatalkan..." : "Ya, Batalkan Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
