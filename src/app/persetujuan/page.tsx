"use client";

import React, { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getLeaveStatusOverrides,
  getSubmittedLeaves,
  SubmittedLeave,
} from "@/lib/utils/leave-store";
import {
  fetchLeaveRequestsFromFirestore,
  updateLeaveApprovalInFirestore,
} from "@/lib/firebase/leave-service";
import { sendEmailNotification } from "@/lib/email/email-service";
import profilesData from "../../../data/seeds/profiles.json";
import divisiData from "../../../data/seeds/divisi.json";
import "./persetujuan.css";

interface ApprovalItem {
  id: string;
  karyawan_id?: string;
  divisi_id?: string;
  nama: string;
  nik: string;
  jabatan: string;
  divisi: string;
  atasan_nama: string;
  atasan_jabatan: string;
  jenis: "Cuti tahunan" | "Sakit" | "Izin";
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_singkat: string;
  tanggal_teks: string;
  lama: string;
  jumlah_hari: number;
  kuota_jatah: number;
  kuota_terpakai: number;
  kuota_sisa: number;
  status_kerja: string;
  alasan: string;
  status?: string;
  perlu_atasan?: boolean;
  tahap_persetujuan?: string;
  lampiran?: {
    nama: string;
    ukuran: string;
    tipe: string;
  } | null;
  tanggal_pengajuan: string;
  tanggal_pengajuan_singkat: string;
  rekan_cuti: Array<{ nama: string; tanggal: string; status: "disetujui" | "disetujui_atasan" | "diajukan" }>;
}

// Master Profile Lookup Dinamis & Lengkap Berdasarkan ERD & Seed Profiles
const profileById = new Map<string, any>();
const profileByName = new Map<string, any>();
const profileByNik = new Map<string, any>();
(profilesData as Array<any>).forEach((p) => {
  if (p.id) profileById.set(p.id, p);
  if (p.nama_lengkap) profileByName.set(p.nama_lengkap.toLowerCase().trim(), p);
  if (p.nik_karyawan) profileByNik.set(p.nik_karyawan.trim(), p);
});

const divisiNameById = new Map<string, string>();
(divisiData as Array<any>).forEach((d) => {
  if (d.id) divisiNameById.set(d.id, d.nama);
});

const EMPLOYEE_PROFILES_LOOKUP: Record<string, { nama: string; nik: string; jabatan: string; divisi: string; status_kerja: string }> = {};
(profilesData as Array<any>).forEach((p) => {
  const dName = p["divisi (bantu)"] || divisiNameById.get(p.divisi_id) || "Penjualan";
  const sKerja = p.status_kerja === "kontrak" ? "Karyawan Kontrak" : "Karyawan Tetap";
  const entry = {
    nama: p.nama_lengkap,
    nik: p.nik_karyawan,
    jabatan: p.jabatan,
    divisi: dName,
    status_kerja: sKerja,
  };
  if (p.id) EMPLOYEE_PROFILES_LOOKUP[p.id] = entry;
  if (p.nik_karyawan) EMPLOYEE_PROFILES_LOOKUP[p.nik_karyawan] = entry;
});

const DEFAULT_QUEUE: ApprovalItem[] = [
  {
    id: "cuti-01",
    karyawan_id: "3ce404ad-885e-51ef-bbf7-10345f2c2f04",
    divisi_id: "867481d0-6289-54a1-87db-47bb81db15ef",
    nama: "Andi Wijaya",
    nik: "KLN-0009",
    jabatan: "Sales Executive",
    divisi: "Penjualan",
    atasan_nama: "Maya Anggraini",
    atasan_jabatan: "Manajer Penjualan",
    jenis: "Cuti tahunan",
    tanggal_mulai: "2026-10-26",
    tanggal_selesai: "2026-10-28",
    tanggal_singkat: "26 - 28 Okt 2026",
    tanggal_teks: "Senin, 26 Okt 2026 s/d Rabu, 28 Okt 2026",
    lama: "3 Hari Kerja",
    jumlah_hari: 3,
    kuota_jatah: 12,
    kuota_terpakai: 7,
    kuota_sisa: 5,
    status_kerja: "Karyawan Tetap (Masuk 1 Jun 2021)",
    alasan: "Keperluan keluarga di Yogyakarta.",
    lampiran: null,
    tanggal_pengajuan: "13 Okt 2026, 09.12 WIB",
    tanggal_pengajuan_singkat: "13 Okt 2026",
    rekan_cuti: [
      { nama: "Yoga Permana", tanggal: "19 Okt - 20 Okt 2026", status: "disetujui" },
      { nama: "Putri Lestari", tanggal: "9 Nov - 10 Nov 2026", status: "disetujui_atasan" },
    ],
  },
  {
    id: "cuti-04",
    karyawan_id: "p1fyCjgpnAPCygmfpmzhVhl3zEQ2",
    divisi_id: "867481d0-6289-54a1-87db-47bb81db15ef",
    nama: "Larasati Dewi",
    nik: "KLN-0010",
    jabatan: "Account Executive",
    divisi: "Penjualan",
    atasan_nama: "Maya Anggraini",
    atasan_jabatan: "Manajer Penjualan",
    jenis: "Sakit",
    tanggal_mulai: "2026-10-19",
    tanggal_selesai: "2026-10-21",
    tanggal_singkat: "19 - 21 Okt 2026",
    tanggal_teks: "Senin, 19 Okt 2026 s/d Rabu, 21 Okt 2026",
    lama: "3 Hari Kerja",
    jumlah_hari: 3,
    kuota_jatah: 12,
    kuota_terpakai: 4,
    kuota_sisa: 8,
    status_kerja: "Karyawan Tetap (Masuk 15 Jan 2022)",
    alasan: "Demam berdarah dan menjalani rawat inap atas anjuran dokter spesialis.",
    lampiran: {
      nama: "Surat_Keterangan_Dokter_Klinik_Medika.pdf",
      ukuran: "1.2 MB",
      tipe: "Dokumen Medis",
    },
    tanggal_pengajuan: "18 Okt 2026, 14.30 WIB",
    tanggal_pengajuan_singkat: "18 Okt 2026",
    rekan_cuti: [
      { nama: "Andi Wijaya", tanggal: "26 Okt - 28 Okt 2026", status: "diajukan" },
      { nama: "Yoga Permana", tanggal: "19 Okt - 20 Okt 2026", status: "disetujui" },
    ],
  },
  {
    id: "cuti-05",
    karyawan_id: "NFgLLDC7cveTHEQZSEcBCNQZRUu2",
    divisi_id: "867481d0-6289-54a1-87db-47bb81db15ef",
    nama: "Putri Lestari",
    nik: "KLN-0012",
    jabatan: "Telemarketing Specialist",
    divisi: "Penjualan",
    atasan_nama: "Maya Anggraini",
    atasan_jabatan: "Manajer Penjualan",
    jenis: "Izin",
    tanggal_mulai: "2026-11-09",
    tanggal_selesai: "2026-11-10",
    tanggal_singkat: "9 - 10 Nov 2026",
    tanggal_teks: "Senin, 9 Nov 2026 s/d Selasa, 10 Nov 2026",
    lama: "2 Hari Kerja",
    jumlah_hari: 2,
    kuota_jatah: 12,
    kuota_terpakai: 2,
    kuota_sisa: 10,
    status_kerja: "Karyawan Kontrak (Masuk 1 Agu 2023)",
    alasan: "Pengurusan dokumen kependudukan keluarga di instansi terkait.",
    lampiran: null,
    tanggal_pengajuan: "15 Okt 2026, 11.05 WIB",
    tanggal_pengajuan_singkat: "15 Okt 2026",
    rekan_cuti: [
      { nama: "Andi Wijaya", tanggal: "26 Okt - 28 Okt 2026", status: "diajukan" },
    ],
  },
  {
    id: "cuti-06",
    karyawan_id: "24173534-3de4-5c18-bc67-d3034545c061",
    divisi_id: "8865d249-d46e-5207-bf19-1b9163f5e954",
    nama: "Siti Nurhaliza",
    nik: "KLN-0006",
    jabatan: "Supervisor Gudang",
    divisi: "Operasional Gudang",
    atasan_nama: "Bayu Setiawan",
    atasan_jabatan: "Manajer Operasional",
    jenis: "Cuti tahunan",
    tanggal_mulai: "2026-11-02",
    tanggal_selesai: "2026-11-03",
    tanggal_singkat: "2 - 3 Nov 2026",
    tanggal_teks: "Senin, 2 Nov 2026 s/d Selasa, 3 Nov 2026",
    lama: "2 Hari Kerja",
    jumlah_hari: 2,
    kuota_jatah: 12,
    kuota_terpakai: 3,
    kuota_sisa: 9,
    status_kerja: "Karyawan Tetap (Masuk 14 Sep 2020)",
    alasan: "Menghadiri pernikahan adik kandung di Bandung.",
    lampiran: null,
    tanggal_pengajuan: "17 Okt 2026, 08.45 WIB",
    tanggal_pengajuan_singkat: "17 Okt 2026",
    rekan_cuti: [
      { nama: "Agus Salim", tanggal: "5 Nov - 6 Nov 2026", status: "disetujui" },
    ],
  },
];

