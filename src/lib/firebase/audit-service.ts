import { doc, setDoc } from "firebase/firestore";
import { db } from "./config";

export interface LogAuditParams {
  aksi: string;
  namaTabel: "pengajuan_cuti" | "slip_gaji" | "absensi" | "profiles" | "kuota_cuti" | "hari_libur" | "divisi";
  dataId: string;
  nilaiSebelum?: unknown;
  nilaiSesudah?: unknown;
  pelakuId?: string;
  pelakuNama?: string;
}

/**
 * Deduplikasi daftar audit log berdasarkan ID dan fingerprint bisnis
 * (mencegah duplikasi ganda antara localStorage dan Firestore)
 */
export function deduplicateAuditLogs(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const cleanList: any[] = [];

  for (const item of list) {
    if (!item) continue;

    // Normalisasi ID
    const rawId = item.id !== undefined && item.id !== null ? String(item.id).trim() : "";
    if (rawId && seenIds.has(rawId)) {
      continue;
    }

    // Fingerprint bisnis: aksi + nama_tabel + data_id + pelaku + bucket waktu 5 detik
    const rawTime = item.dibuat_pada || "";
    const timeMs = new Date(rawTime).getTime();
    const timeBucket = isNaN(timeMs) ? rawTime : Math.floor(timeMs / 5000);
    const pelaku = item.pelaku_id || item["pelaku (bantu)"] || "";
    const aksi = item.aksi || "";
    const tabel = item.nama_tabel || "";
    const dataId = item.data_id || "";

    const fp = `${aksi}|${tabel}|${dataId}|${pelaku}|${timeBucket}`;
    if (fp && seenFingerprints.has(fp)) {
      continue;
    }

    if (rawId) seenIds.add(rawId);
    if (fp) seenFingerprints.add(fp);
    cleanList.push(item);
  }

  return cleanList;
}

export async function logAuditActivity({
  aksi,
  namaTabel,
  dataId,
  nilaiSebelum = null,
  nilaiSesudah = null,
  pelakuId,
  pelakuNama,
}: LogAuditParams) {
  try {
    const nowIso = new Date().toISOString();
    let resolvedPelakuId = pelakuId;
    let resolvedPelakuNama = pelakuNama;

    if (!resolvedPelakuId && typeof window !== "undefined") {
      try {
        const storedUser = localStorage.getItem("karsahr_current_user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          resolvedPelakuId = parsed.id || parsed.seed_id;
          resolvedPelakuNama = parsed.nama_lengkap || parsed.nama;
        }
      } catch {}
    }

    const auditEntry = {
      id: "audit-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      pelaku_id: resolvedPelakuId || "system",
      "pelaku (bantu)": resolvedPelakuNama || "Sistem KarsaHR",
      aksi,
      nama_tabel: namaTabel,
      data_id: dataId,
      nilai_sebelum: nilaiSebelum ? (typeof nilaiSebelum === "string" ? nilaiSebelum : JSON.stringify(nilaiSebelum)) : null,
      nilai_sesudah: nilaiSesudah ? (typeof nilaiSesudah === "string" ? nilaiSesudah : JSON.stringify(nilaiSesudah)) : null,
      dibuat_pada: nowIso,
    };

    // 1. Simpan ke local store dengan deduplikasi
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_audit_log_store");
        const list = stored ? JSON.parse(stored) : [];
        const cleanList = deduplicateAuditLogs([auditEntry, ...list]);
        localStorage.setItem("karsahr_audit_log_store", JSON.stringify(cleanList));
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.warn("Gagal simpan audit log lokal:", err);
      }
    }

    // 2. Simpan ke Firestore dengan ID dokumen tetap (idempotent setDoc)
    try {
      await setDoc(doc(db, "audit_log", auditEntry.id), auditEntry);
    } catch (e) {
      // Abaikan jika offline / permission
    }

    return auditEntry;
  } catch (error) {
    console.warn("Audit logging error:", error);
    return null;
  }
}
