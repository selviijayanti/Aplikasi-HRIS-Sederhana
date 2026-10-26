"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { fetchEmployeesFromFirestore } from "@/lib/firebase/employee-service";
import { doc, updateDoc, setDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import hariLiburData from "../../../data/seeds/hari_libur.json";
import auditLogData from "../../../data/seeds/audit_log.json";
import divisiData from "../../../data/seeds/divisi.json";
import kuotaCutiData from "../../../data/seeds/kuota_cuti.json";
import profilesData from "../../../data/seeds/profiles.json";
import {
  HariLibur,
  JenisHariLibur,
  getStoredHolidays,
  fetchHolidaysFromFirestore,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from "@/lib/firebase/holiday-service";

// Helper Pencarian Nama Asli Karyawan dari Master profiles.json
function resolveSeedEmployeeName(karyawanId: string, fallback?: string): string {
  if (!karyawanId && fallback && fallback !== "Karyawan") return fallback;
  const p = (profilesData as Array<any>).find(
    (x) => x.id === karyawanId || x.nik_karyawan === karyawanId || x.seed_id === karyawanId
  );
  if (p?.nama_lengkap) return p.nama_lengkap;
  const k = (kuotaCutiData as Array<any>).find(
    (x) => x.karyawan_id === karyawanId && x["nama (bantu)"] && x["nama (bantu)"] !== "Karyawan"
  );
  if (k?.["nama (bantu)"]) return k["nama (bantu)"];
  if (fallback && fallback !== "Karyawan") return fallback;
  return "Karyawan";
}

export default function PengaturanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"divisi" | "libur" | "kuota" | "audit">("divisi");
  const [filterAksi, setFilterAksi] = useState("Semua");

  // State Karyawan keseluruhan dari master profiles
  const [allEmployees, setAllEmployees] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_profiles_overrides");
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return profilesData as any[];
  });

  // Helper Resolusi Nama Karyawan Real-time dari State allEmployees dan profiles
  const getEmployeeName = useCallback(
    (karyawanId: string, fallbackName?: string): string => {
      if (!karyawanId && fallbackName && fallbackName !== "Karyawan") return fallbackName;
      const foundInAll = allEmployees.find(
        (p: any) =>
          p.id === karyawanId ||
          p.nik_karyawan === karyawanId ||
          p.seed_id === karyawanId ||
          p.uid === karyawanId
      );
      if (foundInAll?.nama_lengkap) return foundInAll.nama_lengkap;
      return resolveSeedEmployeeName(karyawanId, fallbackName);
    },
    [allEmployees]
  );

  // State Jatah Kuota Cuti Karyawan (PRD BR-04 & ERD kuota_cuti)
  const [kuotaList, setKuotaList] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_kuota_cuti_store");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Gabungkan seed dengan cache secara unik berdasarkan id
            const map = new Map<string, any>();
            (kuotaCutiData as any[]).forEach((item) => {
              const yr = item.tahun === 2028 ? 2026 : item.tahun;
              const key = item.id || `${item.karyawan_id}_${yr}`;
              const empName = resolveSeedEmployeeName(item.karyawan_id, item["nama (bantu)"]);
              map.set(key, { ...item, id: key, tahun: yr, "nama (bantu)": empName });
            });
            parsed.forEach((item: any) => {
              const yr = item.tahun === 2028 ? 2026 : (Number(item.tahun) || 2026);
              const key = item.id || `${item.karyawan_id}_${yr}`;
              const empName = resolveSeedEmployeeName(item.karyawan_id, item["nama (bantu)"]);
              map.set(key, { ...item, id: key, tahun: yr, "nama (bantu)": empName });
            });
            return Array.from(map.values());
          }
        }
      } catch (e) {}
    }
    return (kuotaCutiData as any[]).map((k) => ({
      ...k,
      tahun: k.tahun === 2028 ? 2026 : k.tahun,
      "nama (bantu)": resolveSeedEmployeeName(k.karyawan_id, k["nama (bantu)"]),
    }));
  });

  // Filter Tahun untuk Tab Jatah Kuota Cuti (Default: "2026")
  const [filterTahunKuota, setFilterTahunKuota] = useState<string>("2026");

  // State Modal Ubah Jatah Cuti Karyawan (PRD BR-04)
  const [editingKuota, setEditingKuota] = useState<any | null>(null);
  const [inputJatahHari, setInputJatahHari] = useState<number | string>(12);
  const [editKuotaError, setEditKuotaError] = useState<string | null>(null);
  const [isSubmittingKuota, setIsSubmittingKuota] = useState(false);

  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // State Hari Libur (PRD US-08: HRD mengelola hari libur)
  const [hariLiburList, setHariLiburList] = useState<HariLibur[]>(() => getStoredHolidays());
  const [filterTahunLibur, setFilterTahunLibur] = useState<string>("2026");

  // State Toast Notification (Sukses & Gagal)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // State Modal Tambah Hari Libur
  const [isAddLiburOpen, setIsAddLiburOpen] = useState(false);
  const [newLiburTanggal, setNewLiburTanggal] = useState("");
  const [newLiburKeterangan, setNewLiburKeterangan] = useState("");
  const [newLiburJenis, setNewLiburJenis] = useState<JenisHariLibur>("nasional");
  const [addLiburError, setAddLiburError] = useState<string | null>(null);
  const [isSubmittingLibur, setIsSubmittingLibur] = useState(false);

  // State Modal Edit Hari Libur
  const [editingLibur, setEditingLibur] = useState<HariLibur | null>(null);
  const [editLiburKeterangan, setEditLiburKeterangan] = useState("");
  const [editLiburJenis, setEditLiburJenis] = useState<JenisHariLibur>("nasional");
  const [editLiburError, setEditLiburError] = useState<string | null>(null);
  const [isSubmittingEditLibur, setIsSubmittingEditLibur] = useState(false);

  // State Modal Konfirmasi Hapus Hari Libur
  const [deletingLibur, setDeletingLibur] = useState<HariLibur | null>(null);
  const [isDeletingLibur, setIsDeletingLibur] = useState(false);

  // State Divisi & Atasan dengan persistence localStorage & Firestore sync
  const [divisiList, setDivisiList] = useState<any[]>(divisiData as any[]);


  // State Audit Log aktivitas
  const [auditLogList, setAuditLogList] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_audit_log_store");
        if (stored) {
          const parsed = JSON.parse(stored);
          const map = new Map<string, any>();
          parsed.forEach((item: any) => map.set(item.id, item));
          (auditLogData as Array<any>).forEach((item: any) => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values());
        }
      } catch (e) {}
    }
    return auditLogData as Array<any>;
  });

  // Inisialisasi data divisi & profil karyawan
  useEffect(() => {
    let cachedDivisi: any[] = [];
    try {
      const stored = localStorage.getItem("karsahr_divisi_list");
      if (stored) {
        cachedDivisi = JSON.parse(stored);
        setDivisiList(cachedDivisi);
      }
    } catch (e) {
      console.error(e);
    }

    // Ambil data profiles dan divisi secara bersamaan untuk memastikan resolusi nama manajer akurat
    Promise.all([
      fetchEmployeesFromFirestore(),
      getDocs(collection(db, "divisi")).catch(() => null),
    ])
      .then(([empList, divSnap]) => {
        const employees = empList && empList.length ? empList : allEmployees;
        if (empList && empList.length) {
          setAllEmployees(empList);
        }

        if (divSnap && !divSnap.empty) {
          const remoteList: any[] = [];
          divSnap.forEach((docSnap) => {
            remoteList.push({ ...docSnap.data(), id: docSnap.id });
          });

          const localMap = new Map<string, any>();
          cachedDivisi.forEach((d) => localMap.set(d.id, d));

          const mapped = remoteList.map((d) => {
            const local = localMap.get(d.id);
            const fallback = local?.["manajer (bantu)"] || d["manajer (bantu)"] || null;

            let mgr =
              employees.find(
                (p: any) =>
                  (d.manajer_id && (p.id === d.manajer_id || p.nik_karyawan === d.manajer_id || p.seed_id === d.manajer_id)) ||
                  (fallback && p.nama_lengkap === fallback)
              ) ||
              (profilesData as any[]).find(
                (p: any) =>
                  (d.manajer_id && (p.id === d.manajer_id || p.nik_karyawan === d.manajer_id)) ||
                  (fallback && p.nama_lengkap === fallback)
              );

            if (!mgr && d.manajer_id) {
              const seedP = (profilesData as any[]).find((sp) => sp.id === d.manajer_id || sp.nik_karyawan === d.manajer_id);
              if (seedP) {
                mgr = employees.find((p: any) => p.email?.toLowerCase() === seedP.email?.toLowerCase() || p.nik_karyawan === seedP.nik_karyawan);
              }
            }

            if (!mgr && !d.manajer_id) {
              const seedDiv = (divisiData as any[]).find((sd) => sd.id === d.id);
              if (seedDiv && seedDiv.manajer_id) {
                const seedP = (profilesData as any[]).find((sp) => sp.id === seedDiv.manajer_id);
                if (seedP) {
                  mgr = employees.find((p: any) => p.email?.toLowerCase() === seedP.email?.toLowerCase() || p.nik_karyawan === seedP.nik_karyawan);
                }
              }
            }

            if (mgr) {
              return {
                ...d,
                manajer_id: mgr.id || d.manajer_id,
                "manajer (bantu)": mgr.nama_lengkap || fallback,
              };
            }

            if (d.manajer_id) {
              return {
                ...d,
                "manajer (bantu)": fallback,
              };
            }

            return { ...d, "manajer (bantu)": null };
          });

          setDivisiList(mapped);
          try {
            localStorage.setItem("karsahr_divisi_list", JSON.stringify(mapped));
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn("Inisialisasi divisi & profil:", err);
      });

    // Inisialisasi daftar hari libur dari Firestore Database (PRD US-08)
    fetchHolidaysFromFirestore()
      .then((remoteHolidays) => {
        if (remoteHolidays && remoteHolidays.length > 0) {
          setHariLiburList(remoteHolidays);
        }
      })
      .catch((err) => {
        console.warn("Inisialisasi hari libur remote warning:", err);
      });

    // Inisialisasi data kuota cuti dari Firestore Database (PRD BR-04 & BR-06)
    getDocs(collection(db, "kuota_cuti"))
      .then((kuotaSnap) => {
        if (!kuotaSnap.empty) {
          const remoteKuota: any[] = [];
          kuotaSnap.forEach((docSnap) => {
            const d = docSnap.data();
            // Normalisasi tahun: jika ada data 2028 keliru, sesuaikan ke 2026
            const yr = d.tahun === 2028 ? 2026 : (Number(d.tahun) || 2026);
            remoteKuota.push({
              id: docSnap.id,
              ...d,
              tahun: yr,
            });
          });

          setKuotaList((prev) => {
            const map = new Map<string, any>();
            prev.forEach((p) => {
              const uniqueKey = p.id || `${p.karyawan_id}_${p.tahun}`;
              map.set(uniqueKey, { ...p, id: uniqueKey });
            });
            remoteKuota.forEach((r) => {
              const existingByKey = map.get(r.id) || map.get(`${r.karyawan_id}_${r.tahun}`);
              const finalId = r.id || existingByKey?.id || `${r.karyawan_id}_${r.tahun}`;
              const realName = resolveSeedEmployeeName(r.karyawan_id, existingByKey?.["nama (bantu)"]);
              map.set(finalId, {
                ...existingByKey,
                ...r,
                id: finalId,
                "nama (bantu)": realName,
              });
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem("karsahr_kuota_cuti_store", JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn("Inisialisasi kuota_cuti Firestore warning:", err);
      });
  }, []);

  const saveDivisiList = (newList: any[]) => {
    setDivisiList(newList);
    try {
      localStorage.setItem("karsahr_divisi_list", JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Helper untuk menyelesaikan nama manajer secara konsisten (id, nik, atau seed_id)
   */
  const resolveManagerName = (manajerId: string | null | undefined, fallbackName?: string | null) => {
    if (!manajerId) return fallbackName || null;
    const found =
      allEmployees.find(
        (p) =>
          p.id === manajerId ||
          p.nik_karyawan === manajerId ||
          (p.seed_id && p.seed_id === manajerId)
      ) ||
      (profilesData as any[]).find(
        (p) =>
          p.id === manajerId ||
          p.nik_karyawan === manajerId ||
          (fallbackName && p.nama_lengkap === fallbackName)
      );
    return found?.nama_lengkap || fallbackName || null;
  };

  /**
   * Filter Role User & Cegah Duplikasi Data:
   * Ambil hanya karyawan dengan peran = 'atasan' DAN aktif = true (aktif !== false).
   * Gunakan Map berdasar ID untuk deduplikasi strictly unique.
   * Staf biasa ('karyawan') atau 'hrd' tidak boleh muncul.
   */
  const atasanList = useMemo(() => {
    const uniqueMap = new Map<string, any>();
    allEmployees.forEach((emp) => {
      if (emp.peran === "atasan" && emp.aktif !== false) {
        const key = emp.id || emp.nik_karyawan;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, emp);
        }
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) =>
      (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "")
    );
  }, [allEmployees]);

  /**
   * Helper multi-strategi untuk mencocokkan Divisi dengan objek Atasannya secara akurat.
   * Mendukung pencocokan via Auth UID, Seed UUID, NIK Karyawan, nama_lengkap, email,
   * maupun relasi divisi awal di profilesData.
   */
  const findAtasanForDivision = (div: any) => {
    if (!div) return null;
    const manajerId = div.manajer_id;
    const fallbackName = div["manajer (bantu)"];

    // 1. Pencocokan langsung pada atasanList
    let matched = atasanList.find(
      (p) =>
        (manajerId && (p.id === manajerId || p.nik_karyawan === manajerId || p.seed_id === manajerId)) ||
        (fallbackName && p.nama_lengkap === fallbackName)
    );
    if (matched) return matched;

    // 2. Pencocokan silang melalui seed data profiles.json
    if (manajerId) {
      const seedProfile = (profilesData as any[]).find(
        (sp) => sp.id === manajerId || sp.nik_karyawan === manajerId
      );
      if (seedProfile) {
        matched = atasanList.find(
          (p) =>
            p.email?.toLowerCase() === seedProfile.email?.toLowerCase() ||
            p.nik_karyawan === seedProfile.nik_karyawan ||
            p.nama_lengkap === seedProfile.nama_lengkap
        );
        if (matched) return matched;
      }
    }

    // 3. Fallback pencocokan berdasarkan divisi_id di master profiles awal jika divisi tersebut terikat atasan
    const seedDivManager = (profilesData as any[]).find(
      (sp) => sp.peran === "atasan" && sp.divisi_id === div.id
    );
    if (seedDivManager) {
      matched = atasanList.find(
        (p) =>
          p.email?.toLowerCase() === seedDivManager.email?.toLowerCase() ||
          p.nik_karyawan === seedDivManager.nik_karyawan ||
          p.nama_lengkap === seedDivManager.nama_lengkap
      );
      if (matched) return matched;
    }

    return null;
  };

  /**
   * Pemetaan Atasan:
   * Satu atasan hanya memimpin paling banyak satu divisi.
   * Map ini memetakan: manajer_id -> { divisiId, divisiNama }
   */
  const managerDivisionMap = useMemo(() => {
    const map = new Map<string, { divisiId: string; divisiNama: string }>();
    divisiList.forEach((div) => {
      const atasan = findAtasanForDivision(div);
      if (atasan) {
        if (atasan.id) map.set(atasan.id, { divisiId: div.id, divisiNama: div.nama });
        if (atasan.seed_id) map.set(atasan.seed_id, { divisiId: div.id, divisiNama: div.nama });
        if (atasan.nik_karyawan) map.set(atasan.nik_karyawan, { divisiId: div.id, divisiNama: div.nama });
        if (atasan.nama_lengkap) map.set(atasan.nama_lengkap, { divisiId: div.id, divisiNama: div.nama });
      }
      if (div.manajer_id) {
        map.set(div.manajer_id, { divisiId: div.id, divisiNama: div.nama });
      }
    });
    return map;
  }, [divisiList, allEmployees, atasanList]);

  // State Modal Tambah Divisi
  const [isAddDivisiOpen, setIsAddDivisiOpen] = useState(false);
  const [newDivisiName, setNewDivisiName] = useState("");
  const [newDivisiManagerId, setNewDivisiManagerId] = useState("");

  // State Modal Atur Atasan
  const [isAturAtasanOpen, setIsAturAtasanOpen] = useState(false);
  const [editingDivisi, setEditingDivisi] = useState<any | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

  const handleOpenAddDivisi = () => {
    setNewDivisiName("");
    setNewDivisiManagerId("");
    setIsAddDivisiOpen(true);
  };

  const handleSaveAddDivisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivisiName.trim()) {
      alert("Nama divisi tidak boleh kosong.");
      return;
    }

    if (newDivisiManagerId) {
      const existingAssignment = managerDivisionMap.get(newDivisiManagerId);
      if (existingAssignment) {
        alert(
          `Satu atasan hanya boleh memimpin paling banyak satu divisi. Karyawan ini sudah memimpin Divisi "${existingAssignment.divisiNama}".`
        );
        return;
      }
    }

    const selectedEmployee = atasanList.find((p) => p.id === newDivisiManagerId);

    const newDiv: any = {
      id: `div-${Date.now()}`,
      nama: newDivisiName.trim(),
      manajer_id: selectedEmployee ? selectedEmployee.id : null,
      "manajer (bantu)": selectedEmployee ? selectedEmployee.nama_lengkap : null,
    };

    const updated = [...divisiList, newDiv];
    saveDivisiList(updated);

    // Sync Firestore & audit log
    try {
      await setDoc(doc(db, "divisi", newDiv.id), {
        id: newDiv.id,
        nama: newDiv.nama,
        manajer_id: newDiv.manajer_id,
      });

      const nowIso = new Date().toISOString();
      const auditEntry = {
        id: "audit-" + Date.now(),
        pelaku_id: user?.id || "hrd-current",
        "pelaku (bantu)": user?.nama_lengkap || "HRD Admin",
        aksi: "INSERT",
        nama_tabel: "divisi",
        data_id: newDiv.id,
        nilai_sebelum: null,
        nilai_sesudah: JSON.stringify({ nama: newDiv.nama, manajer_id: newDiv.manajer_id }),
        dibuat_pada: nowIso,
      };
      await addDoc(collection(db, "audit_log"), auditEntry);

      const storedAudit = localStorage.getItem("karsahr_audit_log_store");
      const list = storedAudit ? JSON.parse(storedAudit) : [];
      list.unshift(auditEntry);
      localStorage.setItem("karsahr_audit_log_store", JSON.stringify(list));
      setAuditLogList((prev) => [auditEntry, ...prev]);
    } catch (err) {
      console.warn("Firestore sync warning for new divisi:", err);
    }

    setIsAddDivisiOpen(false);
    setEditSuccess(`Divisi "${newDiv.nama}" berhasil ditambahkan.`);
    setTimeout(() => setEditSuccess(null), 3000);
  };

  const handleOpenAturAtasan = (divisi: any) => {
    setEditingDivisi(divisi);
    const matched = findAtasanForDivision(divisi);
    setSelectedManagerId(matched ? matched.id : "");
    setIsAturAtasanOpen(true);
  };

  const handleSaveAturAtasan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDivisi) return;

    if (selectedManagerId) {
      const existingAssignment = managerDivisionMap.get(selectedManagerId);
      if (existingAssignment && existingAssignment.divisiId !== editingDivisi.id) {
        alert(
          `Satu atasan hanya boleh memimpin paling banyak satu divisi. Karyawan ini sudah memimpin Divisi "${existingAssignment.divisiNama}".`
        );
        return;
      }
    }

    const selectedEmployee = atasanList.find((p) => p.id === selectedManagerId);
    const prevManagerId = editingDivisi.manajer_id;

    const updated = divisiList.map((d) => {
      if (d.id === editingDivisi.id) {
        return {
          ...d,
          manajer_id: selectedEmployee ? selectedEmployee.id : null,
          "manajer (bantu)": selectedEmployee ? selectedEmployee.nama_lengkap : null,
        };
      }
      return d;
    });

    saveDivisiList(updated);

    // Sync Firestore & audit log
    try {
      await updateDoc(doc(db, "divisi", editingDivisi.id), {
        manajer_id: selectedEmployee ? selectedEmployee.id : null,
      });

      const nowIso = new Date().toISOString();
      const auditEntry = {
        id: "audit-" + Date.now(),
        pelaku_id: user?.id || "hrd-current",
        "pelaku (bantu)": user?.nama_lengkap || "HRD Admin",
        aksi: "UPDATE",
        nama_tabel: "divisi",
        data_id: editingDivisi.id,
        nilai_sebelum: JSON.stringify({ manajer_id: prevManagerId, nama: editingDivisi.nama }),
        nilai_sesudah: JSON.stringify({
          manajer_id: selectedEmployee ? selectedEmployee.id : null,
          nama: editingDivisi.nama,
        }),
        dibuat_pada: nowIso,
      };
      await addDoc(collection(db, "audit_log"), auditEntry);

      const storedAudit = localStorage.getItem("karsahr_audit_log_store");
      const list = storedAudit ? JSON.parse(storedAudit) : [];
      list.unshift(auditEntry);
      localStorage.setItem("karsahr_audit_log_store", JSON.stringify(list));
      setAuditLogList((prev) => [auditEntry, ...prev]);
    } catch (err) {
      console.warn("Firestore sync warning for divisi manager update:", err);
    }

    setIsAturAtasanOpen(false);
    setEditSuccess(
      selectedEmployee
        ? `Manajer divisi "${editingDivisi.nama}" berhasil diatur ke ${selectedEmployee.nama_lengkap}.`
        : `Posisi manajer divisi "${editingDivisi.nama}" berhasil dikosongkan (Belum Ditugaskan).`
    );
    setTimeout(() => setEditSuccess(null), 3000);
  };

  // Filter Tahun & Ekstraksi Daftar Tahun untuk Kuota Cuti (Multi-tahun dinamis: 2024 - 2032)
  const availableYearsKuota = useMemo(() => {
    const yearsSet = new Set<string>();
    for (let yr = 2024; yr <= 2032; yr++) {
      yearsSet.add(String(yr));
    }
    kuotaList.forEach((k) => {
      if (k.tahun) yearsSet.add(String(k.tahun));
    });
    return Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
  }, [kuotaList]);

  // Daftar Kuota Cuti Terfilter Berdasarkan Tahun Aktif (WHERE tahun = selectedYear)
  const filteredKuotaList = useMemo(() => {
    return kuotaList
      .filter((k) => {
        if (filterTahunKuota === "Semua") return true;
        return String(k.tahun) === filterTahunKuota;
      })
      .sort((a, b) => (a["nama (bantu)"] || "").localeCompare(b["nama (bantu)"] || ""));
  }, [kuotaList, filterTahunKuota]);

  // Handler Buka Modal Ubah Jatah Cuti (PRD BR-04)
  const handleOpenEditKuota = (item: any) => {
    setEditingKuota(item);
    setInputJatahHari(item.jatah_hari);
    setEditKuotaError(null);
  };

  // Handler Simpan Perubahan Jatah Cuti Karyawan (UPDATE)
  const handleSaveEditKuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKuota) return;
    setEditKuotaError(null);

    const num = Number(inputJatahHari);
    if (isNaN(num) || !Number.isInteger(num)) {
      setEditKuotaError("Jatah cuti harus berupa angka bilangan bulat (bukan desimal atau teks).");
      return;
    }
    if (num < 0 || num > 12) {
      setEditKuotaError("Jatah cuti tahunan harus antara 0 sampai 12 hari kerja.");
      return;
    }

    setIsSubmittingKuota(true);
    try {
      const nowIso = new Date().toISOString();
      const prevJatah = editingKuota.jatah_hari;
      const terpakai = Number(editingKuota.terpakai_hari) || 0;
      const newSisa = Math.max(0, num - terpakai);

      // 1. Simpan ke Firestore jika terhubung
      try {
        await updateDoc(doc(db, "kuota_cuti", editingKuota.id), {
          jatah_hari: num,
          sisa_kuota: newSisa,
          updated_at: nowIso,
        });
      } catch (errDb) {
        console.warn("Firestore update kuota_cuti sync warning:", errDb);
      }

      // 2. Catat ke Audit Log sesuai PRD BR-12
      const auditEntry = {
        id: "audit-" + Date.now(),
        pelaku_id: user?.id || "hrd-current",
        "pelaku (bantu)": user?.nama_lengkap || user?.email || "HRD Admin",
        aksi: "UPDATE",
        nama_tabel: "kuota_cuti",
        data_id: editingKuota.id,
        nilai_sebelum: JSON.stringify({
          karyawan: editingKuota["nama (bantu)"],
          tahun: editingKuota.tahun,
          jatah_hari: prevJatah,
          terpakai_hari: terpakai,
        }),
        nilai_sesudah: JSON.stringify({
          karyawan: editingKuota["nama (bantu)"],
          tahun: editingKuota.tahun,
          jatah_hari: num,
          terpakai_hari: terpakai,
          sisa_kuota: newSisa,
        }),
        dibuat_pada: nowIso,
      };
      await addDoc(collection(db, "audit_log"), auditEntry).catch(() => {});

      if (typeof window !== "undefined") {
        const storedAudit = localStorage.getItem("karsahr_audit_log_store");
        const list = storedAudit ? JSON.parse(storedAudit) : [];
        list.unshift(auditEntry);
        localStorage.setItem("karsahr_audit_log_store", JSON.stringify(list));
      }
      setAuditLogList((prev) => [auditEntry, ...prev]);

      // 3. Perbarui Local State & LocalStorage
      setKuotaList((prev) => {
        const updated = prev.map((k) =>
          k.id === editingKuota.id ? { ...k, jatah_hari: num, "sisa (bantu)": newSisa } : k
        );
        try {
          localStorage.setItem("karsahr_kuota_cuti_store", JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      showToast(`Jatah cuti ${editingKuota["nama (bantu)"]} (${editingKuota.tahun}) berhasil diubah menjadi ${num} hari.`, "success");
      setEditingKuota(null);
    } catch (err: any) {
      setEditKuotaError(err?.message || "Terjadi kesalahan saat menyimpan perubahan jatah cuti.");
    } finally {
      setIsSubmittingKuota(false);
    }
  };

  // Helper Format Tanggal Tampilan Indonesia (Contoh: "Kamis, 1 Jan 2026")
  const formatIndoDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const dayName = days[d.getDay()] || "";
        const monthName = months[parseInt(parts[1], 10) - 1] || "";
        return `${dayName}, ${parseInt(parts[2], 10)} ${monthName} ${parts[0]}`;
      }
    } catch (e) {}
    return dateStr;
  };

  // Filter Tahun & Ekstraksi Daftar Tahun Kalender (Tanpa new Date() saat prerender untuk kompatibilitas Next.js)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    // Rentang tahun standar aplikasi: dari 2024 hingga 2032
    for (let yr = 2024; yr <= 2032; yr++) {
      yearsSet.add(String(yr));
    }

    // Selalu masukkan tahun berapa pun yang terdaftar pada database hari_libur
    hariLiburList.forEach((h) => {
      const y = h.tanggal?.slice(0, 4);
      if (y && !isNaN(Number(y))) yearsSet.add(y);
    });

    return Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
  }, [hariLiburList]);

  // Daftar Hari Libur Terfilter Berdasarkan Tahun Aktif (dan terurut kronologis)
  const filteredHariLibur = useMemo(() => {
    return hariLiburList
      .filter((item) => {
        if (filterTahunLibur === "Semua") return true;
        return item.tanggal?.startsWith(filterTahunLibur);
      })
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [hariLiburList, filterTahunLibur]);

  // Handler Buka Modal Tambah Hari Libur (Prefill tahun mengikuti filter aktif)
  const handleOpenAddLibur = () => {
    const activeYear = filterTahunLibur !== "Semua" ? filterTahunLibur : "2026";
    setNewLiburTanggal(`${activeYear}-01-01`);
    setNewLiburKeterangan("");
    setNewLiburJenis("nasional");
    setAddLiburError(null);
    setIsAddLiburOpen(true);
  };

  // Handler Simpan Hari Libur Baru (CREATE)
  const handleSaveAddLibur = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLiburError(null);

    const cleanTanggal = newLiburTanggal.trim();
    const cleanKeterangan = newLiburKeterangan.trim();

    if (!cleanTanggal) {
      setAddLiburError("Tanggal wajib dipilih.");
      return;
    }
    if (!cleanKeterangan) {
      setAddLiburError("Keterangan hari libur wajib diisi.");
      return;
    }

    // Validasi Unik / Primary Key (PK) di tabel hari_libur
    const isDuplicate = hariLiburList.some((h) => h.tanggal === cleanTanggal);
    if (isDuplicate) {
      setAddLiburError(`Tanggal ${cleanTanggal} sudah terdaftar sebagai hari libur (Primary Key unik).`);
      return;
    }

    setIsSubmittingLibur(true);
    try {
      const added = await createHoliday(
        {
          tanggal: cleanTanggal,
          keterangan: cleanKeterangan,
          jenis: newLiburJenis,
        },
        user
      );

      setHariLiburList((prev) => {
        const next = [...prev, added].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        return next;
      });

      // Jika tahun baru berbeda dengan filter aktif, sinkronkan filter ke tahun tersebut
      const addedYear = cleanTanggal.slice(0, 4);
      if (filterTahunLibur !== "Semua" && filterTahunLibur !== addedYear) {
        setFilterTahunLibur(addedYear);
      }

      setIsAddLiburOpen(false);
      showToast(`Hari libur "${added.keterangan}" (${added.tanggal}) berhasil ditambahkan.`, "success");
    } catch (err: any) {
      const msg = err?.message || "Gagal menyimpan data hari libur.";
      setAddLiburError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmittingLibur(false);
    }
  };

  // Handler Buka Modal Edit Hari Libur (UPDATE)
  const handleOpenEditLibur = (item: HariLibur) => {
    setEditingLibur(item);
    setEditLiburKeterangan(item.keterangan);
    setEditLiburJenis(item.jenis);
    setEditLiburError(null);
  };

  // Handler Simpan Perubahan Hari Libur (UPDATE)
  const handleSaveEditLibur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLibur) return;
    setEditLiburError(null);

    const cleanKeterangan = editLiburKeterangan.trim();
    if (!cleanKeterangan) {
      setEditLiburError("Keterangan hari libur wajib diisi.");
      return;
    }

    setIsSubmittingEditLibur(true);
    try {
      const updated = await updateHoliday(
        {
          tanggal: editingLibur.tanggal,
          keterangan: cleanKeterangan,
          jenis: editLiburJenis,
        },
        user
      );

      setHariLiburList((prev) =>
        prev.map((h) => (h.tanggal === updated.tanggal ? updated : h))
      );

      setEditingLibur(null);
      showToast(`Hari libur "${updated.keterangan}" (${updated.tanggal}) berhasil diperbarui.`, "success");
    } catch (err: any) {
      const msg = err?.message || "Gagal memperbarui data hari libur.";
      setEditLiburError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmittingEditLibur(false);
    }
  };

  // Handler Buka Modal Hapus Hari Libur (DELETE)
  const handleOpenDeleteLibur = (item: HariLibur) => {
    setDeletingLibur(item);
  };

  // Handler Konfirmasi Hapus Hari Libur (DELETE)
  const handleConfirmDeleteLibur = async () => {
    if (!deletingLibur) return;
    setIsDeletingLibur(true);
    try {
      await deleteHoliday(deletingLibur.tanggal, user);
      setHariLiburList((prev) => prev.filter((h) => h.tanggal !== deletingLibur.tanggal));
      showToast(`Hari libur "${deletingLibur.keterangan}" (${deletingLibur.tanggal}) berhasil dihapus dari database.`, "success");
      setDeletingLibur(null);
    } catch (err: any) {
      const msg = err?.message || "Gagal menghapus hari libur.";
      showToast(msg, "error");
    } finally {
      setIsDeletingLibur(false);
    }
  };

  const filteredAudit = auditLogList.filter((log) => {
    if (filterAksi !== "Semua" && !log.aksi?.toLowerCase().includes(filterAksi.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="pengaturan-page-wrap">
      <div className="header-row">
        <div>
          <h2 className="page-title">Pengaturan Sistem (HRD)</h2>
          <p className="page-sub">
            Konfigurasi struktur organisasi divisi, kalender libur operasional, kuota tahunan, dan log audit sistem.
          </p>
        </div>
      </div>

      {editSuccess && <div className="alert-success">{editSuccess}</div>}

      {/* Tabs Navigasi Pengaturan Sesuai PRD Bab 7 */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab("divisi")}
          className={`tab-btn ${activeTab === "divisi" ? "active" : ""}`}
        >
          Divisi &amp; Atasan
        </button>
        <button
          onClick={() => setActiveTab("libur")}
          className={`tab-btn ${activeTab === "libur" ? "active" : ""}`}
        >
          Daftar Hari Libur
        </button>
        <button
          onClick={() => setActiveTab("kuota")}
          className={`tab-btn ${activeTab === "kuota" ? "active" : ""}`}
        >
          Jatah Kuota Cuti Karyawan
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
        >
          Audit Log Aktivitas
        </button>
      </div>

      {/* Tab 1: Divisi & Atasan */}
      {activeTab === "divisi" && (
        <div className="ui-card">
          <div className="tab-header">
            <div className="title-with-info">
              <h3 className="section-title">Struktur Divisi &amp; Manajer Atasan</h3>
              <div className="info-tooltip-wrap">
                <button
                  type="button"
                  className="info-icon-btn"
                  aria-label="Informasi aturan divisi"
                >
                  <svg
                    className="info-svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className="tooltip-bubble">
                  Setiap divisi dipimpin paling banyak satu atasan, dan satu atasan hanya dapat memimpin satu divisi.
                </div>
              </div>
            </div>

            <button
              onClick={handleOpenAddDivisi}
              className="btn-add-divisi"
              title="Tambah Divisi Baru"
            >
              <span style={{ fontSize: "1rem", lineHeight: 1 }}>+</span>
              <span>Tambah Divisi</span>
            </button>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>NAMA DIVISI</th>
                  <th>MANAJER (ATASAN)</th>
                  <th>STATUS PEMIMPIN</th>
                  <th style={{ textAlign: "right", paddingRight: "1rem" }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {divisiList.map((d) => {
                  const matched = findAtasanForDivision(d);
                  const managerName = matched?.nama_lengkap || resolveManagerName(d.manajer_id, d["manajer (bantu)"]);
                  const hasManager = Boolean(matched || (d.manajer_id && managerName));
                  return (
                    <tr key={d.id}>
                      <td className="font-semibold text-slate-800">{d.nama}</td>
                      <td>
                        {hasManager ? (
                          <span className="text-dark font-medium">{managerName}</span>
                        ) : (
                          <span className="text-muted italic text-xs">Belum ditugaskan</span>
                        )}
                      </td>
                      <td>
                        {hasManager ? (
                          <span className="status-badge-aktif">
                            <span className="status-dot-green"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="status-badge-belum">
                            <span className="status-dot-amber"></span>
                            Belum Ditugaskan
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "1rem" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenAturAtasan(d)}
                          className="btn-action-edit"
                          title={`Atur atasan untuk divisi ${d.nama}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Atur Atasan</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Hari Libur (PRD US-08: HRD Mengelola Hari Libur) */}
      {activeTab === "libur" && (
        <div className="ui-card">
          <div className="tab-header">
            <div>
              <div className="title-with-info">
                <h3 className="section-title">
                  Hari Libur Perusahaan &amp; Nasional {filterTahunLibur !== "Semua" ? `(Tahun ${filterTahunLibur})` : "(Semua Tahun)"}
                </h3>
                <span className="count-badge">{filteredHariLibur.length} Hari Libur</span>
              </div>
              <span className="caption-tag">
                Digunakan otomatis untuk kalkulasi hari kerja saat pengajuan cuti tahunan, sakit, dan izin.
              </span>
            </div>

            {/* Area Kanan Atas: Filter Tahun dan Tombol Tambah Hari Libur (Sejajar dengan Judul Tab) */}
            <div className="header-controls">
              <div className="filter-item-wrap">
                <label htmlFor="filter-tahun-libur" className="lbl-mini">
                  Tahun:
                </label>
                <select
                  id="filter-tahun-libur"
                  value={filterTahunLibur}
                  onChange={(e) => setFilterTahunLibur(e.target.value)}
                  className="select-mini"
                  title="Pilih tahun kalender hari libur"
                >
                  <option value="Semua">Semua Tahun</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleOpenAddLibur}
                className="btn-add-primary"
                title="Tambah Hari Libur Baru"
              >
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>+</span>
                <span>Tambah Hari Libur</span>
              </button>
            </div>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              {filteredHariLibur.length > 0 && (
                <thead>
                  <tr>
                    <th style={{ width: "220px" }}>TANGGAL</th>
                    <th>KETERANGAN HARI LIBUR</th>
                    <th style={{ width: "170px" }}>JENIS LIBUR</th>
                    <th style={{ width: "160px", textAlign: "right", paddingRight: "1rem" }}>AKSI</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {filteredHariLibur.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "4rem 1.5rem", color: "#64748b", border: "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ marginBottom: "0.25rem" }}
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <h4 style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "#1e293b" }}>
                          {filterTahunLibur !== "Semua"
                            ? `Belum ada data hari libur untuk tahun ${filterTahunLibur}`
                            : "Belum ada data hari libur"}
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b", maxWidth: "440px", lineHeight: 1.5 }}>
                          Tambahkan jadwal hari libur nasional atau operasional perusahaan untuk tahun ini.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHariLibur.map((item) => (
                    <tr key={item.tanggal}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span className="font-mono font-bold text-dark">{item.tanggal}</span>
                          <span className="text-muted" style={{ fontSize: "0.71875rem" }}>
                            {formatIndoDateDisplay(item.tanggal)}
                          </span>
                        </div>
                      </td>
                      <td className="font-semibold text-slate-800">{item.keterangan}</td>
                      <td>
                        {item.jenis === "nasional" ? (
                          <span className="holiday-badge-nasional">
                            <span className="badge-dot-blue"></span>
                            Nasional
                          </span>
                        ) : item.jenis === "cuti_bersama" ? (
                          <span className="holiday-badge-cuti-bersama">
                            <span className="badge-dot-amber"></span>
                            Cuti Bersama
                          </span>
                        ) : (
                          <span className="holiday-badge-perusahaan">
                            <span className="badge-dot-purple"></span>
                            Perusahaan
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "1rem" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditLibur(item)}
                            className="btn-action-edit"
                            title={`Ubah keterangan dan jenis libur ${item.keterangan}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteLibur(item)}
                            className="btn-action-delete"
                            title={`Hapus hari libur ${item.keterangan} dari sistem`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Jatah Kuota Cuti Karyawan (PRD BR-04 & ERD kuota_cuti) */}
      {activeTab === "kuota" && (
        <div className="ui-card">
          <div className="tab-header">
            <div>
              <div className="title-with-info">
                <h3 className="section-title">
                  Jatah Cuti Tahunan Karyawan {filterTahunKuota !== "Semua" ? `(Tahun ${filterTahunKuota})` : "(Semua Periode)"}
                </h3>
                <span className="count-badge">{filteredKuotaList.length} Karyawan</span>
              </div>
              <span className="caption-tag">
                Ditetapkan HRD per karyawan paling banyak 12 hari kerja per tahun kalender.
              </span>
            </div>

            {/* Filter Tahun untuk Kuota Cuti */}
            <div className="header-controls">
              <div className="filter-item-wrap">
                <label htmlFor="filter-tahun-kuota" className="lbl-mini">
                  Tahun:
                </label>
                <select
                  id="filter-tahun-kuota"
                  value={filterTahunKuota}
                  onChange={(e) => setFilterTahunKuota(e.target.value)}
                  className="select-mini"
                  title="Pilih tahun periode jatah cuti"
                >
                  <option value="Semua">Semua Tahun</option>
                  {availableYearsKuota.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              {filteredKuotaList.length > 0 && (
                <thead>
                  <tr>
                    <th>NAMA KARYAWAN</th>
                    <th style={{ width: "110px", textAlign: "center" }}>TAHUN</th>
                    <th style={{ width: "130px" }}>JATAH HARI</th>
                    <th style={{ width: "160px" }}>TERPAKAI / DIAJUKAN</th>
                    <th style={{ width: "130px" }}>SISA KUOTA</th>
                    <th>CATATAN KASUS</th>
                    <th style={{ width: "140px", textAlign: "right", paddingRight: "1rem" }}>AKSI HRD</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {filteredKuotaList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "4rem 1.5rem", color: "#64748b", border: "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ marginBottom: "0.25rem" }}
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <h4 style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "#1e293b" }}>
                          {filterTahunKuota !== "Semua"
                            ? `Belum ada data kuota cuti untuk tahun ${filterTahunKuota}`
                            : "Belum ada data kuota cuti"}
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b", maxWidth: "440px", lineHeight: 1.5 }}>
                          Data jatah cuti karyawan pada periode tahun ini belum dialokasikan.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredKuotaList.map((k, idx) => {
                    const sisa = Number(k.jatah_hari) - Number(k.terpakai_hari);
                    const rowKey = `${k.id || k.karyawan_id}_${k.tahun}_${idx}`;
                    return (
                      <tr key={rowKey}>
                        <td className="font-semibold">{k["nama (bantu)"]}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="font-mono font-bold text-dark">{k.tahun}</span>
                        </td>
                        <td className="font-bold">{k.jatah_hari} hari</td>
                        <td>{k.terpakai_hari} hari</td>
                        <td>
                          <span className={`status-pill ${sisa > 0 ? "hadir" : "terlambat"}`}>
                            {sisa} hari
                          </span>
                        </td>
                        <td>
                          <span className="case-note">{k["kasus_uji (bantu)"] || "-"}</span>
                        </td>
                        <td style={{ textAlign: "right", paddingRight: "1rem" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditKuota(k)}
                            className="btn-action-edit"
                            title={`Ubah jatah cuti tahunan untuk ${k["nama (bantu)"]}`}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Ubah Jatah</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Log (BR-12) */}
      {activeTab === "audit" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Audit Log Aktivitas Sistem</h3>
            <div className="filter-audit">
              <label className="lbl-mini">Filter Aksi:</label>
              <select
                value={filterAksi}
                onChange={(e) => setFilterAksi(e.target.value)}
                className="select-mini"
              >
                <option value="Semua">Semua Aksi</option>
                <option value="buat">Pembuatan Data</option>
                <option value="ubah">Perubahan Status / Data</option>
                <option value="koreksi">Koreksi Absensi</option>
                <option value="terbit">Penerbitan Slip</option>
              </select>
            </div>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>WAKTU (WIB)</th>
                  <th>PELAKU</th>
                  <th>AKSI</th>
                  <th>TABEL TERKAIT</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((log, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{log.dibuat_pada?.replace("T", " ")?.slice(0, 19) || "-"}</td>
                    <td className="font-semibold">{log["pelaku (bantu)"] || "HRD / Sistem"}</td>
                    <td>
                      <span className="badge-aksi">{log.aksi}</span>
                    </td>
                    <td><span className="font-mono text-muted">{log.nama_tabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah Divisi Baru - Compact & Professional */}
      {isAddDivisiOpen && (
        <div className="modal-overlay" onClick={() => setIsAddDivisiOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah Divisi Baru</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddDivisiOpen(false)}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAddDivisi}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Nama Divisi <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDivisiName}
                    onChange={(e) => setNewDivisiName(e.target.value)}
                    placeholder="Contoh: Pemasaran &amp; Riset"
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label className="form-label">
                    Manajer / Atasan (Opsional)
                  </label>
                  <div className="select-with-clear">
                    <select
                      value={newDivisiManagerId}
                      onChange={(e) => setNewDivisiManagerId(e.target.value)}
                      className="form-select"
                    >
                      <option value="">— Belum Ditugaskan —</option>
                      {atasanList.map((emp) => {
                        const assignment = managerDivisionMap.get(emp.id);
                        const isAssigned = Boolean(assignment);
                        return (
                          <option
                            key={emp.id}
                            value={emp.id}
                            disabled={isAssigned}
                          >
                            {emp.nama_lengkap} ({emp.jabatan || "Atasan"})
                            {isAssigned ? ` — (Sudah memimpin Divisi ${assignment?.divisiNama})` : ""}
                          </option>
                        );
                      })}
                    </select>
                    {newDivisiManagerId && (
                      <button
                        type="button"
                        onClick={() => setNewDivisiManagerId("")}
                        className="btn-clear-select"
                        title="Kosongkan atasan (Belum Ditugaskan)"
                        aria-label="Kosongkan atasan"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="form-help">
                    Satu atasan hanya boleh memimpin paling banyak satu divisi.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddDivisiOpen(false)}
                  className="btn-modal-cancel"
                >
                  Batal
                </button>
                <button type="submit" className="btn-modal-submit">
                  Simpan Divisi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Atur Atasan Divisi - Compact & Professional */}
      {isAturAtasanOpen && editingDivisi && (
        <div className="modal-overlay" onClick={() => setIsAturAtasanOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                Atur Atasan &ndash; {editingDivisi.nama}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAturAtasanOpen(false)}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAturAtasan}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Divisi</label>
                  <input
                    type="text"
                    disabled
                    value={editingDivisi.nama}
                    className="form-input"
                    style={{ backgroundColor: "#f8fafc", color: "#64748b", fontWeight: 600, cursor: "not-allowed" }}
                  />
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label className="form-label">
                    Pilih Manajer / Atasan
                  </label>
                  <div className="select-with-clear">
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="form-select"
                    >
                      <option value="">— Belum Ditugaskan —</option>
                      {atasanList.map((emp) => {
                        const assignment = managerDivisionMap.get(emp.id);
                        const isCurrent = (assignment && assignment.divisiId === editingDivisi.id) || selectedManagerId === emp.id;
                        const isAssignedToOther = assignment && assignment.divisiId !== editingDivisi.id && selectedManagerId !== emp.id;
                        return (
                          <option
                            key={emp.id}
                            value={emp.id}
                            disabled={Boolean(isAssignedToOther)}
                          >
                            {emp.nama_lengkap} ({emp.jabatan || "Atasan"})
                            {isAssignedToOther
                              ? ` — (Sudah memimpin Divisi ${assignment.divisiNama})`
                              : isCurrent
                              ? " — [Atasan Saat Ini]"
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                    {selectedManagerId && (
                      <button
                        type="button"
                        onClick={() => setSelectedManagerId("")}
                        className="btn-clear-select"
                        title="Kosongkan atasan (Belum Ditugaskan)"
                        aria-label="Kosongkan atasan"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="form-help">
                    Hanya menampilkan karyawan aktif dengan peran atasan. Satu atasan hanya memimpin satu divisi.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAturAtasanOpen(false)}
                  className="btn-modal-cancel"
                >
                  Batal
                </button>
                <button type="submit" className="btn-modal-submit">
                  Terapkan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Hari Libur Baru (PRD US-08) */}
      {isAddLiburOpen && (
        <div className="modal-overlay" onClick={() => setIsAddLiburOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah Hari Libur Baru</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddLiburOpen(false)}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAddLibur}>
              <div className="modal-body">
                {addLiburError && (
                  <div className="alert-error" style={{ marginBottom: "0.85rem" }}>
                    ⚠️ {addLiburError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    Tanggal Libur <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newLiburTanggal}
                    onChange={(e) => {
                      setNewLiburTanggal(e.target.value);
                      setAddLiburError(null);
                    }}
                    className="form-input"
                  />
                  <p className="form-help">
                    Tanggal berlaku sebagai Kunci Utama (Primary Key) yang unik. Tidak boleh ada tanggal duplikat di tabel hari_libur.
                  </p>
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label className="form-label">
                    Keterangan Hari Libur <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newLiburKeterangan}
                    onChange={(e) => {
                      setNewLiburKeterangan(e.target.value);
                      setAddLiburError(null);
                    }}
                    placeholder="Contoh: Hari Raya Idulfitri 1447 H"
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label className="form-label">
                    Jenis Libur <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={newLiburJenis}
                    onChange={(e) => setNewLiburJenis(e.target.value as JenisHariLibur)}
                    className="form-select"
                  >
                    <option value="nasional">Nasional</option>
                    <option value="cuti_bersama">Cuti Bersama</option>
                    <option value="perusahaan">Perusahaan</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddLiburOpen(false)}
                  className="btn-modal-cancel"
                  disabled={isSubmittingLibur}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isSubmittingLibur}
                >
                  {isSubmittingLibur ? "Menyimpan..." : "Simpan Hari Libur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Hari Libur (PRD US-08: Mengubah Keterangan & Jenis Libur) */}
      {editingLibur && (
        <div className="modal-overlay" onClick={() => setEditingLibur(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Hari Libur</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingLibur(null)}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditLibur}>
              <div className="modal-body">
                {editLiburError && (
                  <div className="alert-error" style={{ marginBottom: "0.85rem" }}>
                    ⚠️ {editLiburError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Tanggal Libur (PK - Kunci Utama)</label>
                  <input
                    type="text"
                    disabled
                    value={`${editingLibur.tanggal} (${formatIndoDateDisplay(editingLibur.tanggal)})`}
                    className="form-input"
                    style={{ backgroundColor: "#f8fafc", color: "#64748b", fontWeight: 600, cursor: "not-allowed" }}
                  />
                  <p className="form-help">
                    Tanggal tidak dapat diubah karena merupakan kunci utama (Primary Key).
                  </p>
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label className="form-label">
                    Keterangan Hari Libur <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editLiburKeterangan}
                    onChange={(e) => {
                      setEditLiburKeterangan(e.target.value);
                      setEditLiburError(null);
                    }}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginTop: "0.75rem" }}>
                  <label className="form-label">
                    Jenis Libur <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={editLiburJenis}
                    onChange={(e) => setEditLiburJenis(e.target.value as JenisHariLibur)}
                    className="form-select"
                  >
                    <option value="nasional">Nasional</option>
                    <option value="cuti_bersama">Cuti Bersama</option>
                    <option value="perusahaan">Perusahaan</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingLibur(null)}
                  className="btn-modal-cancel"
                  disabled={isSubmittingEditLibur}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isSubmittingEditLibur}
                >
                  {isSubmittingEditLibur ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Hapus Hari Libur */}
      {deletingLibur && (
        <div className="modal-overlay" onClick={() => setDeletingLibur(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: "#fee2e2", backgroundColor: "#fff5f5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ color: "#dc2626", fontSize: "1.1rem" }}>⚠️</span>
                <h3 className="modal-title" style={{ color: "#991b1b" }}>Konfirmasi Hapus Hari Libur</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeletingLibur(null)}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "0.8125rem", color: "#334155", margin: 0, lineHeight: 1.5 }}>
                Apakah Anda yakin ingin menghapus data hari libur berikut dari database?
              </p>
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <strong className="text-slate-700">Tanggal:</strong>{" "}
                  <span className="font-mono">{deletingLibur.tanggal}</span> ({formatIndoDateDisplay(deletingLibur.tanggal)})
                </div>
                <div>
                  <strong className="text-slate-700">Keterangan:</strong> {deletingLibur.keterangan}
                </div>
                <div>
                  <strong className="text-slate-700">Jenis:</strong>{" "}
                  {deletingLibur.jenis === "nasional"
                    ? "Nasional"
                    : deletingLibur.jenis === "cuti_bersama"
                    ? "Cuti Bersama"
                    : "Perusahaan"}
                </div>
              </div>
              <p className="form-help" style={{ color: "#b91c1c", marginTop: "0.6rem" }}>
                * Perhatian: Hari libur yang dihapus tidak akan dihitung lagi sebagai hari bebas kerja pada pengajuan cuti mendatang.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeletingLibur(null)}
                className="btn-modal-cancel"
                disabled={isDeletingLibur}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLibur}
                className="btn-modal-danger"
                disabled={isDeletingLibur}
              >
                {isDeletingLibur ? "Menghapus..." : "Ya, Hapus Hari Libur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ubah Jatah Cuti Karyawan (PRD BR-04) */}
      {editingKuota && (
        <div className="modal-overlay" onClick={() => setEditingKuota(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Ubah Jatah Cuti Karyawan</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingKuota(null)}
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditKuota}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {editKuotaError && (
                  <div className="alert-error">⚠️ {editKuotaError}</div>
                )}

                <div className="form-group">
                  <label className="form-label">Nama Karyawan</label>
                  <input
                    type="text"
                    value={editingKuota["nama (bantu)"] || "Karyawan"}
                    disabled
                    className="form-input"
                    style={{ backgroundColor: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label className="form-label">Tahun Periode</label>
                    <input
                      type="text"
                      value={`Tahun ${editingKuota.tahun}`}
                      disabled
                      className="form-input"
                      style={{ backgroundColor: "#f8fafc", color: "#64748b", cursor: "not-allowed", fontWeight: 600 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Terpakai / Diajukan</label>
                    <input
                      type="text"
                      value={`${editingKuota.terpakai_hari} hari`}
                      disabled
                      className="form-input"
                      style={{ backgroundColor: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="input-jatah-hari" className="form-label">
                    Jatah Cuti Baru (Hari Kerja) <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="input-jatah-hari"
                    type="number"
                    min="0"
                    max="12"
                    step="1"
                    required
                    value={inputJatahHari}
                    onChange={(e) => setInputJatahHari(e.target.value)}
                    className="form-input font-bold"
                    placeholder="0 - 12 hari"
                    autoFocus
                  />
                  <span className="form-help">
                    Jatah cuti tahunan paling banyak 12 hari kerja per tahun kalender (0 - 12 hari).
                  </span>
                </div>

                {/* Live Preview Perhitungan Sisa Kuota (Rumus: jatah_hari - terpakai_hari) */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "0.6rem 0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                    Estimasi Sisa Kuota Baru:
                  </span>
                  <span
                    className={`status-pill ${
                      Math.max(0, Number(inputJatahHari) - Number(editingKuota.terpakai_hari)) > 0
                        ? "hadir"
                        : "terlambat"
                    }`}
                  >
                    {Math.max(0, Number(inputJatahHari) - Number(editingKuota.terpakai_hari))} hari
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingKuota(null)}
                  className="btn-modal-cancel"
                  disabled={isSubmittingKuota}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isSubmittingKuota}
                >
                  {isSubmittingKuota ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Melayang di Pojok Kanan Atas */}
      {toast && (
        <div
          className={`floating-toast-container ${toast.type === "error" ? "toast-error" : "toast-success"}`}
          role="status"
          aria-live="polite"
        >
          <div className="floating-toast-body">
            <span className={`floating-toast-icon ${toast.type === "error" ? "icon-error" : "icon-success"}`}>
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            <span className="floating-toast-message">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="floating-toast-close"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      <style jsx>{`
        .pengaturan-page-wrap {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
        }

        .header-row {
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
          padding: 0.5rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .tabs-container {
          display: flex;
          flex-shrink: 0;
          gap: 0.5rem;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .tabs-container::-webkit-scrollbar {
          display: none;
        }

        .tab-btn {
          flex-shrink: 0;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 0.45rem 0.95rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          border-radius: 6px;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          background-color: #e2e8f0;
          color: #0f172a;
        }

        .tab-btn.active {
          background-color: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
        }

        .tab-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .title-with-info {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
        }

        .info-tooltip-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .info-icon-btn {
          background: none;
          border: none;
          padding: 2px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          border-radius: 9999px;
          transition: color 0.15s ease;
        }

        .info-icon-btn:hover {
          color: #2563eb;
        }

        .info-svg {
          width: 0.95rem;
          height: 0.95rem;
        }

        .tooltip-bubble {
          display: none;
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          width: 260px;
          padding: 0.4rem 0.65rem;
          background: #0f172a;
          color: #f8fafc;
          font-size: 0.6875rem;
          line-height: 1.35;
          border-radius: 5px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.25);
          z-index: 50;
          pointer-events: none;
          font-weight: 400;
        }

        .tooltip-bubble strong {
          color: #60a5fa;
        }

        .tooltip-bubble::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 4px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }

        .info-tooltip-wrap:hover .tooltip-bubble,
        .info-icon-btn:focus + .tooltip-bubble {
          display: block;
        }

        /* Tombol Tambah Divisi - Compact & Professional */
        .btn-add-divisi {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background-color: #2563eb;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.32rem 0.7rem;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s ease;
          line-height: 1;
        }

        .btn-add-divisi:hover {
          background-color: #1d4ed8;
        }

        /* Tombol Aksi Tabel Atur Atasan - Compact Enterprise */
        .btn-action-edit {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 0.22rem 0.5rem;
          border-radius: 5px;
          font-size: 0.6875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-edit:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
          color: #2563eb;
        }

        .status-badge-aktif {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.15rem 0.5rem;
          background-color: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .status-dot-green {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #10b981;
        }

        .status-badge-belum {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.15rem 0.5rem;
          background-color: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .status-dot-amber {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #f59e0b;
        }

        .caption-tag {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .font-mono {
          font-family: monospace;
          font-size: 0.75rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .font-bold {
          font-weight: 700;
          color: #111827;
        }

        .text-dark {
          color: #111827;
        }

        .text-muted {
          color: #6b7280;
        }

        .case-note {
          font-size: 0.6875rem;
          color: #6b7280;
          font-style: italic;
        }

        .badge-aksi {
          background-color: #f3f4f6;
          color: #374151;
          font-size: 0.6875rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-weight: 600;
        }

        .filter-audit {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .lbl-mini {
          font-size: 0.75rem;
          color: #4b5563;
          font-weight: 600;
        }

        .select-mini {
          font-size: 0.75rem;
          font-weight: 500;
          color: #1e293b;
          height: 30px;
          padding: 0 0.6rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background-color: #ffffff;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .select-mini:hover {
          border-color: #94a3b8;
        }

        .select-mini:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        /* Modal Styles - Compact & Polished */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(1.5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 1rem;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 8px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          animation: modalPop 0.18s ease-out;
        }

        @keyframes modalPop {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          background-color: #fafafa;
        }

        .modal-title {
          font-size: 0.84375rem;
          font-weight: 700;
          color: #0f172a;
        }

        .modal-close-btn {
          background: transparent;
          border: none;
          font-size: 0.875rem;
          line-height: 1;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.2rem 0.35rem;
          border-radius: 4px;
          transition: color 0.15s ease;
        }

        .modal-close-btn:hover {
          color: #0f172a;
          background-color: #e2e8f0;
        }

        .modal-body {
          padding: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .form-label {
          font-size: 0.71875rem;
          font-weight: 600;
          color: #475569;
        }

        .form-input,
        .form-select {
          width: 100%;
          padding: 0.38rem 0.6rem;
          font-size: 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 5px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          background-color: #ffffff;
        }

        .form-input:focus,
        .form-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .select-with-clear {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          width: 100%;
        }

        .select-with-clear .form-select {
          flex: 1;
        }

        .btn-clear-select {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 5px;
          border: 1px solid #cbd5e1;
          background-color: #f8fafc;
          color: #64748b;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
          line-height: 1;
        }

        .btn-clear-select:hover {
          background-color: #fee2e2;
          border-color: #fca5a5;
          color: #dc2626;
        }

        .form-help {
          font-size: 0.65rem;
          color: #64748b;
          margin-top: 0.2rem;
          line-height: 1.3;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 0.65rem 1rem;
          background-color: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .btn-modal-cancel {
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-modal-cancel:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }

        .btn-modal-submit {
          padding: 0.35rem 0.85rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #ffffff;
          background-color: #2563eb;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .btn-modal-submit:hover {
          background-color: #1d4ed8;
        }

        /* Tombol Tambah Primary (+ Tambah Hari Libur) */
        .btn-add-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background-color: #2563eb;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 600;
          height: 30px;
          padding: 0 0.75rem;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
          line-height: 1;
        }

        .btn-add-primary:hover {
          background-color: #1d4ed8;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .btn-add-primary:active {
          transform: translateY(1px);
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .filter-item-wrap {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .count-badge {
          background-color: #f1f5f9;
          color: #475569;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid #e2e8f0;
          line-height: 1.2;
        }

        /* Badges Jenis Libur */
        .holiday-badge-nasional {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.6rem;
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .badge-dot-blue {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #2563eb;
        }

        .holiday-badge-cuti-bersama {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.6rem;
          background-color: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .badge-dot-amber {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #f59e0b;
        }

        .holiday-badge-perusahaan {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.6rem;
          background-color: #f5f3ff;
          color: #6d28d9;
          border: 1px solid #ddd6fe;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .badge-dot-purple {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #7c3aed;
        }

        /* Tombol Aksi Hapus Tabel */
        .btn-action-delete {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          background-color: #ffffff;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.22rem 0.5rem;
          border-radius: 5px;
          font-size: 0.6875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-delete:hover {
          background-color: #fef2f2;
          border-color: #f87171;
          color: #b91c1c;
        }

        /* Tombol Danger Modal */
        .btn-modal-danger {
          padding: 0.35rem 0.85rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #ffffff;
          background-color: #dc2626;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .btn-modal-danger:hover {
          background-color: #b91c1c;
        }

        .btn-modal-danger:disabled,
        .btn-modal-submit:disabled,
        .btn-modal-cancel:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .alert-error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 0.45rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          line-height: 1.35;
        }

        /* Floating Toast Notification */
        .floating-toast-container {
          position: fixed;
          top: 1.25rem;
          right: 1.25rem;
          z-index: 9999;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          min-width: 320px;
          max-width: 480px;
          animation: slideInToast 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .floating-toast-container.toast-success {
          border-left: 4px solid #16a34a;
        }

        .floating-toast-container.toast-error {
          border-left: 4px solid #dc2626;
        }

        @keyframes slideInToast {
          from {
            transform: translateY(-12px) scale(0.97);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .floating-toast-body {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .floating-toast-icon {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .icon-success {
          background-color: #ecfdf5;
          color: #16a34a;
        }

        .icon-error {
          background-color: #fef2f2;
          color: #dc2626;
        }

        .floating-toast-message {
          font-size: 0.78125rem;
          font-weight: 500;
          color: #0f172a;
          line-height: 1.35;
        }

        .floating-toast-close {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.8125rem;
          cursor: pointer;
          padding: 0.2rem 0.35rem;
          border-radius: 4px;
          transition: all 0.15s ease;
          line-height: 1;
        }

        .floating-toast-close:hover {
          color: #334155;
          background-color: #f1f5f9;
        }

        /* --- Responsive Mobile Friendly - Pengaturan --- */
        @media (max-width: 768px) {
          .tab-header {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .title-with-info {
            width: 100%;
            justify-content: space-between;
          }

          .header-controls {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            gap: 0.5rem;
          }

          .filter-item-wrap {
            width: 100%;
            justify-content: space-between;
          }

          .filter-item-wrap .select-mini {
            flex: 1;
            min-width: 0;
          }

          .btn-add-primary,
          .btn-add-divisi {
            width: 100%;
            justify-content: center;
            height: 36px;
          }

          .filter-audit {
            width: 100%;
            justify-content: space-between;
          }

          .filter-audit .select-mini {
            flex: 1;
          }

          .modal-overlay {
            padding: 0.75rem;
          }

          .modal-card {
            max-width: calc(100vw - 1.5rem);
            max-height: 90vh;
            overflow-y: auto;
          }

          .floating-toast-container {
            top: 1rem;
            left: 1rem;
            right: 1rem;
            min-width: 0;
            max-width: calc(100vw - 2rem);
          }
        }
      `}</style>
    </div>
  );
}
