import { addDoc, collection } from "firebase/firestore";
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

    // 1. Simpan ke local store agar langsung reaktif di UI Audit Log Pengaturan
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_audit_log_store");
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(auditEntry);
        localStorage.setItem("karsahr_audit_log_store", JSON.stringify(list));
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.warn("Gagal simpan audit log lokal:", err);
      }
    }

    // 2. Simpan ke Firestore secara asinkron
    try {
      await addDoc(collection(db, "audit_log"), auditEntry);
    } catch (e) {
      // Abaikan jika offline / permission
    }

    return auditEntry;
  } catch (error) {
    console.warn("Audit logging error:", error);
    return null;
  }
}
