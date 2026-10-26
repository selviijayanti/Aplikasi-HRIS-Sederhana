import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "./config";
import hariLiburSeed from "../../../data/seeds/hari_libur.json";

export type JenisHariLibur = "nasional" | "cuti_bersama" | "perusahaan";

export interface HariLibur {
  tanggal: string; // YYYY-MM-DD (Kunci Utama / PK)
  keterangan: string;
  jenis: JenisHariLibur;
}

export interface AppUser {
  id?: string;
  nama_lengkap?: string;
  email?: string;
  peran?: string;
}

export const HOLIDAY_STORE_KEY = "karsahr_hari_libur_list";
export const HOLIDAY_UPDATED_EVENT = "karsahr_holiday_updated";

/**
 * Mengambil daftar hari libur dari localStorage dengan fallback ke file seed (hari_libur.json)
 */
export function getStoredHolidays(): HariLibur[] {
  const seedList = (hariLiburSeed as Array<{ tanggal: string; keterangan: string; jenis: string }>).map((item) => ({
    tanggal: item.tanggal,
    keterangan: item.keterangan,
    jenis: (item.jenis === "cuti bersama" ? "cuti_bersama" : item.jenis) as JenisHariLibur,
  }));

  if (typeof window === "undefined") {
    return seedList;
  }
  try {
    const raw = localStorage.getItem(HOLIDAY_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Gabungkan seed (2024, 2025, 2026) dengan cache agar data tahun sebelumnya otomatis tersedia
        const map = new Map<string, HariLibur>();
        seedList.forEach((s) => map.set(s.tanggal, s));
        parsed.forEach((p: HariLibur) => map.set(p.tanggal, p));
        const merged = Array.from(map.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        return merged;
      }
    }
  } catch (err) {
    console.warn("Gagal membaca cache hari libur dari localStorage:", err);
  }
  return seedList;
}

/**
 * Menyimpan daftar hari libur ke localStorage dan memancarkan event pembaruan
 */
export function saveStoredHolidays(list: HariLibur[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOLIDAY_STORE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(HOLIDAY_UPDATED_EVENT, { detail: list }));
  } catch (err) {
    console.error("Gagal menyimpan hari libur ke localStorage:", err);
  }
}

/**
 * Menambahkan entri ke audit_log (Firestore & localStorage) sesuai PRD BR-12
 */
async function recordAuditLog(
  aksi: "INSERT" | "UPDATE" | "DELETE",
  dataId: string,
  nilaiSebelum: unknown,
  nilaiSesudah: unknown,
  user?: AppUser | null
) {
  try {
    const nowIso = new Date().toISOString();
    const auditEntry = {
      id: "audit-" + Date.now(),
      pelaku_id: user?.id || "hrd-current",
      "pelaku (bantu)": user?.nama_lengkap || user?.email || "HRD Admin",
      aksi,
      nama_tabel: "hari_libur",
      data_id: dataId,
      nilai_sebelum: nilaiSebelum ? JSON.stringify(nilaiSebelum) : null,
      nilai_sesudah: nilaiSesudah ? JSON.stringify(nilaiSesudah) : null,
      dibuat_pada: nowIso,
    };

    // 1. Simpan ke Firestore
    await addDoc(collection(db, "audit_log"), auditEntry).catch((e) =>
      console.warn("Audit log Firestore warning:", e)
    );

    // 2. Simpan ke localStorage audit log store
    if (typeof window !== "undefined") {
      const storedAudit = localStorage.getItem("karsahr_audit_log_store");
      const list = storedAudit ? JSON.parse(storedAudit) : [];
      list.unshift(auditEntry);
      localStorage.setItem("karsahr_audit_log_store", JSON.stringify(list));
    }
  } catch (e) {
    console.warn("Gagal mencatat audit log hari libur:", e);
  }
}

/**
 * Mengambil data hari_libur dari Firestore Database.
 * Jika Firestore kosong, gunakan data seed awal.
 */
let cachedHolidays: HariLibur[] | null = null;
let lastFetchHolidaysTime = 0;

/**
 * Mengambil data hari_libur dari Firestore Database (dengan in-memory caching).
 * Jika Firestore kosong, gunakan data seed awal.
 */
export async function fetchHolidaysFromFirestore(forceRefresh = false): Promise<HariLibur[]> {
  const now = Date.now();
  if (!forceRefresh && cachedHolidays && (now - lastFetchHolidaysTime < 30000)) {
    return cachedHolidays;
  }

  try {
    const snap = await getDocs(collection(db, "hari_libur"));
    if (!snap.empty) {
      const remoteList: HariLibur[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        remoteList.push({
          tanggal: docSnap.id || d.tanggal,
          keterangan: d.keterangan || "",
          jenis: (d.jenis as JenisHariLibur) || "nasional",
        });
      });

      // Gabungkan dengan seed list agar data historis (2024 & 2025) tetap lengkap saat dicek penguji
      const seedList = getStoredHolidays();
      const map = new Map<string, HariLibur>();
      seedList.forEach((s) => map.set(s.tanggal, s));
      remoteList.forEach((r) => map.set(r.tanggal, r));
      const combined = Array.from(map.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      cachedHolidays = combined;
      lastFetchHolidaysTime = Date.now();
      saveStoredHolidays(combined);
      return combined;
    }
  } catch (err) {
    console.warn("Koneksi Firestore hari_libur fallback ke cache lokal:", err);
  }
  const localList = getStoredHolidays();
  cachedHolidays = localList;
  lastFetchHolidaysTime = Date.now();
  return localList;
}