function convertSubmittedToApprovalItem(item: SubmittedLeave): ApprovalItem {
  const isCutiTahunan = item.jenis === "cuti_tahunan" || item.jenis?.toLowerCase().includes("tahunan");
  const isSakit = item.jenis === "sakit" || item.jenis?.toLowerCase().includes("sakit");
  const jenisLabel: "Cuti tahunan" | "Sakit" | "Izin" = isCutiTahunan
    ? "Cuti tahunan"
    : isSakit
    ? "Sakit"
    : "Izin";

  // Lookup data karyawan asli secara presisi
  const profile =
    (item.karyawan_id ? profileById.get(item.karyawan_id) : null) ||
    (item.nama_karyawan ? profileByName.get(item.nama_karyawan.toLowerCase().trim()) : null) ||
    (item.nik_karyawan ? profileByNik.get(item.nik_karyawan.trim()) : null);

  const rawNama = item.nama_karyawan;
  const isDummyNama = !rawNama || rawNama.trim().toLowerCase() === "karyawan";
  const finalNama = isDummyNama ? (profile?.nama_lengkap || "Andi Wijaya") : rawNama;

  const rawNik = item.nik_karyawan;
  const isDummyNik = !rawNik || rawNik === "KLN-0000";
  const finalNik = isDummyNik ? (profile?.nik_karyawan || "KLN-0009") : rawNik;

  const finalDivisi =
    item.divisi_nama ||
    (item.divisi_id ? divisiNameById.get(item.divisi_id) : null) ||
    profile?.["divisi (bantu)"] ||
    (profile?.divisi_id ? divisiNameById.get(profile.divisi_id) : null) ||
    "Penjualan";

  const finalJabatan = item.jabatan || profile?.jabatan || "Staff";
  const finalStatusKerja = item.status_kerja || (profile?.status_kerja === "kontrak" ? "Karyawan Kontrak" : "Karyawan Tetap");

  let atasanNama = "Maya Anggraini";
  let atasanJabatan = "Manajer Penjualan";
  const div = finalDivisi.toLowerCase();
  if (div.includes("operasional") || div.includes("gudang")) {
    atasanNama = "Bayu Setiawan";
    atasanJabatan = "Manajer Operasional";
  } else if (div.includes("keuangan")) {
    atasanNama = "Hendra Gunawan";
    atasanJabatan = "Manajer Keuangan";
  } else if (div.includes("resource") || div.includes("hr")) {
    atasanNama = "Rina Kusumawardani";
    atasanJabatan = "Kepala HRD";
  }

  const tMulai = item.tanggal_mulai || "2026-10-26";
  const tSelesai = item.tanggal_selesai || tMulai;

  return {
    id: item.id,
    karyawan_id: item.karyawan_id,
    divisi_id: item.divisi_id,
    nama: finalNama,
    nik: finalNik,
    jabatan: finalJabatan,
    divisi: finalDivisi,
    atasan_nama: atasanNama,
    atasan_jabatan: atasanJabatan,
    jenis: jenisLabel,
    tanggal_mulai: tMulai,
    tanggal_selesai: tSelesai,
    tanggal_singkat: `${tMulai.split("-").slice(1).join("/")} - ${tSelesai.split("-").slice(1).join("/")}`,
    tanggal_teks: `${tMulai} s/d ${tSelesai}`,
    lama: `${item.jumlah_hari || 1} Hari Kerja`,
    jumlah_hari: item.jumlah_hari || 1,
    kuota_jatah: 12,
    kuota_terpakai: 7,
    kuota_sisa: 5,
    status_kerja: finalStatusKerja,
    alasan: item.alasan || "Keperluan mendesak.",
    lampiran: item.surat_dokter_nama
      ? {
          nama: item.surat_dokter_nama,
          ukuran: item.surat_dokter_size ? `${Math.round(item.surat_dokter_size / 1024)} KB` : "1.2 MB",
          tipe: "Dokumen Medis",
        }
      : null,
    tanggal_pengajuan: item.created_at
      ? new Date(item.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      : "15 Okt 2026, 09.00 WIB",
    tanggal_pengajuan_singkat: item.created_at
      ? new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "15 Okt 2026",
    rekan_cuti: [
      { nama: "Andi Wijaya", tanggal: "26 Okt - 28 Okt 2026", status: "diajukan" },
      { nama: "Yoga Permana", tanggal: "19 Okt - 20 Okt 2026", status: "disetujui" },
    ],
    status: item.status,
    tahap_persetujuan: item.tahap_persetujuan,
  };
}

const formatShortId = (rawId: string) => {
  if (!rawId) return "";
  const clean = rawId.trim();
  if (clean.includes("-") && clean.length >= 20) {
    const firstChunk = clean.split("-")[0];
    return `#${firstChunk.toUpperCase()}`;
  }
  return `#${clean.toUpperCase()}`;
};

export default function PersetujuanPage() {
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = (fullId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };
  const [selectedId, setSelectedId] = useState("cuti-01");
  const [statusMap, setStatusMap] = useState<Record<string, "diajukan" | "disetujui_atasan" | "disetujui" | "ditolak" | "dibatalkan">>({
    "cuti-01": "diajukan",
    "cuti-04": "diajukan",
    "cuti-05": "diajukan",
    "cuti-06": "diajukan",
  });
  const [overridesRecord, setOverridesRecord] = useState<Record<string, any>>({});
  const [allQueue, setAllQueue] = useState<ApprovalItem[]>(DEFAULT_QUEUE);
  const [alasanPenolakan, setAlasanPenolakan] = useState("");
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Auto-dismiss alertSuccess setelah 4 detik (Toast Notification)
  useEffect(() => {
    if (alertSuccess) {
      const timer = setTimeout(() => {
        setAlertSuccess(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [alertSuccess]);

  // Tab Filter: "perlu_tindakan" | "riwayat_selesai" Sesuai PRD Bab 7
  const [filterTab, setFilterTab] = useState<"perlu_tindakan" | "riwayat_selesai">("perlu_tindakan");
  const [searchQuery, setSearchQuery] = useState("");

  // Muat dan sinkronisasi seluruh antrean permohonan dari Store lokal dan Firestore
  useEffect(() => {
    const syncAll = async () => {
      const overrides = getLeaveStatusOverrides();
      setOverridesRecord(overrides);

      // 1. Ambil dari local store
      const localSubmitted = getSubmittedLeaves();
      const localConverted = localSubmitted.map(convertSubmittedToApprovalItem);

      // 2. Gabungkan dengan data default (prioritaskan submission baru di atas)
      const map = new Map<string, ApprovalItem>();
      localConverted.forEach((item) => map.set(item.id, item));
      DEFAULT_QUEUE.forEach((item) => {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      });

      let combined = Array.from(map.values());

      // 3. Filter sesuai hak akses peran pengguna
      if (user?.peran === "atasan") {
        const myDivName = (user?.divisi_nama || (user as any)?.["divisi (bantu)"] || (user as any)?.divisi || "penjualan").toLowerCase().trim();
        const userUid = user.id;
        const userSeedId = (user as any)?.seed_id;
        const userNik = user.nik_karyawan;

        combined = combined.filter((item) => {
          // Jangan tampilkan permohonan milik atasan itu sendiri (PRD BR-09)
          const isSelf =
            (userUid && item.karyawan_id === userUid) ||
            (userSeedId && item.karyawan_id === userSeedId) ||
            (userNik && item.nik === userNik) ||
            (user.nama_lengkap && item.nama.toLowerCase() === user.nama_lengkap.toLowerCase());
          if (isSelf) return false;

          const itemDiv = (item.divisi || "").toLowerCase().trim();
          return (
            (myDivName && itemDiv.includes(myDivName)) ||
            (itemDiv && myDivName.includes(itemDiv)) ||
            (user.divisi_id && item.divisi_id === user.divisi_id)
          );
        });
      } else if (user?.peran === "hrd") {
        const userUid = user.id;
        const userSeedId = (user as any)?.seed_id;
        const userNik = user.nik_karyawan;

        combined = combined.filter((item) => {
          const isSelf =
            (userUid && item.karyawan_id === userUid) ||
            (userSeedId && item.karyawan_id === userSeedId) ||
            (userNik && item.nik === userNik) ||
            (user.nama_lengkap && item.nama.toLowerCase() === user.nama_lengkap.toLowerCase());
          return !isSelf;
        });
      }

      setAllQueue(combined);

      // Perbarui status map
      setStatusMap((prev) => {
        const next = { ...prev };
        combined.forEach((item) => {
          const rawStatus = (localSubmitted.find((s) => s.id === item.id)?.status || "diajukan") as any;
          next[item.id] = overrides[item.id]?.status || rawStatus;
        });
        return next;
      });

      // 4. Sinkronisasi dengan Cloud Firestore secara asinkron
      try {
        const firestoreLeaves = await fetchLeaveRequestsFromFirestore();
        if (firestoreLeaves && firestoreLeaves.length > 0) {
          const fsConverted = firestoreLeaves.map(convertSubmittedToApprovalItem);
          const mapFs = new Map<string, ApprovalItem>();
          fsConverted.forEach((item) => mapFs.set(item.id, item));
          localConverted.forEach((item) => {
            if (!mapFs.has(item.id)) mapFs.set(item.id, item);
          });

          let fsCombined = Array.from(mapFs.values());
          if (user?.peran === "atasan") {
            const myDivName = (user?.divisi_nama || (user as any)?.["divisi (bantu)"] || (user as any)?.divisi || "penjualan").toLowerCase().trim();
            const userUid = user.id;
            const userSeedId = (user as any)?.seed_id;
            const userNik = user.nik_karyawan;
            const userNama = user.nama_lengkap?.toLowerCase().trim();

            fsCombined = fsCombined.filter((item) => {
              // Jangan tampilkan permohonan milik atasan itu sendiri (PRD BR-09)
              const isSelf =
                (userUid && item.karyawan_id === userUid) ||
                (userSeedId && item.karyawan_id === userSeedId) ||
                (userNik && item.nik === userNik) ||
                (userNama && item.nama.toLowerCase().trim() === userNama);
              if (isSelf) return false;

              const itemDiv = (item.divisi || "").toLowerCase().trim();
              return (
                (myDivName && itemDiv.includes(myDivName)) ||
                (itemDiv && myDivName.includes(itemDiv)) ||
                (user.divisi_id && item.divisi_id === user.divisi_id)
              );
            });
          } else if (user?.peran === "hrd") {
            const userUid = user.id;
            const userSeedId = (user as any)?.seed_id;
            const userNik = user.nik_karyawan;
            const userNama = user.nama_lengkap?.toLowerCase().trim();

            fsCombined = fsCombined.filter((item) => {
              const isSelf =
                (userUid && item.karyawan_id === userUid) ||
                (userSeedId && item.karyawan_id === userSeedId) ||
                (userNik && item.nik === userNik) ||
                (userNama && item.nama.toLowerCase().trim() === userNama);
              return !isSelf;
            });
          }

          setAllQueue(fsCombined);
          setStatusMap((prev) => {
            const next = { ...prev };
            fsCombined.forEach((item) => {
              const fsStatus = (firestoreLeaves.find((s) => s.id === item.id)?.status || "diajukan") as any;
              next[item.id] = overrides[item.id]?.status || fsStatus;
            });
            return next;
          });
        }
      } catch (err) {
        console.warn("Sinkronisasi Firestore:", err);
      }
    };

    syncAll();
    window.addEventListener("storage", syncAll);
    return () => window.removeEventListener("storage", syncAll);
  }, [user]);

  // Periksa apakah item memerlukan tindakan pengguna saat ini
  const isPendingForUser = (itemId: string) => {
    const item = allQueue.find((q) => q.id === itemId);
    const st = statusMap[itemId] || item?.status || "diajukan";
    if (user?.peran === "atasan") {
      return st === "diajukan";
    }
    if (user?.peran === "hrd") {
      const bypassAtasan = (item as any)?.perlu_atasan === false || (item as any)?.tahap_persetujuan === "hrd";
      return st === "disetujui_atasan" || (st === "diajukan" && bypassAtasan);
    }
    return false;
  };

  const pendingCount = useMemo(() => {
    return allQueue.filter((item) => isPendingForUser(item.id)).length;
  }, [allQueue, statusMap, user?.peran]);

  const completedCount = useMemo(() => {
    return allQueue.filter((item) => !isPendingForUser(item.id)).length;
  }, [allQueue, statusMap, user?.peran]);

  // Antrean yang disaring berdasarkan Tab & Pencarian Sesuai PRD Bab 7
  const filteredQueue = useMemo(() => {
    return allQueue.filter((item) => {
      const matchesTab =
        filterTab === "perlu_tindakan"
          ? isPendingForUser(item.id)
          : !isPendingForUser(item.id);

      const matchesSearch =
        !searchQuery.trim() ||
        item.nama.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.nik.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.jenis.toLowerCase().includes(searchQuery.toLowerCase().trim());

      return matchesTab && matchesSearch;
    });
  }, [allQueue, filterTab, searchQuery, statusMap, user?.peran]);

  // Auto-switch selectedId bila item terpilih tidak ada di filteredQueue
  useEffect(() => {
    if (filteredQueue.length > 0 && !filteredQueue.some((item) => item.id === selectedId)) {
      setSelectedId(filteredQueue[0].id);
      setAlertError(null);
      setAlasanPenolakan("");
    }
  }, [filteredQueue, selectedId]);

  // Item aktif yang sedang dibuka
  const activeItem = useMemo(() => {
    const found = allQueue.find((q) => q.id === selectedId);
    if (found) return found;
    return filteredQueue[0] || allQueue[0] || DEFAULT_QUEUE[0];
  }, [selectedId, allQueue, filteredQueue]);

  const currentStatus = statusMap[activeItem.id] || "diajukan";
  const overrideInfo = overridesRecord[activeItem.id];

  // Hak akses tindakan
  const isActionable = useMemo(() => {
    if (!activeItem) return false;
    if (user?.peran === "atasan") {
      return currentStatus === "diajukan";
    }
    if (user?.peran === "hrd") {
      const bypassAtasan = (activeItem as any)?.perlu_atasan === false || (activeItem as any)?.tahap_persetujuan === "hrd";
      return currentStatus === "disetujui_atasan" || (currentStatus === "diajukan" && bypassAtasan);
    }
    return false;
  }, [user?.peran, currentStatus, activeItem]);

  // Handler Persetujuan
  const handleApprove = async () => {
    setAlertError(null);
    const isAtasan = user?.peran === "atasan";
    const newStatus = isAtasan ? "disetujui_atasan" : "disetujui";
    const approverRole = isAtasan ? (activeItem.atasan_jabatan || "Manajer Penjualan") : "Kepala HRD";
    const approverName = user?.nama_lengkap 
      ? `${user.nama_lengkap} (${approverRole})`
      : (isAtasan ? `${activeItem.atasan_nama} (${activeItem.atasan_jabatan})` : "Rina Kusumawardani (Kepala HRD)");
    const noteText = alasanPenolakan.trim();

    setStatusMap((prev) => ({ ...prev, [activeItem.id]: newStatus }));
    setOverridesRecord((prev) => ({
      ...prev,
      [activeItem.id]: {
        status: newStatus,
        approvedBy: approverName,
        approvedAt: new Date().toISOString(),
        alasanPenolakan: noteText || undefined,
        catatan: noteText || undefined,
      },
    }));

    await updateLeaveApprovalInFirestore(
      activeItem.id,
      newStatus,
      approverName,
      noteText || undefined,
      activeItem.jumlah_hari,
      activeItem.jenis,
      activeItem.karyawan_id
    );

    if (isAtasan) {
      setAlertSuccess(
        `Permohonan ${activeItem.nama} berhasil disetujui tahap 1.`
      );
    } else {
      setAlertSuccess(
        `Permohonan ${activeItem.nama} berhasil disetujui.`
      );
    }
    setAlasanPenolakan("");

    // PRD Bab 11: Integrasi Notifikasi Email
    const applicantEmail =
      (activeItem as any)?.email ||
      (activeItem.nama?.toLowerCase().includes("andi")
        ? "andi.wijaya@karsalintas.test"
        : activeItem.nama?.toLowerCase().includes("larasati")
        ? "larasati.dewi@karsalintas.test"
        : activeItem.nama?.toLowerCase().includes("putri")
        ? "putri.lestari@karsalintas.test"
        : activeItem.nama?.toLowerCase().includes("siti")
        ? "siti.nurhaliza@karsalintas.test"
        : `${activeItem.nama.toLowerCase().replace(/\s+/g, ".")}@karsalintas.test`);

    if (isAtasan) {
      // Email ke HRD saat pengajuan menunggu keputusan akhir (PRD Bab 11)
      sendEmailNotification({
        type: "LEAVE_PENDING_HRD",
        toEmail: "rina.kusumawardani@karsalintas.test",
        toName: "Rina Kusumawardani (Kepala HRD)",
        subject: `[KarsaHR] Menunggu Keputusan HRD: ${activeItem.jenis} - ${activeItem.nama}`,
        title: "Permohonan Cuti/Izin Menunggu Keputusan Akhir HRD",
        message: `Permohonan telah disetujui tahap 1 oleh Atasan (${approverName}) dan saat ini membutuhkan keputusan akhir HRD.`,
        badgeText: "Menunggu Keputusan HRD",
        badgeColor: "#d97706",
        summaryItems: [
          { label: "Pemohon", value: `${activeItem.nama} (${activeItem.nik})` },
          { label: "Divisi", value: activeItem.divisi },
          { label: "Jenis Pengajuan", value: activeItem.jenis },
          { label: "Periode", value: `${activeItem.tanggal_mulai} s/d ${activeItem.tanggal_selesai}` },
          { label: "Durasi Efektif", value: `${activeItem.jumlah_hari} Hari Kerja` },
          { label: "Disetujui Tahap 1", value: approverName },
        ],
        actionPath: "/persetujuan",
        actionText: "Proses Keputusan Akhir di KarsaHR",
      }).catch(() => {});

      // Email update ke Pemohon
      sendEmailNotification({
        type: "LEAVE_STATUS_UPDATED",
        toEmail: applicantEmail,
        toName: activeItem.nama,
        subject: `[KarsaHR] Update Pengajuan: Disetujui Tahap 1 oleh Atasan`,
        title: "Permohonan Anda Telah Disetujui Tahap 1",
        message: "Atasan divisi Anda telah menyetujui permohonan. Pengajuan kini diteruskan ke HRD untuk verifikasi akhir.",
        badgeText: "Disetujui Atasan",
        badgeColor: "#2563eb",
        summaryItems: [
          { label: "Jenis Pengajuan", value: activeItem.jenis },
          { label: "Periode", value: `${activeItem.tanggal_mulai} s/d ${activeItem.tanggal_selesai}` },
          { label: "Status Terkini", value: "Disetujui Tahap 1 (Menunggu HRD)" },
        ],
        actionPath: "/cuti",
        actionText: "Cek Status di KarsaHR",
      }).catch(() => {});
    } else {
      // Email ke Pemohon saat pengajuan disetujui akhir oleh HRD (PRD Bab 11)
      sendEmailNotification({
        type: "LEAVE_STATUS_UPDATED",
        toEmail: applicantEmail,
        toName: activeItem.nama,
        subject: `[KarsaHR] Pengajuan Disetujui: ${activeItem.jenis}`,
        title: "Selamat, Permohonan Cuti/Izin Anda Telah Disetujui",
        message: "Permohonan cuti/izin Anda telah disetujui sepenuhnya oleh pihak Manajemen dan HRD.",
        badgeText: "Disetujui Penuh",
        badgeColor: "#059669",
        summaryItems: [
          { label: "Jenis Pengajuan", value: activeItem.jenis },
          { label: "Periode", value: `${activeItem.tanggal_mulai} s/d ${activeItem.tanggal_selesai}` },
          { label: "Durasi Disetujui", value: `${activeItem.jumlah_hari} Hari Kerja` },
          { label: "Disetujui Oleh", value: approverName },
        ],
        actionPath: "/cuti",
        actionText: "Lihat Bukti Persetujuan",
      }).catch(() => {});
    }
  };

  // Handler Penolakan (PRD BR-09: Penolakan wajib disertai alasan minimal 10 karakter)
  const handleReject = async () => {
    setAlertError(null);
    if (alasanPenolakan.trim().length < 10) {
      setAlertError("Alasan penolakan bersifat wajib dan harus minimal 10 karakter (PRD BR-09).");
      return;
    }

    const isAtasan = user?.peran === "atasan";
    const rejecterRole = isAtasan ? (activeItem.atasan_jabatan || "Manajer Penjualan") : "Kepala HRD";
    const rejecterName = user?.nama_lengkap 
      ? `${user.nama_lengkap} (${rejecterRole})`
      : (isAtasan ? `${activeItem.atasan_nama} (${activeItem.atasan_jabatan})` : "Rina Kusumawardani (Kepala HRD)");
    const rejectReason = alasanPenolakan.trim();

    setStatusMap((prev) => ({ ...prev, [activeItem.id]: "ditolak" }));
    setOverridesRecord((prev) => ({
      ...prev,
      [activeItem.id]: {
        status: "ditolak",
        approvedBy: rejecterName,
        approvedAt: new Date().toISOString(),
        alasanPenolakan: rejectReason,
        catatan: rejectReason,
      },
    }));

    await updateLeaveApprovalInFirestore(
      activeItem.id,
      "ditolak",
      rejecterName,
      rejectReason,
      activeItem.jumlah_hari,
      activeItem.jenis,
      activeItem.karyawan_id
    );

    setAlertSuccess(
      `Permohonan ${activeItem.nama} telah ditolak.`
    );
    setAlasanPenolakan("");

    // PRD Bab 11: Email ke Pemohon saat pengajuan ditolak
    const applicantEmail =
      (activeItem as any)?.email ||
      (activeItem.nama?.toLowerCase().includes("andi")
        ? "andi.wijaya@karsalintas.test"
        : activeItem.nama?.toLowerCase().includes("larasati")
        ? "larasati.dewi@karsalintas.test"
        : activeItem.nama?.toLowerCase().includes("putri")
        ? "putri.lestari@karsalintas.test"
        : activeItem.nama?.toLowerCase().includes("siti")
        ? "siti.nurhaliza@karsalintas.test"
        : `${activeItem.nama.toLowerCase().replace(/\s+/g, ".")}@karsalintas.test`);

    sendEmailNotification({
      type: "LEAVE_STATUS_UPDATED",
      toEmail: applicantEmail,
      toName: activeItem.nama,
      subject: `[KarsaHR] Pemberitahuan Penolakan: ${activeItem.jenis}`,
      title: "Pemberitahuan Status Permohonan Cuti/Izin",
      message: "Mohon maaf, permohonan cuti/izin yang Anda ajukan belum dapat disetujui.",
      badgeText: "Ditolak",
      badgeColor: "#dc2626",
      summaryItems: [
        { label: "Jenis Pengajuan", value: activeItem.jenis },
        { label: "Periode", value: `${activeItem.tanggal_mulai} s/d ${activeItem.tanggal_selesai}` },
        { label: "Ditolak Oleh", value: rejecterName },
        { label: "Alasan Penolakan", value: rejectReason },
      ],
      note: `Alasan penolakan: "${rejectReason}". Kuota cuti Anda telah dikembalikan secara otomatis.`,
      actionPath: "/cuti",
      actionText: "Lihat Status di KarsaHR",
    }).catch(() => {});
  };

  const renderStatusBadge = (st: string) => {
    switch (st) {
      case "diajukan":
        return (
          <span className="badge-status-pill diajukan">
            <span className="badge-dot-indicator" /> Menunggu Tindakan
          </span>
        );
      case "disetujui_atasan":
        return (
          <span className="badge-status-pill disetujui_atasan">
            <span className="badge-dot-indicator" /> Disetujui Atasan
          </span>
        );
      case "disetujui":
        return (
          <span className="badge-status-pill disetujui">
            <span className="badge-dot-indicator" /> Disetujui Penuh
          </span>
        );
      case "ditolak":
        return (
          <span className="badge-status-pill ditolak">
            <span className="badge-dot-indicator" /> Ditolak
          </span>
        );
      case "dibatalkan":
        return (
          <span className="badge-status-pill dibatalkan">
            <span className="badge-dot-indicator" /> Dibatalkan
          </span>
        );
      default:
        return null;
    }
  };

  const kuotaPercentage = Math.round((activeItem.kuota_terpakai / activeItem.kuota_jatah) * 100);

  return (
    <>
      {/* Toast Notification Melayang di Pojok Kanan Atas (Auto-dismiss 4 detik) */}
      {alertSuccess && (
        <div className="floating-toast-container" role="status" aria-live="polite">
          <div className="floating-toast-body">
            <span className="floating-toast-icon">✓</span>
            <span className="floating-toast-message">{alertSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertSuccess(null)}
            className="floating-toast-close"
            title="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Viewport Pembungkus Utama (Full-Height Responsif) */}
      <div className="persetujuan-viewport">
        {/* Kontainer Utama Responsif (Max-Width 1480px & Centered dengan margin: 0 auto) */}
        <div className="persetujuan-main-container">
          
          {/* 1. Page Header (Membentang Penuh di Atas Grid Dua Kolom dengan margin-bottom 24px) */}
          <header className="persetujuan-page-header">
            <div className="header-title-box">
              <h1 className="page-heading">Persetujuan Cuti dan Izin</h1>
              <p className="page-subheading">
                {user?.peran === "atasan"
                  ? `Tinjau dan proses permohonan cuti untuk tim ${user?.divisi_nama || activeItem.divisi}`
                  : "Kelola dan tinjau seluruh permohonan cuti dan izin karyawan perusahaan"}
              </p>
            </div>

            <div className="header-badge-box">
              {pendingCount > 0 ? (
                <div className="topbar-pill-pending">
                  <span className="pulse-dot-blue"></span>
                  <span>{pendingCount} Permohonan Perlu Tindakan</span>
                </div>
              ) : (
                <div className="topbar-pill-done">
                  <span>✓</span>
                  <span>Semua Permohonan Selesai</span>
                </div>
              )}
            </div>
          </header>

          {/* 2. Grid Dua Kolom Responsif (Master-Detail): Sejajar Sempurna */}
          <div className="persetujuan-master-detail-grid">
            
            {/* Kolom Kiri: Kartu Container Putih Bersih (Lebar Tetap Proporsional 360px) */}
            <aside className="persetujuan-master-card">
          {/* Header Kotak Masuk dalam Kartu */}
          <div className="master-card-header">
            <div className="master-title-bar">
              <h2 className="master-main-title">Kotak Masuk Persetujuan</h2>
              <span className="master-counter-pill">
                {allQueue.length} Pengajuan
              </span>
            </div>

            {/* Segmented Control: Tab Perlu Tindakan & Riwayat Selesai Sesuai PRD Bab 7 */}
            <div className="persetujuan-tabs-wrap">
              <button
                type="button"
                onClick={() => setFilterTab("perlu_tindakan")}
                className={`persetujuan-tab-btn ${filterTab === "perlu_tindakan" ? "active" : ""}`}
              >
                <span>Perlu Tindakan ({pendingCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("riwayat_selesai")}
                className={`persetujuan-tab-btn ${filterTab === "riwayat_selesai" ? "active" : ""}`}
              >
                <span>Riwayat Selesai ({completedCount})</span>
              </button>
            </div>

            {/* Search Bar Input */}
            <div className="persetujuan-search-box">
              <svg className="search-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama pemohon atau NIK..."
                className="persetujuan-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="search-clear-btn"
                  title="Hapus filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List Item per Pengajuan (Independently Scrollable) */}
          <div className="persetujuan-master-scroll">
            {filteredQueue.length === 0 ? (
              <div className="inbox-empty-box">
                <div className="inbox-empty-icon-wrap">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h4 className="inbox-empty-title">
                  {searchQuery
                    ? "Permohonan tidak ditemukan"
                    : filterTab === "perlu_tindakan"
                    ? "Tidak ada permohonan tertunda"
                    : "Belum ada riwayat selesai"}
                </h4>
                <p className="inbox-empty-sub">
                  {searchQuery
                    ? `Tidak ditemukan permohonan untuk "${searchQuery}".`
                    : filterTab === "perlu_tindakan"
                    ? "Semua pengajuan cuti dan izin telah selesai ditinjau."
                    : "Permohonan yang telah diproses akan tercatat di sini."}
                </p>
              </div>
            ) : (
              filteredQueue.map((item) => {
                const st = statusMap[item.id] || "diajukan";
                const isSelected = item.id === activeItem.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setAlertError(null);
                      setAlasanPenolakan("");
                    }}
                    className={`inbox-card-item ${isSelected ? "selected" : ""}`}
                  >
                    {/* Baris 1: Nama Lengkap Pemohon dan Tanggal Diajukan di kanan */}
                    <div className="inbox-row-1">
                      <span className="inbox-employee-name">
                        {item.nama}
                      </span>
                      <span className="inbox-submitted-date">
                        {item.tanggal_pengajuan_singkat}
                      </span>
                    </div>

                    {/* Baris 2: Badge Tipe Cuti + Durasi */}
                    <div className="inbox-row-2">
                      <span className="badge-leave-soft">
                        {item.jenis}
                      </span>
                      <span className="badge-duration-pill">
                        {item.jumlah_hari} Hari Kerja
                      </span>
                    </div>

                    {/* Baris 3: Tanggal pengajuan singkat & Status Badge */}
                    <div className="inbox-row-3">
                      <span className="inbox-date-range">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        {item.tanggal_singkat}
                      </span>
                      {renderStatusBadge(st)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Kolom Kanan (Detail Stream: Top Alignment Sejajar Persis dengan Kolom Kiri) */}
        <main className="persetujuan-detail-stream">
            
            {/* Header Pengajuan yang Clean */}
            <div className="detail-header-panel">
              <div className="detail-header-top-row">
                <div>
                  <div className="detail-breadcrumb-bar">
                    <span>Persetujuan</span>
                    <span>/</span>
                    <span>Divisi {activeItem.divisi}</span>
                    <span>/</span>
                    <button
                      type="button"
                      className="detail-id-code"
                      title={`Klik untuk menyalin ID lengkap: ${activeItem.id}`}
                      onClick={() => handleCopyId(activeItem.id)}
                    >
                      <span>ID: {formatShortId(activeItem.id)}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}>
                        {copiedId ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </>
                        )}
                      </svg>
                      {copiedId && <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.625rem" }}>Tersalin</span>}
                    </button>
                  </div>
                  <h2 className="detail-main-heading">
                    Pengajuan {activeItem.jenis}: {activeItem.nama}
                  </h2>
                  <div className="detail-tags-row">
                    <span className="detail-pill-tag">
                      NIK: <strong>{activeItem.nik}</strong>
                    </span>
                    <span className="detail-pill-tag">
                      Divisi: <strong>{activeItem.divisi}</strong>
                    </span>
                    <span className="detail-pill-tag">
                      Jabatan: <strong>{activeItem.jabatan}</strong>
                    </span>
                  </div>
                </div>

                <div>
                  {renderStatusBadge(currentStatus)}
                </div>
              </div>

              <div className="detail-header-sub-row">
                <span>Diajukan pada <strong>{activeItem.tanggal_pengajuan}</strong></span>
                <span className="detail-dot-sep">•</span>
                <span>Atasan Langsung: <strong>{activeItem.atasan_nama}</strong> ({activeItem.atasan_jabatan})</span>
                <span className="detail-dot-sep">•</span>
                <span>Status Kepegawaian: <strong>{activeItem.status_kerja}</strong></span>
              </div>
            </div>

            {/* Banner Status: Kartu Keputusan Aktif jika Perlu Tindakan / Kartu Riwayat Keputusan Bersih jika Selesai */}
            {isActionable ? (
              <div className="decision-card-panel">
                <div className="decision-banner-top">
                  <div>
                    <h3 className="decision-banner-title">
                      <span className="decision-pulse-dot"></span>
                      Keputusan Persetujuan
                    </h3>
                    <p className="decision-banner-sub">
                      {user?.peran === "atasan"
                        ? `Verifikasi tahap awal oleh Atasan Divisi (${activeItem.atasan_nama}) sebelum diteruskan ke HRD.`
                        : "Persetujuan tahap akhir oleh Kepala HRD (Rina Kusumawardani)."}
                    </p>
                  </div>
                  <span className="decision-rule-badge">
                    Alasan wajib jika menolak
                  </span>
                </div>

                {alertError && (
                  <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "0.55rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 500 }}>
                    ⚠️ {alertError}
                  </div>
                )}

                <div className="decision-field-wrap">
                  <label className="decision-field-label">
                    Catatan Keputusan:
                  </label>
                  <textarea
                    rows={3}
                    value={alasanPenolakan}
                    onChange={(e) => setAlasanPenolakan(e.target.value)}
                    placeholder="Tulis catatan persetujuan atau alasan penolakan (wajib minimal 10 karakter bila menolak - BR-09)..."
                    className="decision-textarea-input"
                  />
                </div>

                <div className="decision-bottom-bar">
                  <div className="decision-btn-group">
                    <button
                      type="button"
                      onClick={handleApprove}
                      className="btn-enterprise-approve"
                    >
                      ✓ Setujui Permohonan
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      className="btn-enterprise-reject"
                    >
                      Tolak Permohonan
                    </button>
                  </div>
                  <p className="decision-legal-footnote">
                    {user?.peran === "atasan"
                      ? "Menyetujui pengajuan ini akan meneruskan berkas ke HRD untuk persetujuan akhir."
                      : "Menyetujui pengajuan ini akan otomatis memotong saldo cuti tahunan pemohon."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="decision-history-card">
                <div className="history-card-header">
                  <h3 className="history-card-title">
                    {currentStatus === "disetujui"
                      ? "Riwayat Keputusan Akhir"
                      : currentStatus === "disetujui_atasan"
                      ? "Riwayat Persetujuan Tahap 1"
                      : currentStatus === "ditolak"
                      ? "Riwayat Keputusan Permohonan"
                      : currentStatus === "diajukan"
                      ? "Menunggu Persetujuan Tahap 1 Atasan"
                      : "Riwayat Pembatalan"}
                  </h3>

                  {currentStatus === "disetujui" && (
                    <span className="badge-history-success">
                      <span className="badge-dot-green"></span>
                      Disetujui Penuh
                    </span>
                  )}
                  {currentStatus === "disetujui_atasan" && (
                    <span className="badge-history-blue">
                      <span className="badge-dot-blue-sm"></span>
                      Disetujui Atasan
                    </span>
                  )}
                  {currentStatus === "diajukan" && (
                    <span className="badge-history-blue" style={{ backgroundColor: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}>
                      <span className="badge-dot-blue-sm" style={{ backgroundColor: "#d97706" }}></span>
                      Menunggu Atasan
                    </span>
                  )}
                  {currentStatus === "ditolak" && (
                    <span className="badge-history-red">
                      <span className="badge-dot-red-sm"></span>
                      Ditolak
                    </span>
                  )}
                  {currentStatus === "dibatalkan" && (
                    <span className="badge-history-gray">
                      Dibatalkan Pemohon
                    </span>
                  )}
                </div>

                <div className="history-metadata-grid">
                  <div className="history-metadata-item">
                    <span className="history-meta-label">
                      {currentStatus === "ditolak" ? "Ditolak Oleh" : "Disetujui Oleh"}
                    </span>
                    <span className="history-meta-value">
                      {overrideInfo?.approvedBy ||
                        (currentStatus === "disetujui"
                          ? "Rina Kusumawardani (Kepala HRD)"
                          : currentStatus === "disetujui_atasan"
                          ? `${activeItem.atasan_nama} (${activeItem.atasan_jabatan})`
                          : currentStatus === "dibatalkan"
                          ? `${activeItem.nama} (Pemohon)`
                          : "Rina Kusumawardani (Kepala HRD)")}
                    </span>
                  </div>

                  <div className="history-metadata-item">
                    <span className="history-meta-label">
                      {currentStatus === "ditolak"
                        ? "Waktu Penolakan"
                        : currentStatus === "dibatalkan"
                        ? "Waktu Pembatalan"
                        : "Waktu Persetujuan"}
                    </span>
                    <span className="history-meta-value">
                      {overrideInfo?.approvedAt
                        ? new Date(overrideInfo.approvedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) + " WIB"
                        : activeItem.tanggal_pengajuan}
                    </span>
                  </div>

                  <div className="history-metadata-item full-width">
                    <span className="history-meta-label">
                      {currentStatus === "ditolak" ? "Alasan Penolakan" : "Catatan"}
                    </span>
                    <div className="history-note-box">
                      {overrideInfo?.alasanPenolakan ||
                        overrideInfo?.catatan ||
                        "Tidak ada catatan tambahan."}
                    </div>
                  </div>
                </div>

                <p className="history-card-footnote">
                  {currentStatus === "disetujui"
                    ? "Saldo cuti tahunan pemohon telah disesuaikan secara otomatis."
                    : currentStatus === "disetujui_atasan"
                    ? "Berkas menunggu verifikasi dan persetujuan tahap akhir dari Kepala HRD."
                    : currentStatus === "diajukan"
                    ? `Berkas masih menunggu verifikasi dan persetujuan tahap 1 dari Atasan Divisi (${activeItem.atasan_nama}) sebelum diteruskan ke Kepala HRD.`
                    : currentStatus === "ditolak"
                    ? "Permohonan tidak disetujui. Saldo cuti tahunan pemohon tetap utuh."
                    : "Permohonan telah dibatalkan secara mandiri oleh pemohon sebelum proses finalisasi."}
                </p>
              </div>
            )}

            {/* 3. Grid 2 Seimbang: 7 Kolom Utama : 5 Kolom Pendukung */}
            <div className="detail-columns-grid">
              
              {/* KOLOM UTAMA (xl:col-span-7) */}
              <div className="main-flow-col">
                
                {/* Card 1: Data Verifikasi Pemohon (Format tabel/grid 2 kolom rapi) */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">Data Verifikasi Pemohon</h3>
                      <p className="panel-subtitle">Detail identitas & informasi permohonan resmi</p>
                    </div>
                    <span className="panel-soft-badge">
                      {activeItem.jenis}
                    </span>
                  </div>

                  <div className="verification-grid">
                    <div>
                      <span className="verif-label">Nama Lengkap</span>
                      <p className="verif-val bold">{activeItem.nama}</p>
                    </div>

                    <div>
                      <span className="verif-label">Nomor Induk Karyawan</span>
                      <p className="verif-val">{activeItem.nik}</p>
                    </div>

                    <div>
                      <span className="verif-label">Divisi</span>
                      <p className="verif-val">{activeItem.divisi}</p>
                    </div>

                    <div>
                      <span className="verif-label">Jabatan</span>
                      <p className="verif-val">{activeItem.jabatan}</p>
                    </div>

                    <div>
                      <span className="verif-label">Status Kepegawaian</span>
                      <p className="verif-val">{activeItem.status_kerja}</p>
                    </div>

                    <div>
                      <span className="verif-label">Total Durasi</span>
                      <p className="verif-val highlight-blue">{activeItem.lama}</p>
                    </div>

                    <div className="verif-full-span">
                      <span className="verif-label">Rentang Tanggal Pengajuan</span>
                      <p className="verif-val bold" style={{ fontSize: "0.875rem" }}>{activeItem.tanggal_teks}</p>
                      <span className="verif-hint">
                        Durasi dihitung berdasarkan hari kerja efektif (di luar akhir pekan dan hari libur nasional).
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Alasan Pengajuan & Lampiran Dokumen Surat Dokter */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">Alasan Pengajuan & Berkas Lampiran</h3>
                      <p className="panel-subtitle">Keterangan tertulis & dokumen pembuktian</p>
                    </div>
                    <span className="panel-count-badge">
                      {activeItem.lampiran ? "1 Lampiran" : "Tanpa Lampiran"}
                    </span>
                  </div>

                  <div>
                    <span className="verif-label">Alasan Pengajuan Tertulis:</span>
                    <blockquote className="reason-blockquote">
                      "{activeItem.alasan}"
                    </blockquote>
                  </div>

                  <div>
                    <span className="verif-label">Lampiran Dokumen Surat Dokter:</span>
                    {activeItem.lampiran ? (
                      <div className="attachment-file-panel">
                        <div className="file-left-cluster">
                          <div className="file-icon-badge">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                          </div>
                          <div className="file-meta-col">
                            <h4 className="file-name-text">
                              {activeItem.lampiran.nama}
                            </h4>
                            <p className="file-spec-text">
                              {activeItem.lampiran.tipe} • {activeItem.lampiran.ukuran} • <span className="file-status-verified">Terverifikasi</span>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert(`Membuka berkas: ${activeItem.lampiran?.nama}`)}
                          className="btn-file-action"
                        >
                          Lihat Dokumen
                        </button>
                      </div>
                    ) : (
                      <div className="empty-doc-box">
                        <p className="empty-doc-title">Tidak ada berkas lampiran yang diunggah.</p>
                        <p className="empty-doc-sub">
                          Surat keterangan dokter dari fasilitas kesehatan dianjurkan bila pengajuan sakit lebih dari 1 hari kerja.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* KOLOM PENDUKUNG (xl:col-span-5) */}
              <div className="side-flow-col">
                
                {/* Card Kuota Cuti Pemohon */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">Kuota Cuti Pemohon</h3>
                      <p className="panel-subtitle">Saldo hak cuti tahunan berjalan</p>
                    </div>
                    <span className="panel-count-badge">Tahun 2026</span>
                  </div>

                  <div className="quota-tri-grid">
                    <div className="quota-metric-tile">
                      <span className="quota-tile-caption">Jatah</span>
                      <span className="quota-tile-number">{activeItem.kuota_jatah}</span>
                    </div>
                    <div className="quota-metric-tile">
                      <span className="quota-tile-caption">Terpakai</span>
                      <span className="quota-tile-number amber">{activeItem.kuota_terpakai}</span>
                    </div>
                    <div className="quota-metric-tile highlight">
                      <span className="quota-tile-caption" style={{ color: "#1e40af", fontWeight: 600 }}>Sisa Kuota</span>
                      <span className="quota-tile-number blue">{activeItem.kuota_sisa}</span>
                    </div>
                  </div>

                  <div>
                    <div className="progress-legend-row">
                      <span>Terpakai: {activeItem.kuota_terpakai} Hari</span>
                      <span>Sisa: {activeItem.kuota_sisa} Hari</span>
                    </div>
                    <div className="progress-track-rail">
                      <div
                        className="progress-fill-bar"
                        style={{ width: `${kuotaPercentage}%` }}
                      ></div>
                    </div>
                    <p className="quota-note-caption">
                      Tersisa <strong>{activeItem.kuota_sisa}</strong> dari total <strong>{activeItem.kuota_jatah}</strong> hari jatah cuti tahunan berjalan.
                    </p>
                  </div>
                </div>

                {/* Card Riwayat Alur Persetujuan (Vertical Stepper) */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">Alur Persetujuan</h3>
                      <p className="panel-subtitle">Tahapan otorisasi berjenjang</p>
                    </div>
                    <span className="panel-count-badge">
                      {currentStatus === "disetujui"
                        ? "Tahap 2 Selesai"
                        : currentStatus === "disetujui_atasan"
                        ? "Tahap 1 Selesai"
                        : currentStatus === "ditolak"
                        ? "Ditolak"
                        : "Tahap 1"}
                    </span>
                  </div>

                  <div className="stepper-timeline">
                    {/* Step 1: Pengajuan */}
                    <div className="stepper-node done">
                      <div className="stepper-circle">
                        ✓
                      </div>
                      <div className="stepper-text-col">
                        <h4 className="stepper-main-text">
                          Diajukan oleh {activeItem.nama}
                        </h4>
                        <p className="stepper-sub-text">
                          {activeItem.tanggal_pengajuan}
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Atasan Divisi */}
                    <div
                      className={`stepper-node ${
                        currentStatus === "disetujui_atasan" || currentStatus === "disetujui"
                          ? "done"
                          : currentStatus === "ditolak"
                          ? "failed"
                          : "current"
                      }`}
                    >
                      <div className="stepper-circle">
                        {currentStatus === "disetujui_atasan" || currentStatus === "disetujui"
                          ? "✓"
                          : currentStatus === "ditolak"
                          ? "✕"
                          : "2"}
                      </div>
                      <div className="stepper-text-col">
                        <h4 className="stepper-main-text">
                          {currentStatus === "diajukan"
                            ? `Menunggu Verifikasi: ${activeItem.atasan_nama}`
                            : currentStatus === "ditolak"
                            ? `Ditolak oleh Atasan (${activeItem.atasan_nama})`
                            : `Disetujui oleh Atasan (${activeItem.atasan_nama})`}
                        </h4>
                        <p className="stepper-sub-text">
                          Tahap 1 • Verifikasi Atasan Divisi ({activeItem.atasan_jabatan})
                        </p>
                      </div>
                    </div>

                    {/* Step 3: HRD */}
                    <div
                      className={`stepper-node ${
                        currentStatus === "disetujui"
                          ? "done"
                          : currentStatus === "disetujui_atasan"
                          ? "current"
                          : ""
                      }`}
                    >
                      <div className="stepper-circle">
                        {currentStatus === "disetujui" ? "✓" : "3"}
                      </div>
                      <div className="stepper-text-col">
                        <h4 className="stepper-main-text">
                          {currentStatus === "disetujui"
                            ? "Disetujui Final oleh HRD (Rina Kusumawardani)"
                            : "Persetujuan Tahap Akhir Kepala HRD"}
                        </h4>
                        <p className="stepper-sub-text">
                          Tahap 2 • Otorisasi Final & Penyesuaian Saldo Cuti
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Jadwal Tim Divisi yang Cuti di Tanggal Berdekatan */}
                <div className="panel-card">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">
                        Tim Divisi {activeItem.divisi}
                      </h3>
                      <p className="panel-subtitle">
                        Ketersediaan tim di sekitar rentang tanggal ini
                      </p>
                    </div>
                    <span className="panel-count-badge">
                      {activeItem.rekan_cuti.length} Rekan Cuti
                    </span>
                  </div>

                  <div className="team-conflict-panel">
                    {activeItem.rekan_cuti.map((rk, idx) => (
                      <div key={idx} className="team-member-tile">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
                          <div className="team-avatar-initials">
                            {rk.nama.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="team-desc-col">
                            <h4 className="team-member-name">{rk.nama}</h4>
                            <span className="team-dates-text">{rk.tanggal}</span>
                          </div>
                        </div>
                        <span className={`team-status-tag ${rk.status}`}>
                          {rk.status === "disetujui" ? "Disetujui" : "Disetujui Atasan"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
          </div>
        </div>
      </div>
    </>
  );
}
