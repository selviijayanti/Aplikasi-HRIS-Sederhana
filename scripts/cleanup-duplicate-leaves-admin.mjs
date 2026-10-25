/**
 * Script Pembersihan Duplikat & Sinkronisasi Kuota menggunakan Firebase Admin SDK
 * Proyek: KarsaHR (PRD BR-04, BR-06)
 *
 * Persyaratan:
 *   1. File serviceAccountKey.json pada root proyek atau variabel GOOGLE_APPLICATION_CREDENTIALS
 *   2. Jalankan: node scripts/cleanup-duplicate-leaves-admin.mjs
 */

import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Inisialisasi Firebase Admin SDK
let serviceAccountPath = path.join(rootDir, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  const envKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envKey && fs.existsSync(envKey)) {
    serviceAccountPath = envKey;
  }
}

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✓ Inisialisasi Firebase Admin SDK menggunakan serviceAccountKey.json");
} else {
  // Coba initializeApp dengan default credentials
  try {
    admin.initializeApp();
    console.log("✓ Inisialisasi Firebase Admin SDK menggunakan Default Application Credentials");
  } catch (e) {
    console.error("❌ File serviceAccountKey.json tidak ditemukan!");
    console.error("Harap letakkan file serviceAccountKey.json di root project atau gunakan script Client SDK 'scripts/cleanup-duplicate-leaves.mjs'.");
    process.exit(1);
  }
}

const db = admin.firestore();

async function runAdminCleanup() {
  console.log("\n=======================================================");
  console.log("  🚀 FIREBASE ADMIN: DEDUPLIKASI & SINKRONISASI KUOTA  ");
  console.log("=======================================================\n");

  const andiIdentifiers = [
    "3ce404ad-885e-51ef-bbf7-10345f2c2f04",
    "karyawan-andi",
    "KLN-0009",
  ];

  const snap = await db.collection("pengajuan_cuti").get();
  console.log(`Mengambil ${snap.size} dokumen pengajuan cuti...`);

  const groups = new Map();

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const isAndi =
      andiIdentifiers.includes(d.karyawan_id) ||
      d.nik_karyawan === "KLN-0009" ||
      (d.nama_karyawan || d["pemohon (bantu)"] || "").toLowerCase() === "andi wijaya";

    const owner = isAndi ? "ANDI_WIJAYA" : (d.karyawan_id || "UNKNOWN");
    const jenis = (d.jenis || "cuti_tahunan").toLowerCase();
    const start = (d.tanggal_mulai || "").split("T")[0];
    const end = (d.tanggal_selesai || d.tanggal_mulai || "").split("T")[0];

    const groupKey = `${owner}|${jenis}|${start}|${end}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push({
      id,
      ref: docSnap.ref,
      data: d,
      isAndi,
      dibuatPada: d.dibuat_pada || d.created_at || "1970-01-01T00:00:00Z",
      jumlahHari: Number(d.jumlah_hari || 1),
      status: d.status || "diajukan",
      start,
      end,
    });
  });

  const batch = db.batch();
  let deletedCount = 0;
  const retainedDocs = [];

  for (const [key, items] of groups.entries()) {
    if (items.length > 1) {
      // Prioritaskan dokumen dibuat paling awal
      items.sort((a, b) => new Date(a.dibuatPada).getTime() - new Date(b.dibuatPada).getTime());
      const primary = items[0];
      retainedDocs.push(primary);

      console.log(`\nDuplikasi ditemukan pada grup: ${key}`);
      console.log(`  ✓ PERTAHANKAN: ID=${primary.id} (Dibuat: ${primary.dibuatPada})`);

      for (const dup of items.slice(1)) {
        console.log(`  🗑️ HAPUS DUPLIKAT: ID=${dup.id} (Dibuat: ${dup.dibuatPada})`);
        batch.delete(dup.ref);
        deletedCount++;
      }
    } else {
      retainedDocs.push(items[0]);
    }
  }

  if (deletedCount > 0) {
    await batch.commit();
    console.log(`\n✓ Berhasil menghapus ${deletedCount} dokumen duplikat via Firestore writeBatch.`);
  } else {
    console.log("\n✓ Tidak ada dokumen duplikat.");
  }

  // Hitung ulang kuota cuti tahunan Andi Wijaya 2026
  const andiLeaves2026 = retainedDocs.filter((item) => {
    if (!item.isAndi) return false;
    const isTahunan = item.data.jenis === "cuti_tahunan" || item.data.jenis?.toLowerCase().includes("tahunan");
    if (!isTahunan) return false;
    const st = item.status?.toLowerCase();
    const isActive = st === "diajukan" || st === "disetujui_atasan" || st === "disetujui";
    const is2026 = item.start.startsWith("2026");
    return isActive && is2026;
  });

  let totalTerpakai = 0;
  andiLeaves2026.forEach((l) => {
    totalTerpakai += l.jumlahHari;
  });

  const jatahHari = 12;
  const sisaHari = Math.max(0, jatahHari - totalTerpakai);

  console.log(`\nRekapitulasi Kuota Cuti Andi Wijaya (2026):`);
  console.log(`  - Jatah: ${jatahHari} hari`);
  console.log(`  - Terpakai: ${totalTerpakai} hari (Target: 7 hari)`);
  console.log(`  - Sisa: ${sisaHari} hari (Target: 5 hari)`);

  const kuotaDocs = await db.collection("kuota_cuti").get();
  for (const kd of kuotaDocs.docs) {
    const kdata = kd.data();
    const isAndi =
      andiIdentifiers.includes(kdata.karyawan_id) ||
      (kdata["nama (bantu)"] || "").toLowerCase() === "andi wijaya" ||
      kd.id === "5d20d824-da83-5165-85cf-ae5bf5579547";

    if (isAndi && Number(kdata.tahun) === 2026) {
      await kd.ref.update({
        terpakai_hari: totalTerpakai,
        terpakai: totalTerpakai,
        sisa_kuota: sisaHari,
        sisa: sisaHari,
        "sisa (bantu)": sisaHari,
        updated_at: new Date().toISOString(),
      });
      console.log(`✓ Dokumen kuota_cuti ID: ${kd.id} berhasil diupdate.`);
    }
  }

  console.log("\nSelesai!");
}

runAdminCleanup();
