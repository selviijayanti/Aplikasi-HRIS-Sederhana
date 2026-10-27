import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  addDoc
} from "firebase/firestore";
import { db, auth } from "./config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { deduplicateAuditLogs } from "./audit-service";
import akunUjiData from "../../../data/seeds/akun_uji.json";
import profilesData from "../../../data/seeds/profiles.json";

const PROFILES_STORAGE_KEY = "karsahr_profiles_overrides";
const SALARIES_STORAGE_KEY = "karsahr_employee_salaries";
const AUDIT_LOG_STORE_KEY = "karsahr_audit_log_store";

export interface EmployeeProfilePayload {
  id: string;
  nik_karyawan: string;
  nama_lengkap: string;
  email: string;
  nomor_hp?: string | number | null;
  peran: "karyawan" | "atasan" | "hrd";
  divisi_id: string;
  "divisi (bantu)": string;
  jabatan: string;
  status_kerja: "tetap" | "kontrak";
  tanggal_masuk: string;
  aktif: boolean;
  atasan_langsung?: string | null;
  atasan_id?: string | null;
  gaji_pokok?: number;
  tunjangan?: number;
}

/**
 * Memastikan sesi Firebase Auth aktif sebelum transaksi Firestore
 */
let activeAuthPromise: Promise<string | null> | null = null;

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
        console.warn("Silent re-auth in employee-service:", e);
      }
    }
    return null;
  })().finally(() => {
    activeAuthPromise = null;
  });

  return activeAuthPromise;
}

/**
 * Catat aktivitas ke Audit Log (Firestore & localStorage) sesuai PRD BR-12
 */
async function logAuditActivity(logEntry: {
  pelaku_id: string;
  pelaku_nama: string;
  aksi: string;
  nama_tabel: string;
  data_id: string;
  nilai_sebelum?: any;
  nilai_sesudah?: any;
}) {
  const nowIso = new Date().toISOString();
  const entry = {
    id: "audit-" + Date.now(),
    pelaku_id: logEntry.pelaku_id,
    "pelaku (bantu)": logEntry.pelaku_nama,
    aksi: logEntry.aksi,
    nama_tabel: logEntry.nama_tabel,
    data_id: logEntry.data_id,
    nilai_sebelum: logEntry.nilai_sebelum ? JSON.stringify(logEntry.nilai_sebelum) : null,
    nilai_sesudah: logEntry.nilai_sesudah ? JSON.stringify(logEntry.nilai_sesudah) : null,
    dibuat_pada: nowIso,
  };

  // Simpan ke shared local audit store
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(AUDIT_LOG_STORE_KEY);
      const list = stored ? JSON.parse(stored) : [];
      const cleanList = deduplicateAuditLogs([entry, ...list]);
      localStorage.setItem(AUDIT_LOG_STORE_KEY, JSON.stringify(cleanList));
    } catch (e) {
      console.warn("Gagal simpan audit log lokal:", e);
    }
  }

  // Simpan ke Cloud Firestore koleksi audit_log (idempotent setDoc)
  try {
    await ensureActiveFirebaseAuth();
    await setDoc(doc(db, "audit_log", entry.id), entry);
  } catch (err) {
    console.warn("Gagal simpan audit log ke Firestore:", err);
  }
}

let cachedEmployees: EmployeeProfilePayload[] | null = null;
let lastFetchEmployeesTime = 0;

/**
 * Membaca data karyawan dari Cloud Firestore, digabungkan dengan seed awal dan cache lokal (dengan in-memory caching)
 */
export async function fetchEmployeesFromFirestore(forceRefresh = false): Promise<EmployeeProfilePayload[]> {
  const now = Date.now();
  if (!forceRefresh && cachedEmployees && (now - lastFetchEmployeesTime < 30000)) {
    return cachedEmployees;
  }

  try {
    await ensureActiveFirebaseAuth();
    const snap = await getDocs(collection(db, "profiles"));
    const firestoreMap = new Map<string, any>();

    snap.forEach((d) => {
      const data = d.data();
      const key = (data.nik_karyawan || data.email || d.id).toLowerCase();
      firestoreMap.set(key, { ...data, id: d.id });
    });

    // Gabungkan dengan seeds bawaan menggunakan NIK sebagai kunci unik agar tidak dobel
    const map = new Map<string, any>();
    (profilesData as Array<any>).forEach((p) => {
      const key = (p.nik_karyawan || p.email || p.id).toLowerCase();
      map.set(key, { ...p, seed_id: p.id });
    });

    // Override dengan data Firestore tanpa menghilangkan seed_id awal
    firestoreMap.forEach((val, key) => {
      const existing = map.get(key) || {};
      map.set(key, { ...existing, ...val, seed_id: existing.seed_id || existing.id || val.id });
    });

    const result = Array.from(map.values());
    cachedEmployees = result;
    lastFetchEmployeesTime = Date.now();

    if (typeof window !== "undefined") {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(result));
    }
    return result;
  } catch (err) {
    console.warn("Fetch profiles from Firestore:", err);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(PROFILES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const uniqueMap = new Map<string, any>();
          parsed.forEach((p: any) => {
            const key = (p.nik_karyawan || p.email || p.id).toLowerCase();
            uniqueMap.set(key, p);
          });
          const localList = Array.from(uniqueMap.values());
          cachedEmployees = localList;
          lastFetchEmployeesTime = Date.now();
          return localList;
        }
      } catch (e) {}
    }
    const fallback = profilesData as any[];
    cachedEmployees = fallback;
    lastFetchEmployeesTime = Date.now();
    return fallback;
  }
}