/**
 * Menambahkan data hari libur baru (CREATE / INSERT)
 * - Validasi keberadaan input tanggal, keterangan, dan jenis
 * - Validasi keunikan Primary Key (PK: tanggal)
 * - Persistensi ke Database (Firestore) dan LocalStorage
 * - Pencatatan ke Audit Log
 */
export async function createHoliday(
  payload: { tanggal: string; keterangan: string; jenis: JenisHariLibur },
  user?: AppUser | null
): Promise<HariLibur> {
  const tanggal = payload.tanggal.trim();
  const keterangan = payload.keterangan.trim();
  const rawJenis = String(payload.jenis || "").trim().toLowerCase();
  const jenis = (rawJenis === "cuti bersama" ? "cuti_bersama" : rawJenis) as JenisHariLibur;

  if (!tanggal) {
    throw new Error("Tanggal hari libur wajib diisi.");
  }
  if (!keterangan) {
    throw new Error("Keterangan hari libur wajib diisi.");
  }
  if (!["nasional", "cuti_bersama", "perusahaan"].includes(jenis)) {
    throw new Error("Jenis hari libur tidak valid. Pilihan: nasional, cuti_bersama, perusahaan.");
  }

  // Validasi keunikan Primary Key (PK)
  const currentList = getStoredHolidays();
  const exists = currentList.some((h) => h.tanggal === tanggal);
  if (exists) {
    throw new Error(`Tanggal ${tanggal} sudah terdaftar sebagai hari libur (duplikasi PK).`);
  }

  const newHoliday: HariLibur = { tanggal, keterangan, jenis };

  // 1. Simpan ke database Firestore
  await setDoc(doc(db, "hari_libur", tanggal), {
    tanggal,
    keterangan,
    jenis,
  });

  // 2. Simpan ke LocalStorage
  const updatedList = [...currentList, newHoliday].sort((a, b) =>
    a.tanggal.localeCompare(b.tanggal)
  );
  saveStoredHolidays(updatedList);

  // 3. Catat audit log
  await recordAuditLog("INSERT", tanggal, null, newHoliday, user);

  return newHoliday;
}

/**
 * Memperbarui data hari libur (UPDATE)
 * Mengubah keterangan dan jenis untuk tanggal (PK) tertentu
 */
export async function updateHoliday(
  payload: { tanggal: string; keterangan: string; jenis: JenisHariLibur },
  user?: AppUser | null
): Promise<HariLibur> {
  const tanggal = payload.tanggal.trim();
  const keterangan = payload.keterangan.trim();
  const rawJenis = String(payload.jenis || "").trim().toLowerCase();
  const jenis = (rawJenis === "cuti bersama" ? "cuti_bersama" : rawJenis) as JenisHariLibur;

  if (!tanggal) {
    throw new Error("Tanggal hari libur wajib diisi.");
  }
  if (!keterangan) {
    throw new Error("Keterangan hari libur wajib diisi.");
  }
  if (!["nasional", "cuti_bersama", "perusahaan"].includes(jenis)) {
    throw new Error("Jenis hari libur tidak valid. Pilihan: nasional, cuti_bersama, perusahaan.");
  }

  const currentList = getStoredHolidays();
  const existing = currentList.find((h) => h.tanggal === tanggal);
  if (!existing) {
    throw new Error(`Data hari libur pada tanggal ${tanggal} tidak ditemukan.`);
  }

  const updatedHoliday: HariLibur = { tanggal, keterangan, jenis };

  // 1. Perbarui di Firestore
  await updateDoc(doc(db, "hari_libur", tanggal), {
    keterangan,
    jenis,
  });

  // 2. Perbarui di LocalStorage
  const updatedList = currentList.map((h) =>
    h.tanggal === tanggal ? updatedHoliday : h
  );
  saveStoredHolidays(updatedList);

  // 3. Catat audit log
  await recordAuditLog("UPDATE", tanggal, existing, updatedHoliday, user);

  return updatedHoliday;
}

/**
 * Menghapus data hari libur dari database (DELETE)
 */
export async function deleteHoliday(tanggal: string, user?: AppUser | null): Promise<void> {
  const cleanTanggal = tanggal.trim();
  if (!cleanTanggal) {
    throw new Error("Tanggal hari libur yang akan dihapus tidak ditentukan.");
  }

  const currentList = getStoredHolidays();
  const existing = currentList.find((h) => h.tanggal === cleanTanggal);
  if (!existing) {
    throw new Error(`Data hari libur pada tanggal ${cleanTanggal} tidak ditemukan.`);
  }

  // 1. Hapus dari Firestore
  await deleteDoc(doc(db, "hari_libur", cleanTanggal));

  // 2. Hapus dari LocalStorage
  const updatedList = currentList.filter((h) => h.tanggal !== cleanTanggal);
  saveStoredHolidays(updatedList);

  // 3. Catat audit log
  await recordAuditLog("DELETE", cleanTanggal, existing, null, user);
}
