"use client";

import React, { useState, useMemo, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { formatRupiah } from "@/lib/utils/time";
import { db } from "@/lib/firebase/config";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import slipGajiData from "../../../data/seeds/slip_gaji.json";
import profilesData from "../../../data/seeds/profiles.json";
import { sendEmailNotification } from "@/lib/email/email-service";
import "./slip-gaji.css";

const SLIP_STORE_KEY = "karsahr_slip_gaji_store";

// Pemetaan ID/UID staf HRD resmi KarsaHR
const KNOWN_HRD_MAP: Record<string, string> = {
  "8db8c644-85b2-5327-97fa-5fa1cfee7801": "Dimas Pratama",
  "391a65a7-cf37-5806-8e65-bba91e3c42e4": "Rina Kusumawardani",
  "381x85a7-c137-5808-8e65-bba91e3c42e4": "Dimas Pratama",
  "zWqL5bLluKUK2X95Rmf3d2Ft5Hy2": "Rina Kusumawardani",
  "hrd-rina": "Rina Kusumawardani",
  "hrd-dimas": "Dimas Pratama",
};

// Format Waktu Terbit Resmi: "25 Agustus 2026 pukul 10.00 WIB"
const formatWaktuTerbit = (isoStr: string | null | undefined): string => {
  if (!isoStr) return "Belum Diterbitkan";
  try {
    const dt = new Date(isoStr);
    if (isNaN(dt.getTime())) return isoStr;
    const bulanIndo = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const day = dt.getDate();
    const month = bulanIndo[dt.getMonth()];
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, "0");
    const minutes = String(dt.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} pukul ${hours}.${minutes} WIB`;
  } catch {
    return isoStr;
  }
};

// Helper sinkron lookup nama staf HRD penerbit slip gaji
const getPublisherNameSync = (
  rawPenerbit: string | null | undefined,
  profileMap: Map<string, { nik: string; nama: string; divisi: string; jabatan: string; status_kerja: string }>,
  additionalProfiles: any[] = []
): string => {
  if (!rawPenerbit || typeof rawPenerbit !== "string" || rawPenerbit.trim() === "") {
    return "Bagian HR & Payroll";
  }

  const clean = rawPenerbit.trim();

  // 1. Cek kamus ID HRD yang umum / seed
  if (KNOWN_HRD_MAP[clean]) {
    return KNOWN_HRD_MAP[clean];
  }

  // 2. Cek apakah sudah berupa nama resmi (bukan UUID / UID tanpa spasi)
  const isLikelyUid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean) ||
    /^[0-9a-zA-Z]{20,}$/.test(clean) ||
    clean.includes("381x") ||
    clean.includes("391a") ||
    clean.startsWith("hrd-");

  if (!isLikelyUid && clean.includes(" ") && clean.length > 3) {
    return clean;
  }

  // 3. Lookup dari profileMap yang dibuat dari seeds
  const fromMap = profileMap.get(clean);
  if (fromMap?.nama) {
    return fromMap.nama;
  }

  // 4. Lookup dari seed profilesData secara langsung
  const fromSeed = (profilesData as Array<any>).find(
    (p) =>
      p.id === clean ||
      p.nik_karyawan === clean ||
      p.email?.toLowerCase() === clean.toLowerCase()
  );
  if (fromSeed?.nama_lengkap) {
    return fromSeed.nama_lengkap;
  }

  // 5. Lookup dari data profil tambahan (Firestore)
  const fromAdditional = additionalProfiles.find(
    (p) =>
      p.id === clean ||
      p.uid === clean ||
      p.nik_karyawan === clean ||
      p.email?.toLowerCase() === clean.toLowerCase()
  );
  if (fromAdditional?.nama_lengkap || fromAdditional?.nama) {
    return fromAdditional.nama_lengkap || fromAdditional.nama;
  }

  // 6. Cek cache localStorage jika ada
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("karsahr_profiles_overrides");
      if (stored) {
        const parsed = JSON.parse(stored);
        const match = parsed.find(
          (p: any) =>
            p.id === clean ||
            p.uid === clean ||
            p.nik_karyawan === clean ||
            p.email?.toLowerCase() === clean.toLowerCase()
        );
        if (match?.nama_lengkap) return match.nama_lengkap;
      }
    } catch {}
  }

  // Fallback aman sesuai PRD & wireframe
  return "Bagian HR & Payroll";
};

export interface SlipRecord {
  id: string;
  nomor_slip: string | null;
  karyawan_id: string;
  periode: string; // YYYY-MM-01
  gaji_pokok: number;
  tunjangan: number;
  potongan: number;
  total_diterima: number;
  catatan?: string | null;
  status: "draf" | "terbit";
  dibuat_oleh?: string | null;
  diterbitkan_oleh?: string | null;
  diterbitkan_pada?: string | null;
  dibuat_pada?: string | null;
  "nama (bantu)"?: string | null;
}

const PERIODE_OPTIONS = [
  { value: "2026-10-01", label: "Oktober 2026" },
  { value: "2026-09-01", label: "September 2026" },
  { value: "2026-08-01", label: "Agustus 2026" },
  { value: "2026-11-01", label: "November 2026" },
];

export default function SlipGajiPage() {
  const { user } = useAuth();
  const [selectedPeriode, setSelectedPeriode] = useState("2026-10-01");
  const [statusFilter, setStatusFilter] = useState<"semua" | "draf" | "terbit">("semua");
  const [selectedSlipDetail, setSelectedSlipDetail] = useState<any | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<SlipRecord | null>(null);

  // Form Fields for Create / Edit
  const [formKaryawanId, setFormKaryawanId] = useState("");
  const [formGajiPokok, setFormGajiPokok] = useState<number>(5000000);
  const [formTunjangan, setFormTunjangan] = useState<number>(1000000);
  const [formPotongan, setFormPotongan] = useState<number>(200000);
  const [formCatatan, setFormCatatan] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State nama penerbit resmi pada modal slip gaji & cache profil Firestore
  const [publisherName, setPublisherName] = useState<string>("Bagian HR & Payroll");
  const [firestoreProfiles, setFirestoreProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Ambil profil dari Firestore saat halaman dimuat untuk lookup akurat nama staf HRD
  useEffect(() => {
    let isMounted = true;
    async function loadFirestoreProfiles() {
      try {
        const snap = await getDocs(collection(db, "profiles"));
        if (!snap.empty && isMounted) {
          const list: any[] = [];
          snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
          setFirestoreProfiles(list);
        }
      } catch (err) {
        // Fallback hening jika offline / permission
      }
    }
    loadFirestoreProfiles();
    return () => {
      isMounted = false;
    };
  }, []);

  // Master Slips Data Store (Persistent in localStorage)
  const [allSlips, setAllSlips] = useState<SlipRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SLIP_STORE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error("Gagal membaca slip gaji dari storage", e);
      }
    }
    return slipGajiData as SlipRecord[];
  });

  const saveSlips = (updated: SlipRecord[]) => {
    setAllSlips(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SLIP_STORE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.error("Gagal menyimpan slip gaji", e);
      }
    }
  };

  // Lookup profile karyawan lengkap
  const profileMap = useMemo(() => {
    const map = new Map<string, { nik: string; nama: string; divisi: string; jabatan: string; status_kerja: string }>();
    (profilesData as Array<any>).forEach((p) => {
      map.set(p.id, {
        nik: p.nik_karyawan,
        nama: p.nama_lengkap,
        divisi: p["divisi (bantu)"] || "Operasional",
        jabatan: p.jabatan || "Staff",
        status_kerja: p.status_kerja === "tetap" ? "Karyawan Tetap" : "Karyawan Kontrak",
      });
    });
    return map;
  }, []);

  // PRD BR-11: Membuka data slip gaji anggota divisi lewat URL atau API tidak menampilkan data apa pun
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKaryawanId = urlParams.get("karyawan_id") || urlParams.get("karyawanId");
      const urlSlipId = urlParams.get("id");

      const myId = user.id;
      const mySeedId = (user as any)?.seed_id;
      const myNik = user.nik_karyawan;

      if (user.peran === "atasan") {
        if (urlKaryawanId && urlKaryawanId !== myId && urlKaryawanId !== mySeedId && urlKaryawanId !== myNik) {
          setSelectedSlipDetail(null);
          setToastMessage("Akses ditolak: Gaji bersifat rahasia. Atasan tidak dapat melihat gaji anggota divisinya (PRD BR-11).");
          return;
        }
        if (urlSlipId) {
          const s = allSlips.find((item) => item.id === urlSlipId);
          if (s && s.karyawan_id !== myId && s.karyawan_id !== mySeedId && s.karyawan_id !== myNik) {
            setSelectedSlipDetail(null);
            setToastMessage("Akses ditolak: Gaji bersifat rahasia. Atasan tidak dapat melihat gaji anggota divisinya (PRD BR-11).");
            return;
          }
        }
      } else if (user.peran === "karyawan") {
        if (urlKaryawanId && urlKaryawanId !== myId && urlKaryawanId !== mySeedId && urlKaryawanId !== myNik) {
          setSelectedSlipDetail(null);
          setToastMessage("Akses ditolak: Karyawan hanya dapat melihat slip gaji miliknya sendiri yang sudah terbit (PRD BR-11).");
          return;
        }
        if (urlSlipId) {
          const s = allSlips.find((item) => item.id === urlSlipId);
          if (s && ((s.karyawan_id !== myId && s.karyawan_id !== mySeedId && s.karyawan_id !== myNik) || s.status !== "terbit")) {
            setSelectedSlipDetail(null);
            setToastMessage("Akses ditolak: Karyawan hanya dapat melihat slip gaji miliknya sendiri yang sudah terbit (PRD BR-11).");
            return;
          }
        }
      }
    } catch (e) {}
  }, [user, allSlips]);

  // Lookup nama penerbit resmi setiap kali modal slip dibuka / selectedSlipDetail berubah
  useEffect(() => {
    if (!selectedSlipDetail) return;

    const rawPenerbit = selectedSlipDetail.diterbitkan_oleh;
    const initialName = getPublisherNameSync(rawPenerbit, profileMap, firestoreProfiles);
    setPublisherName(initialName);

    // Jika belum ketemu di data lokal dan merupakan format UID / Doc ID, lakukan query ke Firestore
    const isLikelyUid =
      rawPenerbit &&
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPenerbit) ||
        /^[0-9a-zA-Z]{20,}$/.test(rawPenerbit) ||
        rawPenerbit.includes("381x") ||
        rawPenerbit.includes("391a"));

    if (isLikelyUid && initialName === "Bagian HR & Payroll") {
      let active = true;
      async function queryPublisher() {
        try {
          const docRef = doc(db, "profiles", rawPenerbit);
          const snap = await getDoc(docRef);
          if (snap.exists() && active) {
            const data = snap.data();
            const foundName = data.nama_lengkap || data.nama;
            if (foundName) {
              setPublisherName(foundName);
              return;
            }
          }

          const q = query(collection(db, "profiles"), where("id", "==", rawPenerbit));
          const qSnap = await getDocs(q);
          if (!qSnap.empty && active) {
            const data = qSnap.docs[0].data();
            const foundName = data.nama_lengkap || data.nama;
            if (foundName) {
              setPublisherName(foundName);
            }
          }
        } catch (err) {
          console.warn("Firestore lookup penerbit slip error:", err);
        }
      }
      queryPublisher();
      return () => {
        active = false;
      };
    }
  }, [selectedSlipDetail, profileMap, firestoreProfiles]);

  // Format Nama Periode (e.g. 2026-10-01 -> Oktober 2026)
  const formatPeriodeDisplay = (periodeStr: string) => {
    if (!periodeStr) return "-";
    const opt = PERIODE_OPTIONS.find((o) => o.value.slice(0, 7) === periodeStr.slice(0, 7));
    if (opt) return opt.label;
    const parts = periodeStr.split("-");
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${monthNames[mIdx] || parts[1]} ${parts[0]}`;
  };

  // Format angka tunjangan (+) dan potongan (-) akuntansi rapat
  const formatTunjangan = (amount: number) => {
    return `+Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
  };

  const formatPotongan = (amount: number) => {
    return `-Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
  };

  // Helper pencocokan periode fleksibel (YYYY-MM)
  const isMatchingPeriode = (p1: string, p2: string) => {
    if (!p1 || !p2) return false;
    return p1.slice(0, 7) === p2.slice(0, 7);
  };

  // Daftar slip untuk periode yang dipilih (sebelum filter status)
  const slipsInSelectedPeriod = useMemo(() => {
    return allSlips.filter((s) => isMatchingPeriode(s.periode, selectedPeriode));
  }, [allSlips, selectedPeriode]);

  // Hitung jumlah Draf & Terbit pada periode yang dipilih
  const draftCount = useMemo(() => {
    return slipsInSelectedPeriod.filter((s) => s.status === "draf").length;
  }, [slipsInSelectedPeriod]);

  const publishedCount = useMemo(() => {
    return slipsInSelectedPeriod.filter((s) => s.status === "terbit").length;
  }, [slipsInSelectedPeriod]);

  // Filter slip gaji berdasarkan peran & tab status
  // PRD BR-11: Karyawan hanya melihat miliknya yang sudah terbit; HRD melihat semua karyawan per periode
  const displayedSlips = useMemo(() => {
    let list: SlipRecord[] = [];

    if (user?.peran === "hrd") {
      // HRD: Seluruh karyawan untuk periode yang dipilih
      list = slipsInSelectedPeriod;

      // Filter status
      if (statusFilter === "draf") {
        list = list.filter((s) => s.status === "draf");
      } else if (statusFilter === "terbit") {
        list = list.filter((s) => s.status === "terbit");
      }
    } else {
      // Karyawan & Atasan: hanya melihat slip miliknya sendiri yang sudah 'terbit' (PRD BR-11)
      const myId = user?.id;
      const mySeedId = (user as any)?.seed_id;
      const myNik = user?.nik_karyawan;

      list = allSlips.filter((s) => {
        const p = profileMap.get(s.karyawan_id);
        const isMatch = s.karyawan_id === myId || s.karyawan_id === mySeedId || (myNik && p?.nik === myNik);
        return isMatch && s.status === "terbit";
      });
    }

    return list.map((s) => {
      const p = profileMap.get(s.karyawan_id);
      return {
        ...s,
        nik: p?.nik || "KLN-0000",
        nama: s["nama (bantu)"] || p?.nama || "Karyawan",
        divisi: p?.divisi || "Divisi Operasional",
        jabatan: p?.jabatan || "Staff",
        status_kerja: p?.status_kerja || "Karyawan Tetap",
      };
    });
  }, [user, allSlips, slipsInSelectedPeriod, statusFilter, profileMap]);

  // List karyawan yang belum punya slip di periode terpilih (untuk dropdown buat slip)
  const availableEmployeesForNewSlip = useMemo(() => {
    const existingIds = new Set(slipsInSelectedPeriod.map((s) => s.karyawan_id));
    return (profilesData as Array<any>).filter((p) => p.aktif && !existingIds.has(p.id));
  }, [slipsInSelectedPeriod]);

  // Generate nomor slip berurutan SG-TTTTBB-NNN (PRD BR-12)
  const generateNextSlipNumber = (periodeStr: string, currentSlipsList: SlipRecord[]): string => {
    const yyyy = periodeStr.slice(0, 4);
    const mm = periodeStr.slice(5, 7);
    const prefix = `SG-${yyyy}${mm}-`;

    const existingNums = currentSlipsList
      .filter((s) => s.nomor_slip && s.nomor_slip.startsWith(prefix))
      .map((s) => {
        const numPart = s.nomor_slip?.replace(prefix, "") || "0";
        return parseInt(numPart, 10);
      })
      .filter((n) => !isNaN(n));

    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const nextSeq = String(maxNum + 1).padStart(3, "0");
    return `${prefix}${nextSeq}`;
  };

  // Handler: Buat Draf Baru
  const handleOpenCreateModal = () => {
    setFormError(null);
    if (availableEmployeesForNewSlip.length > 0) {
      const first = availableEmployeesForNewSlip[0];
      setFormKaryawanId(first.id);
      setFormGajiPokok(first.jabatan?.toLowerCase().includes("manajer") ? 16000000 : 6500000);
      setFormTunjangan(1200000);
      setFormPotongan(250000);
    } else {
      setFormKaryawanId("");
      setFormGajiPokok(5000000);
      setFormTunjangan(1000000);
      setFormPotongan(200000);
    }
    setFormCatatan("Tunjangan operasional & iuran BPJS");
    setIsCreateModalOpen(true);
  };

  const handleSaveNewDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formKaryawanId) {
      setFormError("Silakan pilih karyawan terlebih dahulu.");
      return;
    }

    const total = formGajiPokok + formTunjangan - formPotongan;
    if (formGajiPokok < 0 || formTunjangan < 0 || formPotongan < 0 || total < 0) {
      setFormError("Komponen gaji dan total diterima tidak boleh bernilai negatif.");
      return;
    }

    const empProfile = profileMap.get(formKaryawanId);
    const newRecord: SlipRecord = {
      id: "slip-manual-" + Date.now(),
      nomor_slip: null,
      karyawan_id: formKaryawanId,
      periode: selectedPeriode,
      gaji_pokok: formGajiPokok,
      tunjangan: formTunjangan,
      potongan: formPotongan,
      total_diterima: total,
      catatan: formCatatan.trim() || null,
      status: "draf",
      dibuat_oleh: user?.id || "hrd-rina",
      diterbitkan_oleh: null,
      diterbitkan_pada: null,
      dibuat_pada: new Date().toISOString(),
      "nama (bantu)": empProfile?.nama,
    };

    const nextSlips = [newRecord, ...allSlips];
    saveSlips(nextSlips);
    setIsCreateModalOpen(false);
    setToastMessage(`Draf slip gaji untuk ${empProfile?.nama || "karyawan"} berhasil dibuat.`);
  };

  // Handler: Edit Draf
  const handleOpenEditModal = (slip: SlipRecord) => {
    setFormError(null);
    setEditingSlip(slip);
    setFormKaryawanId(slip.karyawan_id);
    setFormGajiPokok(slip.gaji_pokok);
    setFormTunjangan(slip.tunjangan);
    setFormPotongan(slip.potongan);
    setFormCatatan(slip.catatan || "");
  };

  const handleSaveEditedDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlip) return;

    const total = formGajiPokok + formTunjangan - formPotongan;
    if (formGajiPokok < 0 || formTunjangan < 0 || formPotongan < 0 || total < 0) {
      setFormError("Komponen gaji dan total diterima tidak boleh bernilai negatif.");
      return;
    }

    const nextSlips = allSlips.map((s) => {
      if (s.id === editingSlip.id) {
        return {
          ...s,
          gaji_pokok: formGajiPokok,
          tunjangan: formTunjangan,
          potongan: formPotongan,
          total_diterima: total,
          catatan: formCatatan.trim() || null,
        };
      }
      return s;
    });

    saveSlips(nextSlips);
    setEditingSlip(null);
    setToastMessage(`Draf slip gaji ${editingSlip["nama (bantu)"] || "karyawan"} berhasil diperbarui.`);
  };

  // Handler: Salin dari Periode Sebelumnya (PRD Bab 7)
  const handleCopyFromPreviousPeriod = () => {
    // Tentukan periode sebelumnya (misal 2026-10-01 -> 2026-09-01)
    const curYear = parseInt(selectedPeriode.slice(0, 4), 10);
    const curMonth = parseInt(selectedPeriode.slice(5, 7), 10);

    let prevYear = curYear;
    let prevMonth = curMonth - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevPeriodeStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

    const prevSlips = allSlips.filter((s) => isMatchingPeriode(s.periode, prevPeriodeStr));
    if (prevSlips.length === 0) {
      alert(`Tidak ditemukan data slip gaji pada periode sebelumnya (${formatPeriodeDisplay(prevPeriodeStr)}).`);
      return;
    }

    // Ambil karyawan yang belum punya slip di periode saat ini
    const existingEmpIds = new Set(slipsInSelectedPeriod.map((s) => s.karyawan_id));
    const toCopy = prevSlips.filter((s) => !existingEmpIds.has(s.karyawan_id));

    if (toCopy.length === 0) {
      alert(`Seluruh karyawan sudah memiliki draf/slip pada periode ${formatPeriodeDisplay(selectedPeriode)}.`);
      return;
    }

    const newCopies: SlipRecord[] = toCopy.map((s, idx) => ({
      id: "slip-copy-" + Date.now() + "-" + idx,
      nomor_slip: null,
      karyawan_id: s.karyawan_id,
      periode: selectedPeriode,
      gaji_pokok: s.gaji_pokok,
      tunjangan: s.tunjangan,
      potongan: s.potongan,
      total_diterima: s.total_diterima,
      catatan: s.catatan || "Disalin dari periode sebelumnya",
      status: "draf",
      dibuat_oleh: user?.id || "hrd-rina",
      diterbitkan_oleh: null,
      diterbitkan_pada: null,
      dibuat_pada: new Date().toISOString(),
      "nama (bantu)": s["nama (bantu)"],
    }));

    const nextSlips = [...newCopies, ...allSlips];
    saveSlips(nextSlips);
    setToastMessage(`Berhasil menyalin ${newCopies.length} draf slip gaji dari ${formatPeriodeDisplay(prevPeriodeStr)}.`);
  };

  // Helper pencarian email karyawan untuk notifikasi terbit slip (PRD Bab 11)
  const resolveEmployeeEmail = (slip: SlipRecord): { name: string; email: string } => {
    const empName = slip["nama (bantu)"] || "Karyawan";
    const empId = slip.karyawan_id;
    const p = (profilesData as Array<any>).find(
      (x) => x.id === empId || x.nik_karyawan === empId || x.nama_lengkap === empName
    );
    if (p?.email) return { name: p.nama_lengkap, email: p.email };
    if (empName.toLowerCase().includes("andi")) return { name: "Andi Wijaya", email: "andi.wijaya@karsalintas.test" };
    if (empName.toLowerCase().includes("siti")) return { name: "Siti Nurhaliza", email: "siti.nurhaliza@karsalintas.test" };
    if (empName.toLowerCase().includes("maya")) return { name: "Maya Anggraini", email: "maya.anggraini@karsalintas.test" };
    if (empName.toLowerCase().includes("bayu")) return { name: "Bayu Setiawan", email: "bayu.setiawan@karsalintas.test" };
    if (empName.toLowerCase().includes("rina")) return { name: "Rina Kusumawardani", email: "rina.kusumawardani@karsalintas.test" };
    if (empName.toLowerCase().includes("dimas")) return { name: "Dimas Pratama", email: "dimas.pratama@karsalintas.test" };
    return {
      name: empName,
      email: `${empName.toLowerCase().replace(/\s+/g, ".")}@karsalintas.test`,
    };
  };

  // Handler: Terbitkan Single Slip
  const handlePublishSingle = (slip: SlipRecord) => {
    if (slip.status === "terbit") return;

    const newSlipNum = generateNextSlipNumber(selectedPeriode, allSlips);
    const approverName = user?.nama_lengkap || "Rina Kusumawardani (Kepala HRD)";

    const nextSlips = allSlips.map((s) => {
      if (s.id === slip.id) {
        return {
          ...s,
          nomor_slip: newSlipNum,
          status: "terbit" as const,
          diterbitkan_oleh: approverName,
          diterbitkan_pada: new Date().toISOString(),
        };
      }
      return s;
    });

    saveSlips(nextSlips);
    setToastMessage(`Slip gaji ${slip["nama (bantu)"] || "karyawan"} berhasil diterbitkan (${newSlipNum}).`);

    // PRD Bab 11 & BR-11: Email ke karyawan saat slip gaji terbit, berisi tautan saja tanpa nominal gaji
    const target = resolveEmployeeEmail(slip);
    sendEmailNotification({
      type: "PAYROLL_PUBLISHED",
      toEmail: target.email,
      toName: target.name,
      subject: `[KarsaHR] Slip Gaji Periode ${formatPeriodeDisplay(selectedPeriode)} Telah Terbit`,
      title: "Pemberitahuan Terbit Slip Gaji Karyawan",
      message: `Slip gaji Anda untuk periode ${formatPeriodeDisplay(selectedPeriode)} telah resmi diterbitkan oleh Tim HRD & Payroll.`,
      badgeText: "Slip Gaji Terbit",
      badgeColor: "#7c3aed",
      summaryItems: [
        { label: "Nama Karyawan", value: target.name },
        { label: "Periode Gaji", value: formatPeriodeDisplay(selectedPeriode) },
        { label: "Nomor Dokumen", value: newSlipNum },
        { label: "Kerahasiaan (BR-11)", value: "Nominal dirahasiakan dalam email" },
      ],
      note: "Sesuai aturan keamanan dan privasi data finansial (BR-11), nominal rincian gaji tidak dicantumkan di badan email. Silakan masuk ke aplikasi KarsaHR untuk mengunduh atau mencetak slip gaji resmi Anda.",
      actionPath: "/slip-gaji",
      actionText: "Buka Slip Gaji di KarsaHR",
    }).catch(() => {});
  };

  // Handler: Terbitkan Semua Draf Sekaligus (PRD BR-12)
  const handlePublishAllDrafts = () => {
    const drafts = slipsInSelectedPeriod.filter((s) => s.status === "draf");
    if (drafts.length === 0) return;

    const confirmPublish = window.confirm(
      `Apakah Anda yakin ingin menerbitkan ${drafts.length} draf slip gaji untuk periode ${formatPeriodeDisplay(selectedPeriode)}?\n\nSetelah diterbitkan, slip akan terkunci dan tidak dapat diubah lagi.`
    );
    if (!confirmPublish) return;

    let workingList = [...allSlips];
    const approverName = user?.nama_lengkap || "Rina Kusumawardani (Kepala HRD)";
    const nowIso = new Date().toISOString();

    drafts.forEach((draft) => {
      const newSlipNum = generateNextSlipNumber(selectedPeriode, workingList);
      workingList = workingList.map((s) => {
        if (s.id === draft.id) {
          return {
            ...s,
            nomor_slip: newSlipNum,
            status: "terbit" as const,
            diterbitkan_oleh: approverName,
            diterbitkan_pada: nowIso,
          };
        }
        return s;
      });

      // PRD Bab 11 & BR-11: Kirim notifikasi email tanpa nominal gaji untuk setiap karyawan
      const target = resolveEmployeeEmail(draft);
      sendEmailNotification({
        type: "PAYROLL_PUBLISHED",
        toEmail: target.email,
        toName: target.name,
        subject: `[KarsaHR] Slip Gaji Periode ${formatPeriodeDisplay(selectedPeriode)} Telah Terbit`,
        title: "Pemberitahuan Terbit Slip Gaji Karyawan",
        message: `Slip gaji Anda untuk periode ${formatPeriodeDisplay(selectedPeriode)} telah resmi diterbitkan oleh Tim HRD & Payroll.`,
        badgeText: "Slip Gaji Terbit",
        badgeColor: "#7c3aed",
        summaryItems: [
          { label: "Nama Karyawan", value: target.name },
          { label: "Periode Gaji", value: formatPeriodeDisplay(selectedPeriode) },
          { label: "Nomor Dokumen", value: newSlipNum },
          { label: "Kerahasiaan (BR-11)", value: "Nominal dirahasiakan dalam email" },
        ],
        note: "Sesuai aturan keamanan dan privasi data finansial (BR-11), nominal rincian gaji tidak dicantumkan di badan email. Silakan masuk ke aplikasi KarsaHR untuk mengunduh atau mencetak slip gaji resmi Anda.",
        actionPath: "/slip-gaji",
        actionText: "Buka Slip Gaji di KarsaHR",
      }).catch(() => {});
    });

    saveSlips(workingList);
    setToastMessage(`${drafts.length} draf slip gaji periode ${formatPeriodeDisplay(selectedPeriode)} berhasil diterbitkan resmi.`);
  };

  return (
    <>
      {/* Toast Notification Melayang */}
      {toastMessage && (
        <div className="floating-toast-container" role="status">
          <div className="floating-toast-body">
            <span className="floating-toast-icon">✓</span>
            <span className="floating-toast-message">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="floating-toast-close"
          >
            ✕
          </button>
        </div>
      )}

      <div className="slip-gaji-container">
        {/* Header Halaman */}
        <header className="slip-page-header">
          <div>
            <h1 className="slip-header-title">Slip Gaji</h1>
            <p className="slip-header-sub">
              {user?.peran === "hrd"
                ? "Kelola, buat draf, dan terbitkan slip gaji karyawan per periode."
                : "Daftar slip gaji resmi yang telah diterbitkan perusahaan untuk Anda."}
            </p>
          </div>
          <div className="slip-header-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Rahasia</span>
            <span>·</span>
            <span>{user?.peran === "hrd" ? "Akses Penuh HRD" : "Akses Privat Karyawan"}</span>
          </div>
        </header>

        {/* Toolbar & Aksi Payroll Khusus HRD */}
        {user?.peran === "hrd" && (
          <div className="payroll-toolbar-card">
            <div className="payroll-toolbar-row-top">
              <div className="payroll-controls-left">
                {/* Dropdown Periode */}
                <div className="payroll-select-group">
                  <label htmlFor="select-periode" className="payroll-select-label">
                    Periode Gaji:
                  </label>
                  <select
                    id="select-periode"
                    value={selectedPeriode}
                    onChange={(e) => setSelectedPeriode(e.target.value)}
                    className="payroll-dropdown"
                  >
                    {PERIODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Status: Semua, Draf, Terbit */}
                <div className="payroll-status-tabs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("semua")}
                    className={`payroll-tab-btn ${statusFilter === "semua" ? "active" : ""}`}
                  >
                    Semua ({slipsInSelectedPeriod.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("draf")}
                    className={`payroll-tab-btn ${statusFilter === "draf" ? "active" : ""}`}
                  >
                    Draf ({draftCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("terbit")}
                    className={`payroll-tab-btn ${statusFilter === "terbit" ? "active" : ""}`}
                  >
                    Terbit ({publishedCount})
                  </button>
                </div>
              </div>

              {/* Tombol Aksi Payroll HRD */}
              <div className="payroll-actions-group">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="btn-payroll-primary"
                  title="Buat draf slip gaji baru untuk karyawan"
                >
                  <span>+ Buat Draf Slip</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyFromPreviousPeriod}
                  className="btn-payroll-secondary"
                  title="Salin komponen gaji bulan sebelumnya ke draf periode ini"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Salin dari Periode Sebelumnya</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublishAllDrafts}
                  disabled={draftCount === 0}
                  className="btn-payroll-publish-all"
                  title={draftCount === 0 ? "Tidak ada draf untuk diterbitkan" : `Terbitkan ${draftCount} draf slip sekaligus`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Terbitkan Semua Draf ({draftCount})</span>
                </button>
              </div>
            </div>

            <div className="payroll-notice-bar">
              <span className="payroll-privacy-caption">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Slip gaji bersifat rahasia. Karyawan hanya dapat melihat slip yang sudah berstatus Terbit.
              </span>
              <span>
                Total Payroll: <strong>{formatRupiah(slipsInSelectedPeriod.reduce((acc, s) => acc + (s.total_diterima || 0), 0))}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Tabel Slip Gaji Responsif */}
        <div className="payroll-table-card">
          <div className="payroll-table-wrapper">
            <table className="payroll-data-table">
              <thead>
                <tr>
                  <th>NOMOR SLIP</th>
                  {user?.peran === "hrd" && <th>KARYAWAN</th>}
                  <th>PERIODE</th>
                  <th>GAJI POKOK</th>
                  <th>TUNJANGAN</th>
                  <th>POTONGAN</th>
                  <th>TOTAL DITERIMA</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {displayedSlips.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.nomor_slip ? (
                        <span className="payroll-slip-code">{item.nomor_slip}</span>
                      ) : (
                        <span className="payroll-slip-code-draft">Draf (Belum Terbit)</span>
                      )}
                    </td>
                    {user?.peran === "hrd" && (
                      <td>
                        <div className="payroll-employee-cell">
                          <span className="payroll-employee-name">{item.nama}</span>
                          <span className="payroll-employee-sub">
                            {item.nik} · {item.divisi}
                          </span>
                        </div>
                      </td>
                    )}
                    <td>{formatPeriodeDisplay(item.periode)}</td>
                    <td className="amount-salary">{formatRupiah(item.gaji_pokok)}</td>
                    <td className="amount-tunjangan">{formatTunjangan(item.tunjangan)}</td>
                    <td className="amount-potongan">{formatPotongan(item.potongan)}</td>
                    <td className="amount-total">{formatRupiah(item.total_diterima)}</td>
                    <td>
                      <span className={`badge-slip-status ${item.status}`}>
                        <span className={item.status === "terbit" ? "badge-dot-green" : "badge-dot-amber"}></span>
                        {item.status === "terbit" ? "Terbit" : "Draf"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="payroll-row-actions" style={{ justifyContent: "flex-end" }}>
                        {/* Aksi Berdasarkan Status Slip Sesuai PRD BR-12 */}
                        {item.status === "draf" && user?.peran === "hrd" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="btn-action-edit"
                              title="Edit komponen draf gaji"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePublishSingle(item)}
                              className="btn-action-publish-single"
                              title="Terbitkan slip gaji resmi untuk karyawan ini"
                            >
                              Terbitkan
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedSlipDetail(item)}
                            className="btn-action-view"
                            title="Lihat rincian & cetak slip resmi"
                          >
                            Lihat / Cetak
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Empty State */}
                {displayedSlips.length === 0 && (
                  <tr>
                    <td colSpan={user?.peran === "hrd" ? 9 : 8} className="payroll-empty-row">
                      <div className="payroll-empty-content">
                        <div className="payroll-empty-icon-wrap">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M7 15h0M2 9.5h20" />
                          </svg>
                        </div>
                        <h4 className="payroll-empty-title">
                          {user?.peran === "hrd"
                            ? "Belum ada data slip gaji untuk periode ini."
                            : "Belum ada slip gaji yang terbit untuk akun Anda."}
                        </h4>
                        <p className="payroll-empty-sub">
                          {user?.peran === "hrd"
                            ? "Gunakan tombol '+ Buat Draf Slip' atau 'Salin dari Periode Sebelumnya' untuk memulai penyusunan payroll."
                            : "Slip gaji resmi yang telah diterbitkan oleh HRD akan muncul di sini."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: Buat Draf Slip Baru (Khusus HRD) */}
      {isCreateModalOpen && (
        <div className="payroll-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="payroll-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="payroll-modal-header">
              <h3 className="payroll-modal-title">Buat Draf Slip Gaji</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="payroll-modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewDraft}>
              <div className="payroll-modal-body">
                {formError && (
                  <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 500 }}>
                    ⚠️ {formError}
                  </div>
                )}

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Periode Gaji:</label>
                  <input
                    type="text"
                    disabled
                    value={formatPeriodeDisplay(selectedPeriode)}
                    className="payroll-form-input"
                    style={{ backgroundColor: "#f8fafc", color: "#475569" }}
                  />
                </div>

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Karyawan Penerima *</label>
                  <select
                    value={formKaryawanId}
                    onChange={(e) => {
                      setFormKaryawanId(e.target.value);
                      const p = (profilesData as Array<any>).find((pr) => pr.id === e.target.value);
                      if (p?.jabatan?.toLowerCase().includes("manajer")) {
                        setFormGajiPokok(16000000);
                      } else {
                        setFormGajiPokok(6500000);
                      }
                    }}
                    required
                    className="payroll-form-select"
                  >
                    <option value="" disabled>-- Pilih Karyawan --</option>
                    {availableEmployeesForNewSlip.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nama_lengkap} ({emp.nik_karyawan}) — {emp["divisi (bantu)"]}
                      </option>
                    ))}
                  </select>
                  <span className="payroll-form-help">
                    Hanya menampilkan karyawan aktif yang belum memiliki slip gaji di periode ini.
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Gaji Pokok (Rp) *</label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={formGajiPokok}
                      onChange={(e) => setFormGajiPokok(Number(e.target.value))}
                      required
                      className="payroll-form-input"
                    />
                  </div>

                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Tunjangan (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={formTunjangan}
                      onChange={(e) => setFormTunjangan(Number(e.target.value))}
                      className="payroll-form-input"
                    />
                  </div>
                </div>

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Potongan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={formPotongan}
                    onChange={(e) => setFormPotongan(Number(e.target.value))}
                    className="payroll-form-input"
                  />
                  <span className="payroll-form-help">Potongan iuran BPJS, pajak PPh21, atau ketidakhadiran.</span>
                </div>

                <div className="payroll-live-total-box">
                  <span className="payroll-live-total-label">Total Diterima (Take Home Pay):</span>
                  <span className="payroll-live-total-val">
                    {formatRupiah(formGajiPokok + formTunjangan - formPotongan)}
                  </span>
                </div>

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Catatan Rincian (Opsional):</label>
                  <textarea
                    rows={2}
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="Contoh: Tunjangan makan & transport, iuran BPJS 4%"
                    className="payroll-form-textarea"
                  />
                </div>
              </div>

              <div className="payroll-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-payroll-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-payroll-primary"
                >
                  Simpan sebagai Draf
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Draf Slip (Khusus HRD, Status Draf) */}
      {editingSlip && (
        <div className="payroll-modal-backdrop" onClick={() => setEditingSlip(null)}>
          <div className="payroll-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="payroll-modal-header">
              <h3 className="payroll-modal-title">Edit Draf Slip Gaji</h3>
              <button
                type="button"
                onClick={() => setEditingSlip(null)}
                className="payroll-modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedDraft}>
              <div className="payroll-modal-body">
                {formError && (
                  <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 500 }}>
                    ⚠️ {formError}
                  </div>
                )}

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Karyawan:</label>
                  <input
                    type="text"
                    disabled
                    value={`${editingSlip["nama (bantu)"] || "Karyawan"} (${profileMap.get(editingSlip.karyawan_id)?.nik || "KLN"})`}
                    className="payroll-form-input"
                    style={{ backgroundColor: "#f8fafc", color: "#475569" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Gaji Pokok (Rp) *</label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={formGajiPokok}
                      onChange={(e) => setFormGajiPokok(Number(e.target.value))}
                      required
                      className="payroll-form-input"
                    />
                  </div>

                  <div className="payroll-form-field">
                    <label className="payroll-form-label">Tunjangan (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={formTunjangan}
                      onChange={(e) => setFormTunjangan(Number(e.target.value))}
                      className="payroll-form-input"
                    />
                  </div>
                </div>

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Potongan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={formPotongan}
                    onChange={(e) => setFormPotongan(Number(e.target.value))}
                    className="payroll-form-input"
                  />
                </div>

                <div className="payroll-live-total-box">
                  <span className="payroll-live-total-label">Total Diterima (Take Home Pay):</span>
                  <span className="payroll-live-total-val">
                    {formatRupiah(formGajiPokok + formTunjangan - formPotongan)}
                  </span>
                </div>

                <div className="payroll-form-field">
                  <label className="payroll-form-label">Catatan Rincian:</label>
                  <textarea
                    rows={2}
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    className="payroll-form-textarea"
                  />
                </div>
              </div>

              <div className="payroll-modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingSlip(null)}
                  className="btn-payroll-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-payroll-primary"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Lihat / Cetak Slip Resmi (PRD BR-11 & BR-12) */}
      {selectedSlipDetail && (
        <div className="payroll-modal-backdrop" onClick={() => setSelectedSlipDetail(null)}>
          <div className="slip-printable-card" onClick={(e) => e.stopPropagation()}>
            <div className="slip-official-header">
              <div className="slip-company-info">
                <h2 className="slip-company-title">PT KARSA LINTAS NUSANTARA</h2>
                <p className="slip-company-meta">
                  Kawasan Industri & Pergudangan Terpadu, Blok B4 No. 12, Bekasi
                  <br />
                  NPWP: 01.345.678.9-407.000 · Telp: (021) 8899-2345
                </p>
              </div>
              <div className="slip-official-badge-box">
                <span className="slip-official-tag">SLIP GAJI RESMI</span>
                <span className="slip-official-number">
                  {selectedSlipDetail.nomor_slip || "DRAF-BELUM-TERBIT"}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                  Status: <strong>{selectedSlipDetail.status === "terbit" ? "Resmi Terbit" : "Draf"}</strong>
                </span>
              </div>
            </div>

            <div className="slip-info-columns">
              <div className="slip-info-item">
                <span className="slip-info-label">Nama Karyawan</span>
                <span className="slip-info-val">{selectedSlipDetail.nama}</span>
              </div>
              <div className="slip-info-item">
                <span className="slip-info-label">Periode Penggajian</span>
                <span className="slip-info-val">{formatPeriodeDisplay(selectedSlipDetail.periode)}</span>
              </div>
              <div className="slip-info-item">
                <span className="slip-info-label">Nomor Induk Karyawan (NIK)</span>
                <span className="slip-info-val">{selectedSlipDetail.nik}</span>
              </div>
              <div className="slip-info-item">
                <span className="slip-info-label">Divisi / Jabatan</span>
                <span className="slip-info-val">
                  {selectedSlipDetail.divisi} · {selectedSlipDetail.jabatan}
                </span>
              </div>
            </div>

            {/* Breakdown Rincian Gaji */}
            <div className="slip-breakdown-box">
              <div className="slip-breakdown-row">
                <span className="slip-breakdown-label">Gaji Pokok</span>
                <span className="slip-breakdown-val">{formatRupiah(selectedSlipDetail.gaji_pokok)}</span>
              </div>
              <div className="slip-breakdown-row">
                <span className="slip-breakdown-label">Tunjangan Jabatan & Operasional</span>
                <span className="slip-breakdown-val" style={{ color: "#059669" }}>
                  {formatTunjangan(selectedSlipDetail.tunjangan)}
                </span>
              </div>
              <div className="slip-breakdown-row potongan">
                <span className="slip-breakdown-label">Potongan (BPJS Karyawan / Pajak)</span>
                <span className="slip-breakdown-val" style={{ color: "#dc2626" }}>
                  {formatPotongan(selectedSlipDetail.potongan)}
                </span>
              </div>
              <div className="slip-breakdown-total">
                <span className="slip-total-title">Total Diterima (Take Home Pay)</span>
                <span className="slip-total-figure">{formatRupiah(selectedSlipDetail.total_diterima)}</span>
              </div>
            </div>

            {selectedSlipDetail.catatan && (
              <div className="slip-note-box">
                <strong>Catatan:</strong> {selectedSlipDetail.catatan}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "1.5rem", padding: "0 0.5rem" }}>
              <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                <span>Diterbitkan Oleh:</span>
                <p style={{ fontWeight: 600, color: "#0f172a", margin: "0.2rem 0 0.15rem 0", fontSize: "0.8125rem" }}>
                  {publisherName}
                </p>
                <span style={{ fontSize: "0.625rem", color: "#94a3b8" }}>
                  {formatWaktuTerbit(selectedSlipDetail.diterbitkan_pada)}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ width: "90px", height: "40px", borderBottom: "1px solid #94a3b8", marginBottom: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "0.625rem", color: "#1d4ed8", fontStyle: "italic", fontWeight: 700 }}>[TERVERIFIKASI]</span>
                </div>
                <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#334155" }}>Bagian Payroll HRD</span>
              </div>
            </div>

            <p className="slip-confidential-footer">
              Dokumen ini dihasilkan secara otomatis oleh sistem KarsaHR dan bersifat rahasia (Privileged & Confidential).
              <br />
              Slip gaji yang telah resmi terbit terkunci dan tidak dapat diubah kembali.
            </p>

            <div className="slip-modal-btn-row">
              <button
                type="button"
                onClick={() => setSelectedSlipDetail(null)}
                className="btn-payroll-secondary"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-payroll-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Cetak / Unduh PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