/**
 * Menyimpan karyawan baru ke Cloud Firestore dan Audit Log (PRD BR-01 & BR-12)
 */
export async function saveNewEmployeeToFirestore(
  employee: EmployeeProfilePayload,
  salary: { gaji_pokok: number; tunjangan: number },
  creator: { id: string; nama: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureActiveFirebaseAuth();

    const cleanRecord: Record<string, any> = {
      id: employee.id,
      nik_karyawan: employee.nik_karyawan,
      nama_lengkap: employee.nama_lengkap,
      email: employee.email,
      peran: employee.peran,
      divisi_id: employee.divisi_id,
      "divisi (bantu)": employee["divisi (bantu)"],
      jabatan: employee.jabatan,
      status_kerja: employee.status_kerja,
      tanggal_masuk: employee.tanggal_masuk,
      aktif: employee.aktif,
      atasan_langsung: employee.atasan_langsung || null,
      created_at: new Date().toISOString(),
    };

    // 1. Simpan dokumen di koleksi 'profiles'
    await setDoc(doc(db, "profiles", employee.id), cleanRecord);

    // 2. Catat ke audit_log
    await logAuditActivity({
      pelaku_id: creator.id,
      pelaku_nama: creator.nama,
      aksi: "tambah_karyawan",
      nama_tabel: "profiles",
      data_id: employee.id,
      nilai_sesudah: {
        nik: employee.nik_karyawan,
        nama: employee.nama_lengkap,
        divisi: employee["divisi (bantu)"],
        jabatan: employee.jabatan,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.warn("Gagal simpan karyawan ke Firestore:", error);
    return { success: false, error: error?.message || "Gagal menyimpan ke database" };
  }
}

/**
 * Memperbarui data karyawan di Cloud Firestore dan mencatat Audit Log (PRD BR-01 & BR-12)
 */
export async function updateEmployeeInFirestore(
  employeeId: string,
  updatedData: Partial<EmployeeProfilePayload>,
  previousData: Partial<EmployeeProfilePayload>,
  modifier: { id: string; nama: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureActiveFirebaseAuth();

    const updateFields: Record<string, any> = {
      ...updatedData,
      updated_at: new Date().toISOString(),
    };

    // 1. Update dokumen di koleksi 'profiles'
    await setDoc(doc(db, "profiles", employeeId), updateFields, { merge: true });

    // 2. Catat ke audit_log
    await logAuditActivity({
      pelaku_id: modifier.id,
      pelaku_nama: modifier.nama,
      aksi: "ubah_profil_karyawan",
      nama_tabel: "profiles",
      data_id: employeeId,
      nilai_sebelum: previousData,
      nilai_sesudah: updatedData,
    });

    return { success: true };
  } catch (error: any) {
    console.warn("Gagal update karyawan di Firestore:", error);
    return { success: false, error: error?.message || "Gagal update ke database" };
  }
}

/**
 * Mengubah status aktif/nonaktif akun karyawan di Cloud Firestore dan mencatat Audit Log
 */
export async function toggleEmployeeStatusInFirestore(
  employeeId: string,
  newStatus: boolean,
  employeeName: string,
  modifier: { id: string; nama: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureActiveFirebaseAuth();

    // 1. Update status aktif di koleksi 'profiles'
    await setDoc(
      doc(db, "profiles", employeeId),
      {
        aktif: newStatus,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    // 2. Catat ke audit_log (BR-12)
    await logAuditActivity({
      pelaku_id: modifier.id,
      pelaku_nama: modifier.nama,
      aksi: newStatus ? "aktifkan_akun" : "nonaktifkan_akun",
      nama_tabel: "profiles",
      data_id: employeeId,
      nilai_sebelum: { aktif: !newStatus },
      nilai_sesudah: { aktif: newStatus, nama: employeeName },
    });

    return { success: true };
  } catch (error: any) {
    console.warn("Gagal ubah status akun di Firestore:", error);
    return { success: false, error: error?.message || "Gagal update status di database" };
  }
}
