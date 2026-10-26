"use client";

import React, { useState, useMemo, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { formatRupiah } from "@/lib/utils/time";
import profilesData from "../../../data/seeds/profiles.json";
import divisiData from "../../../data/seeds/divisi.json";
import slipGajiData from "../../../data/seeds/slip_gaji.json";
import { db } from "@/lib/firebase/config";
import { collection, getDocs } from "firebase/firestore";
import {
  fetchEmployeesFromFirestore,
  saveNewEmployeeToFirestore,
  updateEmployeeInFirestore,
  toggleEmployeeStatusInFirestore,
} from "@/lib/firebase/employee-service";

const BULAN_INDO = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

const PROFILES_STORAGE_KEY = "karsahr_profiles_overrides";
const SALARIES_STORAGE_KEY = "karsahr_employee_salaries";

// Format tanggal masuk: "YYYY-MM-DD" -> "5 Feb 2018" atau "05 Feb 2018"
export function formatTanggalMasuk(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "-" || dateStr === "null") return "-";
  const clean = dateStr.trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
      return `${day} ${BULAN_INDO[monthIdx]} ${year}`;
    }
  }
  return clean;
}

export default function KaryawanPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivisi, setFilterDivisi] = useState("Semua");
  const [karyawanList, setKaryawanList] = useState<any[]>(profilesData as any[]);
  const [employeeSalaries, setEmployeeSalaries] = useState<Record<string, { gaji_pokok: number; tunjangan: number }>>({});
  
  // State Divisi Dinamis (Tersinkronisasi otomatis dengan Pengaturan Divisi & Cloud Firestore)
  const [divisiList, setDivisiList] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_divisi_list");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return divisiData as any[];
  });

  // State Modal Tambah Karyawan Baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPeran, setNewPeran] = useState<"karyawan" | "atasan" | "hrd">("karyawan");
  const [newDivisi, setNewDivisi] = useState("Operasional Gudang");
  const [newJabatan, setNewJabatan] = useState("");
  const [newAtasan, setNewAtasan] = useState("");
  const [newStatusKerja, setNewStatusKerja] = useState<"tetap" | "kontrak">("tetap");
  const [newTanggalMasuk, setNewTanggalMasuk] = useState("2026-10-21");
  const [newDisplayTanggalMasuk, setNewDisplayTanggalMasuk] = useState("21/10/2026");
  const [newGajiPokok, setNewGajiPokok] = useState<number | null>(null);
  const [displayNewGajiPokok, setDisplayNewGajiPokok] = useState("");
  const [newTunjangan, setNewTunjangan] = useState<number | null>(null);
  const [displayNewTunjangan, setDisplayNewTunjangan] = useState("");

  // Opsi Atasan Langsung Dinamis: Berdasarkan akun aktif berstatus 'atasan' atau 'hrd'
  const dynamicAtasanOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: "", label: "Tanpa Atasan Langsung" },
      { value: "Direktur Utama", label: "Direktur Utama" },
    ];

    const atasans = karyawanList.filter(
      (k) => (k.peran === "atasan" || k.peran === "hrd") && k.aktif !== false
    );

    atasans.forEach((a) => {
      const label = `${a.nama_lengkap} (${a.jabatan || (a.peran === "hrd" ? "Kepala HRD" : "Manajer")})`;
      if (!list.some((item) => item.value === label)) {
        list.push({ value: label, label });
      }
    });

    return list;
  }, [karyawanList]);

  // Kalkulasi NIK otomatis berikutnya secara berurutan (contoh: KLN-0020)
  const nextAutoNik = useMemo(() => {
    let maxNum = 0;
    karyawanList.forEach((k) => {
      const match = (k.nik_karyawan || "").match(/KLN-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `KLN-${String(maxNum + 1).padStart(4, "0")}`;
  }, [karyawanList]);

  // State Modal Ubah / Edit Data Karyawan
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingKaryawan, setEditingKaryawan] = useState<any | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPeran, setEditPeran] = useState<"karyawan" | "atasan" | "hrd">("karyawan");
  const [editDivisi, setEditDivisi] = useState("Penjualan");
  const [editJabatan, setEditJabatan] = useState("");
  const [editAtasan, setEditAtasan] = useState("Maya Anggraini (Manajer Penjualan)");
  const [editGajiPokok, setEditGajiPokok] = useState<number>(7500000);
  const [editTunjangan, setEditTunjangan] = useState<number>(1500000);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Muat data seed, cache lokal, dan sinkronisasi dengan Cloud Firestore
  useEffect(() => {
    // 1. Inisialisasi peta gaji dari slip_gaji seed
    const initialSalaries: Record<string, { gaji_pokok: number; tunjangan: number }> = {};
    (slipGajiData as Array<any>).forEach((s) => {
      if (s.karyawan_id && (!initialSalaries[s.karyawan_id] || s.periode > "2026-08-01")) {
        initialSalaries[s.karyawan_id] = {
          gaji_pokok: Number(s.gaji_pokok) || 7500000,
          tunjangan: Number(s.tunjangan) || 1500000,
        };
      }
    });

    try {
      const storedSalaries = localStorage.getItem(SALARIES_STORAGE_KEY);
      if (storedSalaries) {
        const parsed = JSON.parse(storedSalaries);
        setEmployeeSalaries({ ...initialSalaries, ...parsed });
      } else {
        setEmployeeSalaries(initialSalaries);
      }

      const storedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKaryawanList(parsed);
        }
      }
    } catch (e) {
      console.warn("Sinkronisasi penyimpanan lokal karyawan:", e);
    }

    // 2. Sinkronkan profil karyawan dari Cloud Firestore
    fetchEmployeesFromFirestore()
      .then((fsList) => {
        if (fsList && fsList.length > 0) {
          const uniqueMap = new Map<string, any>();
          fsList.forEach((p) => {
            const key = (p.nik_karyawan || p.email || p.id).toLowerCase();
            uniqueMap.set(key, p);
          });
          setKaryawanList(Array.from(uniqueMap.values()));
        }
      })
      .catch((err) => {
        console.warn("Sinkronisasi Firestore profiles:", err);
      });

    // 3. Sinkronkan master data divisi dari Cloud Firestore
    getDocs(collection(db, "divisi"))
      .then((divSnap) => {
        if (divSnap && !divSnap.empty) {
          const list: any[] = [];
          divSnap.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id });
          });
          setDivisiList(list);
          try {
            localStorage.setItem("karsahr_divisi_list", JSON.stringify(list));
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn("Sinkronisasi Firestore divisi di halaman karyawan:", err);
      });
  }, []);

  // Filter daftar karyawan berdasarkan hak akses dan kata kunci (Deduplikasi unik per NIK)
  const filteredList = useMemo(() => {
    const uniqueMap = new Map<string, any>();
    karyawanList.forEach((k) => {
      const key = (k.nik_karyawan || pEmail(k) || k.id).toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, k);
      }
    });

    function pEmail(item: any) {
      return item.email || item.id || "";
    }

    const uniqueList = Array.from(uniqueMap.values());

    return uniqueList.filter((k) => {
      // Jika peran Atasan, hanya bisa melihat anggota divisinya sendiri (PRD Bab 7)
      if (user?.peran === "atasan" && k.divisi_id !== user.divisi_id) {
        return false;
      }
      if (filterDivisi !== "Semua" && k["divisi (bantu)"] !== filterDivisi) {
        return false;
      }
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        return (
          k.nama_lengkap.toLowerCase().includes(q) ||
          k.nik_karyawan.toLowerCase().includes(q) ||
          k.jabatan.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [karyawanList, user, filterDivisi, searchTerm]);

  // Buka Modal Edit Karyawan
  const handleOpenEditModal = (k: any) => {
    setEditingKaryawan(k);
    setEditNama(k.nama_lengkap || "");
    setEditEmail(k.email || "");
    setEditPeran((k.peran as any) || "karyawan");
    setEditDivisi(k["divisi (bantu)"] || "Penjualan");
    setEditJabatan(k.jabatan || "");

    // Deteksi atasan langsung bawaan berdasarkan divisi & jabatan
    let atasanDefault = k.atasan_langsung;
    if (!atasanDefault) {
      const div = (k["divisi (bantu)"] || "").toLowerCase();
      if (div.includes("gudang") || div.includes("operasional")) {
        atasanDefault = k.jabatan?.toLowerCase().includes("manajer") ? "Direktur Utama" : "Bayu Setiawan (Manajer Operasional)";
      } else if (div.includes("penjualan")) {
        atasanDefault = k.jabatan?.toLowerCase().includes("manajer") ? "Direktur Utama" : "Maya Anggraini (Manajer Penjualan)";
      } else if (div.includes("keuangan")) {
        atasanDefault = k.jabatan?.toLowerCase().includes("manajer") ? "Direktur Utama" : "Hendra Gunawan (Manajer Keuangan)";
      } else {
        atasanDefault = k.jabatan?.toLowerCase().includes("kepala") ? "Direktur Utama" : "Rina Kusumawardani (Kepala HRD)";
      }
    }
    setEditAtasan(atasanDefault);

    // Ambil gaji pokok dan tunjangan
    const sal = employeeSalaries[k.id] || {
      gaji_pokok: k.peran === "atasan" || k.peran === "hrd" ? 16000000 : 7500000,
      tunjangan: 2000000,
    };
    setEditGajiPokok(sal.gaji_pokok);
    setEditTunjangan(sal.tunjangan);

    setIsEditModalOpen(true);
  };

  // Simpan Perubahan Data Karyawan (Edit Modal)
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKaryawan) return;

    // Proteksi keamanan: HRD tidak boleh mengubah peran akunnya sendiri
    if (
      (editingKaryawan.id === user?.id || editingKaryawan.id === (user as any)?.seed_id) &&
      editPeran !== "hrd"
    ) {
      alert("Peran akun Anda sendiri dikunci demi keamanan integritas akses sistem.");
      return;
    }

    const previousData = {
      nama_lengkap: editingKaryawan.nama_lengkap,
      email: editingKaryawan.email,
      peran: editingKaryawan.peran,
      "divisi (bantu)": editingKaryawan["divisi (bantu)"],
      divisi_id: editingKaryawan.divisi_id,
      jabatan: editingKaryawan.jabatan,
      atasan_langsung: editingKaryawan.atasan_langsung,
    };

    const divObj = (divisiList as Array<any>).find((d) => d.nama === editDivisi) || (divisiData as Array<any>).find((d) => d.nama === editDivisi);
    const newDivisiId = divObj ? divObj.id : editingKaryawan.divisi_id;

    const updatedFields = {
      nama_lengkap: editNama.trim(),
      email: editEmail.trim(),
      peran: editPeran,
      "divisi (bantu)": editDivisi,
      divisi_id: newDivisiId,
      jabatan: editJabatan.trim(),
      atasan_langsung: editAtasan,
    };

    const updatedList = karyawanList.map((item) => {
      if (item.id === editingKaryawan.id) {
        return {
          ...item,
          ...updatedFields,
        };
      }
      return item;
    });

    const updatedSalaries = {
      ...employeeSalaries,
      [editingKaryawan.id]: {
        gaji_pokok: editGajiPokok,
        tunjangan: editTunjangan,
      },
    };

    setKaryawanList(updatedList);
    setEmployeeSalaries(updatedSalaries);

    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedList));
      localStorage.setItem(SALARIES_STORAGE_KEY, JSON.stringify(updatedSalaries));
    } catch (err) {
      console.warn("Gagal menyimpan ke localStorage:", err);
    }

    // Kirim pembaruan ke Cloud Firestore dan Audit Log (PRD BR-01 & BR-12)
    updateEmployeeInFirestore(
      editingKaryawan.id,
      updatedFields,
      previousData,
      {
        id: user?.id || "391a65a7-cf37-5806-8e65-bba91e3c42e4",
        nama: user?.nama_lengkap || "Rina Kusumawardani",
      }
    ).catch((err) => {
      console.warn("Firestore update karyawan:", err);
    });

    setIsEditModalOpen(false);
    setActionSuccess(`Data karyawan ${editNama} (${editingKaryawan.nik_karyawan}) berhasil diperbarui.`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Aksi HRD: Nonaktifkan / Aktifkan Karyawan dengan Dialog Konfirmasi
  const handleToggleAktif = (id: string, nama: string, currentStatus: boolean, isSelf: boolean = false) => {
    // Proteksi keamanan: HRD tidak boleh menonaktifkan akunnya sendiri saat sedang login
    if (isSelf && currentStatus) {
      alert(`Pemberitahuan Sistem:\n\nAnda sedang login sebagai "${nama}". Anda tidak dapat menonaktifkan akun HRD Anda sendiri demi menjaga integritas akses sistem.`);
      return;
    }

    const actionText = currentStatus ? "menonaktifkan" : "mengaktifkan kembali";
    const confirmMessage = currentStatus
      ? `Apakah Anda yakin ingin menonaktifkan akun karyawan "${nama}"?\n\nKaryawan yang dinonaktifkan tidak akan dapat masuk ke sistem KarsaHR.`
      : `Apakah Anda yakin ingin mengaktifkan kembali akun karyawan "${nama}"?\n\nKaryawan akan kembali berstatus Aktif dan dapat mengakses aplikasi.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const nextStatus = !currentStatus;
    const updatedList = karyawanList.map((k) =>
      k.id === id || (k.nik_karyawan && k.nik_karyawan === id)
        ? { ...k, aktif: nextStatus, status_aktif: nextStatus }
        : k
    );

    setKaryawanList(updatedList);
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (err) {
      console.warn("Gagal menyimpan status aktif ke localStorage:", err);
    }

    // Update status di Cloud Firestore dan Audit Log (PRD BR-01 & BR-12)
    toggleEmployeeStatusInFirestore(
      id,
      nextStatus,
      nama,
      {
        id: user?.id || "391a65a7-cf37-5806-8e65-bba91e3c42e4",
        nama: user?.nama_lengkap || "Rina Kusumawardani",
      }
    ).catch((err) => {
      console.warn("Firestore toggle status:", err);
    });

    setActionSuccess(
      `Status akun ${nama} berhasil diubah menjadi ${nextStatus ? "Aktif" : "Nonaktif"}.`
    );
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Tambah Karyawan Baru
  const handleAddKaryawan = (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi kondisional: Field Atasan Langsung hanya wajib diisi jika Peran Akun adalah "karyawan"
    if (newPeran === "karyawan" && (!newAtasan || newAtasan === "none" || newAtasan === "")) {
      alert("Untuk peran Karyawan, silakan pilih Atasan Langsung sebagai penyetuju tahap 1 pengajuan cuti & izin.");
      return;
    }

    const divObj = (divisiList as Array<any>).find((d) => d.nama === newDivisi) || (divisiData as Array<any>).find((d) => d.nama === newDivisi);
    const newId = "usr-" + Date.now();
    const finalAtasan = (newAtasan && newAtasan !== "none" && newAtasan !== "") ? newAtasan : null;

    const newRecord = {
      id: newId,
      nik_karyawan: nextAutoNik,
      nama_lengkap: newNama.trim(),
      email: newEmail.trim(),
      peran: newPeran,
      divisi_id: divObj ? divObj.id : (divisiList[0]?.id || "8865d249-d46e-5207-bf19-1b9163f5e954"),
      "divisi (bantu)": newDivisi,
      jabatan: newJabatan.trim(),
      status_kerja: newStatusKerja,
      tanggal_masuk: newTanggalMasuk || "2026-10-21",
      aktif: true,
      atasan_langsung: finalAtasan,
      atasan_id: finalAtasan,
    };

    const salary = {
      gaji_pokok: Number(newGajiPokok) || 0,
      tunjangan: Number(newTunjangan) || 0,
    };

    const updatedList = [...karyawanList, newRecord];
    const updatedSalaries = {
      ...employeeSalaries,
      [newId]: salary,
    };

    setKaryawanList(updatedList);
    setEmployeeSalaries(updatedSalaries);

    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedList));
      localStorage.setItem(SALARIES_STORAGE_KEY, JSON.stringify(updatedSalaries));
    } catch (err) {
      console.warn("Gagal menyimpan ke localStorage:", err);
    }

    // Simpan karyawan baru ke Cloud Firestore dan Audit Log (PRD BR-01 & BR-12)
    saveNewEmployeeToFirestore(
      newRecord,
      salary,
      {
        id: user?.id || "391a65a7-cf37-5806-8e65-bba91e3c42e4",
        nama: user?.nama_lengkap || "Rina Kusumawardani",
      }
    ).catch((err) => {
      console.warn("Firestore save new employee:", err);
    });

    setShowAddModal(false);
    setActionSuccess(`Karyawan baru ${newNama} (${nextAutoNik}) berhasil didaftarkan.`);
    setNewNama("");
    setNewEmail("");
    setNewJabatan("");
    setNewAtasan("");
    setNewGajiPokok(null);
    setDisplayNewGajiPokok("");
    setNewTunjangan(null);
    setDisplayNewTunjangan("");
    setTimeout(() => setActionSuccess(null), 3500);
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h2 className="page-title">Data Karyawan</h2>
          <p className="page-sub">
            {user?.peran === "atasan"
              ? `Daftar anggota di divisi Anda (${user.divisi_nama || ""}). Data gaji dirahasiakan.`
              : "Kelola data kepegawaian, peran, divisi, dan status aktif akun karyawan."}
          </p>
        </div>

        {user?.peran === "hrd" && (
          <button
            onClick={() => setShowAddModal(true)}
            className="ui-btn ui-btn-primary btn-add-karyawan"
          >
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>+</span>
            <span>Tambah Karyawan</span>
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="alert-success" role="status" aria-live="polite">
          <span className="alert-icon">✓</span>
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter & Pencarian Sesuai PRD Bab 7 */}
      <div className="filter-card">
        <div className="search-wrap">
          <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, NIK, atau jabatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="search-clear-btn"
              title="Hapus pencarian"
            >
              ✕
            </button>
          )}
        </div>

        {user?.peran === "hrd" && (
          <div className="filter-control">
            <label className="filter-lbl">Divisi:</label>
            <select
              value={filterDivisi}
              onChange={(e) => setFilterDivisi(e.target.value)}
              className="filter-select"
            >
              <option value="Semua">Semua Divisi</option>
              {divisiList.map((d) => (
                <option key={d.id} value={d.nama}>
                  {d.nama}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabel Data Karyawan (Tanpa Kolom Gaji sesuai PRD Bab 7 & BR-11) */}
      <div className="ui-card">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th style={{ width: "115px" }}>NIK</th>
                <th>NAMA LENGKAP</th>
                <th>DIVISI</th>
                <th>JABATAN</th>
                <th>STATUS KERJA</th>
                <th>TANGGAL MASUK</th>
                <th>STATUS AKUN</th>
                {user?.peran === "hrd" && <th style={{ textAlign: "center", width: "175px" }}>AKSI</th>}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((k) => (
                <tr key={k.id}>
                  {/* Kolom NIK: Monospace Tabular Nums Netral & Rapi */}
                  <td className="nik-mono-cell">{k.nik_karyawan}</td>
                  <td>
                    <div className="font-semibold">{k.nama_lengkap}</div>
                    <div className="sub-text">{k.email}</div>
                  </td>
                  <td>
                    <span className="divisi-badge">{k["divisi (bantu)"] || "Divisi"}</span>
                  </td>
                  <td>{k.jabatan}</td>
                  <td>
                    <span className="badge-text">{k.status_kerja?.toUpperCase()}</span>
                  </td>
                  {/* Kolom Tanggal Masuk: Format Indonesia Rapi (contoh: "5 Feb 2018") */}
                  <td className="tgl-masuk-cell">{formatTanggalMasuk(k.tanggal_masuk)}</td>
                  {(() => {
                    const isAktif = k.aktif === true || k.aktif === "aktif" || k.status_aktif === true || k.status_aktif === "aktif";
                    const isSelf = Boolean(
                      user &&
                      (k.id === user.id ||
                       k.id === (user as any)?.seed_id ||
                       (user.email && k.email && k.email.toLowerCase() === user.email.toLowerCase()) ||
                       (user.nik_karyawan && k.nik_karyawan && k.nik_karyawan === user.nik_karyawan))
                    );

                    return (
                      <>
                        <td>
                          <span className={`status-pill ${isAktif ? "hadir" : "terlambat"}`}>
                            {isAktif ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        {user?.peran === "hrd" && (
                          <td>
                            <div className="action-btn-group">
                              {/* Tombol Ubah / Edit Data Karyawan */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(k)}
                                className="btn-action-edit"
                                title={`Ubah data ${k.nama_lengkap}`}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span>Ubah</span>
                              </button>

                              {/* Tombol Nonaktifkan (jika Aktif) / Aktifkan (jika Nonaktif) */}
                              {isAktif ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAktif(k.id, k.nama_lengkap, true, isSelf)}
                                  className="btn-action-deactivate"
                                  title={isSelf ? "Akun Anda sendiri" : `Nonaktifkan akun ${k.nama_lengkap}`}
                                >
                                  Nonaktifkan
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAktif(k.id, k.nama_lengkap, false, isSelf)}
                                  className="btn-action-activate"
                                  title={`Aktifkan kembali akun ${k.nama_lengkap}`}
                                >
                                  Aktifkan
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </>
                    );
                  })()}
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={user?.peran === "hrd" ? 8 : 7} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
                    Tidak ada data karyawan yang cocok dengan kriteria pencarian atau filter divisi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Ubah / Edit Data Karyawan */}
      {isEditModalOpen && editingKaryawan && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-container-fixed modal-box-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-fixed">
              <div>
                <h3 className="modal-title">Ubah Data Karyawan</h3>
                <p className="modal-sub">
                  Perbarui profil kepegawaian, jabatan, atasan langsung, dan parameter kompensasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="modal-close-icon"
                title="Tutup dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-inner-flex">
              <div className="modal-scroll-body">
                {/* Ringkasan Identitas Pegawai (Readonly Banner) */}
                <div className="employee-info-summary">
                <div className="info-summary-avatar">
                  {editingKaryawan.nama_lengkap.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="info-summary-text">
                  <div className="info-summary-name">{editingKaryawan.nama_lengkap}</div>
                  <div className="info-summary-nik">
                    NIK: <span className="nik-mono-inline">{editingKaryawan.nik_karyawan}</span> • Bergabung: {formatTanggalMasuk(editingKaryawan.tanggal_masuk)}
                  </div>
                </div>
              </div>

              {/* Form Grid 2 Kolom */}
              <div className="form-grid-two">
                <div className="form-item">
                  <label className="lbl">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="inp-text"
                  />
                </div>

                <div className="form-item">
                  <label className="lbl">Email Resmi Perusahaan</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="inp-text"
                  />
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-item">
                  <label className="lbl">Peran Akun (Hak Akses)</label>
                  <select
                    value={editPeran}
                    onChange={(e) => setEditPeran(e.target.value as "karyawan" | "atasan" | "hrd")}
                    className="inp-select"
                    disabled={editingKaryawan.id === user?.id}
                  >
                    <option value="karyawan">Karyawan (Staf Operasional / Pelaksana)</option>
                    <option value="atasan">Atasan (Manajer / Kepala Divisi)</option>
                    <option value="hrd">HRD (Pengelola SDM & Payroll)</option>
                  </select>
                  {editingKaryawan.id === user?.id && (
                    <span className="field-hint-lock">Peran akun sendiri dikunci demi keamanan integritas akses sistem.</span>
                  )}
                </div>

                <div className="form-item">
                  <label className="lbl">Divisi Penempatan</label>
                  <select
                    value={editDivisi}
                    onChange={(e) => setEditDivisi(e.target.value)}
                    className="inp-select"
                  >
                    {divisiList.map((d) => (
                      <option key={d.id} value={d.nama}>
                        {d.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-item">
                  <label className="lbl">Jabatan / Posisi</label>
                  <input
                    type="text"
                    required
                    value={editJabatan}
                    onChange={(e) => setEditJabatan(e.target.value)}
                    placeholder="Contoh: Sales Executive"
                    className="inp-text"
                  />
                </div>

                <div className="form-item">
                  <label className="lbl">Atasan Langsung (Penyetuju Tahap 1)</label>
                  <select
                    value={editAtasan}
                    onChange={(e) => setEditAtasan(e.target.value)}
                    className="inp-select"
                  >
                    {dynamicAtasanOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seksi Kompensasi & Gaji (Kerahasiaan Terjaga - Khusus HRD) */}
              <div className="compensation-fieldset">
                <div className="compensation-fieldset-title">
                  <span>Parameter Remunerasi (Kerahasiaan HRD)</span>
                </div>
                
                <div className="form-grid-two">
                  <div className="form-item">
                    <label className="lbl">Gaji Pokok Bulanan (Rp)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={100000}
                      value={editGajiPokok}
                      onChange={(e) => setEditGajiPokok(Math.max(0, Number(e.target.value) || 0))}
                      className="inp-text"
                    />
                    <span className="salary-preview-text">
                      Nominal: <strong>{formatRupiah(editGajiPokok)}</strong>
                    </span>
                  </div>

                  <div className="form-item">
                    <label className="lbl">Tunjangan Tetap (Rp)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={50000}
                      value={editTunjangan}
                      onChange={(e) => setEditTunjangan(Math.max(0, Number(e.target.value) || 0))}
                      className="inp-text"
                    />
                    <span className="salary-preview-text">
                      Nominal: <strong>{formatRupiah(editTunjangan)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              </div>

              {/* Sticky Footer: Aksi Bawah Selalu Terlihat dan Terjangkau */}
              <div className="modal-footer-sticky">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Tambah Karyawan Baru (Sesuai PRD & ERD) */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-container-fixed modal-box-large" onClick={(e) => e.stopPropagation()}>
            {/* 1. Header Tetap (Fixed Top) */}
            <div className="modal-header-fixed">
              <div>
                <h3 className="modal-title">Tambah Karyawan Baru</h3>
                <p className="modal-sub">
                  Lengkapi data kepegawaian untuk mendaftarkan akun karyawan baru.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="modal-close-icon"
                title="Tutup dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddKaryawan} className="modal-inner-flex">
              {/* 2. Formulir Scrollable (Body) */}
              <div className="modal-scroll-body">
                {/* Informasi NIK Baru yang Terisi Otomatis */}
                <div className="nik-autogen-banner">
                  <div className="nik-autogen-left">
                    <div className="nik-autogen-header-col">
                      <span className="nik-autogen-caption">Nomor Induk Karyawan (Auto-Generate)</span>
                      <div className="nik-autogen-row">
                        <span className="nik-mono-inline nik-code-highlight">{nextAutoNik}</span>
                        <span className="nik-autogen-pill">Auto-Generated</span>
                      </div>
                    </div>
                  </div>
                  <p className="nik-autogen-desc">
                    NIK diterbitkan otomatis berurutan secara sistematis sebagai nomor identitas resmi pegawai baru.
                  </p>
                </div>

                {/* Form Grid 2 Kolom: Identitas Pegawai */}
                <div className="form-grid-two">
                  <div className="form-item">
                    <label className="lbl">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={newNama}
                      onChange={(e) => setNewNama(e.target.value)}
                      placeholder="Contoh: Rian Pratama"
                      className="inp-text"
                    />
                  </div>

                  <div className="form-item">
                    <label className="lbl">Email Resmi Perusahaan</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="rian.pratama@karsalintas.test"
                      className="inp-text"
                    />
                  </div>
                </div>

                {/* Form Grid 2 Kolom: Peran Akun & Divisi Penempatan */}
                <div className="form-grid-two">
                  <div className="form-item">
                    <label className="lbl">Peran Akun</label>
                    <select
                      value={newPeran}
                      onChange={(e) => setNewPeran(e.target.value as "karyawan" | "atasan" | "hrd")}
                      className="inp-select"
                    >
                      <option value="karyawan">Karyawan (Staf / Pelaksana)</option>
                      <option value="atasan">Atasan (Manajer / Kepala Divisi)</option>
                      <option value="hrd">HRD (Pengelola SDM & Payroll)</option>
                    </select>
                  </div>

                  <div className="form-item">
                    <label className="lbl">Divisi Penempatan</label>
                    <select
                      value={newDivisi}
                      onChange={(e) => setNewDivisi(e.target.value)}
                      className="inp-select"
                    >
                      {divisiList.map((d) => (
                        <option key={d.id} value={d.nama}>
                          {d.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Form Grid 2 Kolom: Jabatan & Atasan Langsung */}
                <div className="form-grid-two">
                  <div className="form-item">
                    <label className="lbl">Jabatan / Posisi</label>
                    <input
                      type="text"
                      required
                      value={newJabatan}
                      onChange={(e) => setNewJabatan(e.target.value)}
                      placeholder="Contoh: Staf Gudang"
                      className="inp-text"
                    />
                  </div>

                  <div className="form-item">
                    <label className="lbl">Atasan Langsung</label>
                    <select
                      name="atasan_id"
                      value={newAtasan}
                      onChange={(e) => setNewAtasan(e.target.value)}
                      className="inp-select"
                    >
                      {dynamicAtasanOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="field-helper-atasan">
                      Penyetuju tahap 1 pengajuan cuti & izin.
                    </span>
                  </div>
                </div>

                {/* Form Grid 2 Kolom: Status Kepegawaian & Tanggal Masuk */}
                <div className="form-grid-two">
                  <div className="form-item">
                    <label className="lbl">Status Kepegawaian</label>
                    <select
                      value={newStatusKerja}
                      onChange={(e) => setNewStatusKerja(e.target.value as "tetap" | "kontrak")}
                      className="inp-select"
                    >
                      <option value="tetap">Pegawai Tetap</option>
                      <option value="kontrak">Pegawai Kontrak</option>
                    </select>
                  </div>

                  <div className="form-item">
                    <label className="lbl">Tanggal Masuk</label>
                    <input
                      type="date"
                      required
                      value={newTanggalMasuk}
                      onChange={(e) => setNewTanggalMasuk(e.target.value)}
                      className="inp-text"
                    />
                  </div>
                </div>

                {/* Seksi Remunerasi: Format Mata Uang Rupiah Otomatis dengan Pemisah Ribuan */}
                <div className="compensation-fieldset">
                  <div className="compensation-header-block">
                    <span className="compensation-fieldset-title">PARAMETER REMUNERASI</span>
                    <p className="compensation-fieldset-helper">
                      Nominal bersifat dinamis sesuai surat penawaran kerja / kontrak masing-masing karyawan.
                    </p>
                  </div>

                  <div className="form-grid-two">
                    <div className="form-item">
                      <label className="lbl">Gaji Pokok</label>
                      <input
                        type="text"
                        value={displayNewGajiPokok}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          if (!raw) {
                            setNewGajiPokok(null);
                            setDisplayNewGajiPokok("");
                          } else {
                            const num = parseInt(raw, 10);
                            setNewGajiPokok(num);
                            setDisplayNewGajiPokok(`Rp ${new Intl.NumberFormat("id-ID").format(num)}`);
                          }
                        }}
                        placeholder="Contoh: Rp 7.500.000"
                        className="inp-text font-mono-amount"
                      />
                    </div>

                    <div className="form-item">
                      <label className="lbl">Tunjangan Tetap</label>
                      <input
                        type="text"
                        value={displayNewTunjangan}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          if (!raw) {
                            setNewTunjangan(null);
                            setDisplayNewTunjangan("");
                          } else {
                            const num = parseInt(raw, 10);
                            setNewTunjangan(num);
                            setDisplayNewTunjangan(`Rp ${new Intl.NumberFormat("id-ID").format(num)}`);
                          }
                        }}
                        placeholder="Contoh: Rp 1.500.000"
                        className="inp-text font-mono-amount"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Sticky Footer (Aksi Bawah Selalu Terlihat) */}
              <div className="modal-footer-sticky">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Simpan Karyawan Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }

        .page-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .page-sub {
          font-size: 0.78125rem;
          color: #64748b;
          margin-top: 0.15rem;
        }

        .btn-add-karyawan {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-weight: 600;
          padding: 0.45rem 0.85rem;
          border-radius: 6px;
        }

        .alert-success {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.625rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          animation: fadeIn 0.2s ease-in-out;
        }

        .alert-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background-color: #10b981;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .filter-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          max-width: 340px;
        }

        .search-icon-svg {
          position: absolute;
          left: 0.65rem;
          color: #94a3b8;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          font-size: 0.8125rem;
          padding: 0.4rem 2rem 0.4rem 2.1rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-family: inherit;
          color: #1e293b;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .search-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        }

        .search-clear-btn {
          position: absolute;
          right: 0.5rem;
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          cursor: pointer;
          padding: 2px 5px;
          border-radius: 4px;
        }

        .search-clear-btn:hover {
          color: #475569;
          background-color: #f1f5f9;
        }

        .filter-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-lbl {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #475569;
        }

        .filter-select {
          font-size: 0.8125rem;
          padding: 0.38rem 0.65rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background-color: #ffffff;
          color: #1e293b;
          outline: none;
          cursor: pointer;
        }

        .filter-select:focus {
          border-color: #2563eb;
        }

        /* Kolom NIK: Font Monospace Netral & Tabular Nums */
        .nik-mono-cell {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-variant-numeric: tabular-nums;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: 0.025em;
          white-space: nowrap;
        }

        .nik-mono-inline {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          color: #0f172a;
        }

        .font-semibold {
          font-weight: 600;
          color: #0f172a;
        }

        .sub-text {
          font-size: 0.6875rem;
          color: #64748b;
          margin-top: 1px;
        }

        .divisi-badge {
          display: inline-block;
          font-size: 0.75rem;
          color: #334155;
          font-weight: 500;
        }

        .badge-text {
          font-size: 0.6875rem;
          color: #475569;
          font-weight: 600;
          background-color: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .tgl-masuk-cell {
          font-size: 0.8125rem;
          color: #334155;
          white-space: nowrap;
        }

        /* Grup Tombol Aksi */
        .action-btn-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
        }

        .btn-action-edit {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 0.28rem 0.55rem;
          border-radius: 5px;
          font-size: 0.71875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-edit:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .btn-action-deactivate {
          background-color: #ffffff;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.28rem 0.6rem;
          border-radius: 5px;
          font-size: 0.71875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .btn-action-deactivate:hover:not(:disabled) {
          background-color: #fef2f2;
          border-color: #fca5a5;
          color: #b91c1c;
        }

        .btn-action-deactivate:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          border-color: #e2e8f0;
          color: #94a3b8;
          background-color: #f8fafc;
        }

        .btn-action-activate {
          background-color: #ffffff;
          border: 1px solid #bbf7d0;
          color: #16a34a;
          padding: 0.28rem 0.6rem;
          border-radius: 5px;
          font-size: 0.71875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .btn-action-activate:hover {
          background-color: #f0fdf4;
          border-color: #86efac;
          color: #15803d;
        }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
        }

        .modal-box {
          background-color: #ffffff;
          border-radius: 14px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.18), 0 10px 15px -3px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 520px;
          padding: 1.75rem 2rem;
          max-height: 88vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .modal-box-large {
          max-width: 740px; /* Lebar lapang setara max-w-3xl */
          padding: 2rem 2.25rem; /* Padding proporsional & konsisten (p-8) */
        }

        .modal-box::-webkit-scrollbar {
          width: 6px;
        }

        .modal-box::-webkit-scrollbar-track {
          background: transparent;
          margin: 14px 0; /* Memberi jarak agar bilah scrollbar tidak memotong border-radius sudut modal */
        }

        .modal-box::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 9999px;
        }

        .modal-box::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }

        /* Struktur Kontainer Modal Fixed Viewport (Header Tetap, Body Scroll, Sticky Footer) */
        .modal-container-fixed {
          background-color: #ffffff;
          border-radius: 14px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 10px 15px -3px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 740px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0 !important;
        }

        .modal-header-fixed {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.35rem 1.75rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          background-color: #ffffff;
          flex-shrink: 0;
        }

        .modal-inner-flex {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .modal-scroll-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .modal-scroll-body::-webkit-scrollbar {
          width: 6px;
        }

        .modal-scroll-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .modal-scroll-body::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 9999px;
        }

        .modal-scroll-body::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }

        .modal-footer-sticky {
          padding: 1rem 1.75rem;
          border-top: 1px solid #f1f5f9;
          background-color: rgba(248, 250, 252, 0.85);
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        .modal-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.25rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
        }

        .modal-sub {
          font-size: 0.78125rem;
          color: #64748b;
          margin-top: 0.2rem;
          line-height: 1.45;
        }

        .modal-close-icon {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 15px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background-color 0.15s, color 0.15s;
        }

        .modal-close-icon:hover {
          background-color: #f1f5f9;
          color: #334155;
        }

        .employee-info-summary {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.75rem 1rem;
        }

        .info-summary-avatar {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8125rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .info-summary-text {
          min-width: 0;
        }

        .info-summary-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #0f172a;
        }

        .info-summary-nik {
          font-size: 0.71875rem;
          color: #64748b;
          margin-top: 1px;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1.125rem; /* Jarak antar baris seragam & lega (gap-y-4) */
          padding-right: 0.35rem; /* Padding kanan agar form tidak menempel ke bilah scrollbar */
        }

        .form-grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 1.5rem; /* gap-x-6 (24px) */
          row-gap: 1rem;      /* gap-y-4 (16px) */
          align-items: start; /* items-start */
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 1.5rem;
          row-gap: 1rem;
          align-items: start;
        }

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .lbl {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
          line-height: 1.25;
        }

        .inp-text, .inp-select {
          height: 40px; /* h-10 (40px) */
          min-height: 40px;
          width: 100%;
          border-radius: 8px; /* rounded-lg */
          border: 1px solid #cbd5e1; /* border-slate-300 */
          background-color: #ffffff;
          padding: 0 0.875rem; /* px-3.5 */
          font-size: 0.875rem; /* text-sm */
          color: #1e293b; /* text-slate-800 */
          outline: none;
          box-sizing: border-box;
          line-height: 38px;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .inp-text:focus, .inp-select:focus {
          border-color: #3b82f6; /* focus:border-blue-500 */
          box-shadow: 0 0 0 1px #3b82f6; /* focus:ring-1 focus:ring-blue-500 */
        }

        input[type="date"].inp-text {
          height: 40px;
          min-height: 40px;
          padding: 0 0.875rem;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          font-family: inherit;
        }

        .inp-select:disabled {
          background-color: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .field-hint-lock {
          font-size: 0.65625rem;
          color: #dc2626;
          margin-top: 2px;
        }

        .compensation-fieldset {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1.125rem 1.25rem; /* Sejajar dengan padding NIK banner */
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .compensation-header-block {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .compensation-fieldset-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .compensation-fieldset-helper {
          font-size: 0.71875rem;
          color: #64748b;
          margin: 0;
          line-height: 1.45;
        }

        .salary-preview-text {
          font-size: 0.6875rem;
          color: #475569;
          margin-top: 2px;
        }

        .salary-preview-text strong {
          color: #1e293b;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid #f1f5f9;
        }

        .nik-autogen-banner {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1.125rem 1.25rem; /* Sejajar dengan padding Remunerasi */
        }

        .nik-autogen-left {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .nik-autogen-header-col {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .nik-autogen-caption {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .nik-autogen-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .nik-code-highlight {
          font-family: 'SF Mono', Consolas, Monaco, monospace;
          font-size: 0.9375rem;
          font-weight: 700;
          color: #1d4ed8;
          background-color: #eff6ff;
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
          letter-spacing: 0.05em;
        }

        .nik-autogen-pill {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          background-color: #dcfce7;
          color: #15803d;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid #bbf7d0;
          letter-spacing: 0.04em;
        }

        .nik-autogen-desc {
          font-size: 0.71875rem;
          color: #64748b;
          margin: 0;
          line-height: 1.45;
        }

        .date-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .font-mono-amount {
          font-family: 'SF Mono', Consolas, Monaco, monospace;
          font-weight: 600;
          color: #0f172a;
        }

        .field-helper-atasan {
          font-size: 0.6875rem;
          color: #9CA3AF;
          margin-top: 0.25rem;
          line-height: 1.25;
          display: block;
        }

        @media (max-width: 768px) {
          .header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.75rem !important;
          }
          .btn-add-karyawan {
            width: 100% !important;
            justify-content: center !important;
          }
          .filter-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
            padding: 0.85rem !important;
          }
          .search-wrap {
            width: 100% !important;
          }
          .filter-control {
            width: 100% !important;
            justify-content: space-between !important;
          }
          .filter-select {
            flex: 1 !important;
          }
          .modal-box {
            width: calc(100vw - 1.5rem) !important;
            max-width: 100% !important;
            padding: 1.25rem 1rem !important;
            max-height: 90vh;
            overflow-y: auto;
          }
          .modal-btn-row {
            flex-direction: column !important;
            width: 100% !important;
            gap: 0.5rem !important;
          }
          .modal-btn-row button {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </>
  );
}
