/**
 * Script Pembersihan Data Duplikat Koleksi 'pengajuan_cuti' & Resinkronisasi 'kuota_cuti'
 * Proyek: KarsaHR (Aturan Bisnis PRD BR-04 & BR-06)
 *
 * Jalankan via terminal:
 *   node scripts/cleanup-duplicate-leaves.mjs
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// 1. Baca konfigurasi lingkungan dari .env.local
function loadEnv() {
  const envPath = path.join(rootDir, ".env.local");
  const fallbackEnvPath = path.join(rootDir, ".env");
  const targetPath = fs.existsSync(envPath)
    ? envPath
    : fs.existsSync(fallbackEnvPath)
    ? fallbackEnvPath
    : null;

  if (targetPath) {
    const content = fs.readFileSync(targetPath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...values] = trimmed.split("=");
        if (key && values.length) {
          process.env[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    });
    console.log(`✓ Berhasil memuat environment dari: ${path.basename(targetPath)}`);
  } else {
    console.warn("⚠️ File .env.local tidak ditemukan. Menggunakan nilai environment sistem.");
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "aplikasi-hris-sederhana.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "aplikasi-hris-sederhana",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "aplikasi-hris-sederhana.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("\n❌ ERROR: NEXT_PUBLIC_FIREBASE_API_KEY belum diisi di .env.local!");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper membaca seed JSON jika diperlukan
function readSeed(filename) {
  const filePath = path.join(rootDir, "data", "seeds", filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function runCleanup() {
  console.log("\n=================================================================");
  console.log("  🧹 SKRIP DEDUPLIKASI PENGAJUAN CUTI & SINKRONISASI KUOTA KARSA-HR");
  console.log("  Project ID:", firebaseConfig.projectId);
  console.log("=================================================================\n");

  try {
    // -------------------------------------------------------------------------
    // TAHAP 1: Autentikasi Pengelola (HRD / Andi Wijaya)
    // -------------------------------------------------------------------------
    console.log("▶ [1/4] Melakukan Autentikasi Firebase...");
    const akunUji = readSeed("akun_uji.json");
    // Prioritaskan akun HRD untuk akses penuh atau akun Andi Wijaya
    const adminAkun =
      akunUji.find((a) => a.email.toLowerCase().includes("rina.kusumawardani")) ||
      akunUji.find((a) => a.email.toLowerCase().includes("andi.wijaya")) ||
      akunUji[0];

    let userUid = null;
    if (adminAkun) {
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          adminAkun.email,
          adminAkun.kata_sandi || "Latihan#2026"
        );
        userUid = cred.user.uid;
        console.log(`  ✓ Berhasil login sebagai: ${adminAkun.email} (UID: ${userUid})`);
      } catch (authErr) {
        console.warn(`  ⚠️ Login ${adminAkun.email} gagal (${authErr.message}). Melanjutkan tanpa sesi autentikasi...`);
      }
    }

    // -------------------------------------------------------------------------
    // TAHAP 2: Ambil Dokumen Koleksi 'pengajuan_cuti' & Deteksi Duplikat
    // -------------------------------------------------------------------------
    console.log("\n▶ [2/4] Mengambil seluruh data pengajuan cuti...");
    const leaveSnap = await getDocs(collection(db, "pengajuan_cuti"));
    console.log(`  ✓ Ditemukan total ${leaveSnap.size} dokumen di koleksi 'pengajuan_cuti'.`);

    // Target identifikasi Andi Wijaya
    const andiIdentifiers = [
      "3ce404ad-885e-51ef-bbf7-10345f2c2f04", // Seed ID Andi
      "karyawan-andi",
      "KLN-0009", // NIK Andi
    ];

    // Kelompokkan dokumen per karyawan + jenis + rentang tanggal
    // Kunci grup: `${karyawanKey}_${jenis}_${tanggalMulai}_${tanggalSelesai}`
    const grouped = new Map();

    leaveSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      // Normalisasi identitas pemilik
      const karyawanId = data.karyawan_id || "";
      const nik = data.nik_karyawan || "";
      const nama = (data.nama_karyawan || data["pemohon (bantu)"] || "").toLowerCase();

      const isAndi =
        andiIdentifiers.includes(karyawanId) ||
        nik === "KLN-0009" ||
        nama === "andi wijaya";

      // Normalisasi tanggal
      const tMulai = (data.tanggal_mulai || "").split("T")[0].trim();
      const tSelesai = (data.tanggal_selesai || data.tanggal_mulai || "").split("T")[0].trim();
      const jenis = (data.jenis || "cuti_tahunan").toLowerCase();

      // Gunakan normalized group key
      const ownerGroup = isAndi ? "ANDI_WIJAYA" : karyawanId || nama || "UNKNOWN";
      const groupKey = `${ownerGroup}|${jenis}|${tMulai}|${tSelesai}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }

      grouped.get(groupKey).push({
        id: docId,
        ref: docSnap.ref,
        data,
        isAndi,
        dibuatPada: data.dibuat_pada || data.created_at || "1970-01-01T00:00:00Z",
        tanggalMulai: tMulai,
        tanggalSelesai: tSelesai,
        jumlahHari: Number(data.jumlah_hari || data.jumlah_hari_kerja || 1),
        status: data.status || "diajukan",
      });
    });

    // -------------------------------------------------------------------------
    // TAHAP 3: Hapus Dokumen Duplikat (Gunakan writeBatch)
    // -------------------------------------------------------------------------
    console.log("\n▶ [3/4] Mengidentifikasi dan menghapus dokumen duplikat via Batch Writes...");
    const toDeleteRefs = [];
    const retainedDocs = [];

    let duplicateCount = 0;

    for (const [key, items] of grouped.entries()) {
      if (items.length > 1) {
        // Urutkan berdasarkan dibuatPada ASC (paling awal dipertahankan)
        items.sort((a, b) => new Date(a.dibuatPada).getTime() - new Date(b.dibuatPada).getTime());

        const primary = items[0];
        const duplicates = items.slice(1);

        retainedDocs.push(primary);
        duplicateCount += duplicates.length;

        console.log(`\n  🔎 Ditemukan duplikasi untuk grup: [${key}]`);
        console.log(`     ✓ PERTAHANKAN: ID=${primary.id} (Dibuat: ${primary.dibuatPada}, Status: ${primary.status}, Hari: ${primary.jumlahHari})`);

        duplicates.forEach((dup) => {
          console.log(`     🗑️ HAPUS DUPLIKAT: ID=${dup.id} (Dibuat: ${dup.dibuatPada}, Status: ${dup.status})`);
          toDeleteRefs.push(dup.ref);
        });
      } else {
        retainedDocs.push(items[0]);
      }
    }

    if (toDeleteRefs.length === 0) {
      console.log("\n  ✓ Tidak ditemukan dokumen pengajuan duplikat yang perlu dihapus.");
    } else {
      // Hapus dengan batch (Firestore membatasi maks 500 operasi per batch)
      const chunkSize = 200;
      for (let i = 0; i < toDeleteRefs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = toDeleteRefs.slice(i, i + chunkSize);
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
        console.log(`  ✓ Batch penghapusan ${i + 1} s/d ${i + chunk.length} berhasil dieksekusi.`);
      }
      console.log(`\n  🎉 Berhasil menghapus total ${toDeleteRefs.length} dokumen duplikat dari Firestore.`);
    }

    // -------------------------------------------------------------------------
    // TAHAP 4: Sinkronisasi Kuota Cuti Andi Wijaya (PRD BR-04 & BR-06)
    // -------------------------------------------------------------------------
    console.log("\n▶ [4/4] Menghitung ulang dan menyinkronkan kuota cuti Andi Wijaya 2026...");

    // Filter pengajuan cuti tahunan milik Andi yang aktif di tahun 2026
    const andiActiveLeaves2026 = retainedDocs.filter((docItem) => {
      if (!docItem.isAndi) return false;
      const isCutiTahunan =
        docItem.data.jenis === "cuti_tahunan" ||
        docItem.data.jenis?.toLowerCase().includes("tahunan");
      if (!isCutiTahunan) return false;

      const is2026 =
        docItem.tanggalMulai.startsWith("2026") || docItem.dibuatPada.startsWith("2026");
      if (!is2026) return false;

      const st = docItem.status?.toLowerCase();
      return st === "diajukan" || st === "disetujui_atasan" || st === "disetujui";
    });

    console.log("  Rincian dokumen pengajuan aktif Andi Wijaya (2026) yang tersisa:");
    let totalHariTerpakai = 0;
    andiActiveLeaves2026.forEach((item, idx) => {
      console.log(`    ${idx + 1}. [${item.tanggalMulai} s/d ${item.tanggalSelesai}] : ${item.jumlahHari} hari (${item.status}) - ID: ${item.id}`);
      totalHariTerpakai += item.jumlahHari;
    });

    const jatahHari = 12; // Bawaan jatah cuti tahunan per PRD BR-04
    const sisaKuota = Math.max(0, jatahHari - totalHariTerpakai);

    console.log(`\n  📊 HASIL PERHITUNGAN ULANG KUOTA ANDI WIJAYA:`);
    console.log(`     - Jatah Hari     : ${jatahHari} hari`);
    console.log(`     - Terpakai Hari  : ${totalHariTerpakai} hari (PRD Wireframe target: 7 hari)`);
    console.log(`     - Sisa Kuota     : ${sisaKuota} hari (PRD Wireframe target: 5 hari)`);

    // Cari dokumen kuota_cuti milik Andi di Firestore
    const kuotaCol = collection(db, "kuota_cuti");
    const kuotaSnap = await getDocs(kuotaCol);

    let updatedKuotaCount = 0;
    for (const kDoc of kuotaSnap.docs) {
      const kData = kDoc.data();
      const isAndiKuota =
        andiIdentifiers.includes(kData.karyawan_id) ||
        (kData["nama (bantu)"] || "").toLowerCase() === "andi wijaya" ||
        kDoc.id === "5d20d824-da83-5165-85cf-ae5bf5579547";

      if (isAndiKuota && Number(kData.tahun) === 2026) {
        await updateDoc(doc(db, "kuota_cuti", kDoc.id), {
          terpakai_hari: totalHariTerpakai,
          terpakai: totalHariTerpakai,
          sisa_kuota: sisaKuota,
          sisa: sisaKuota,
          "sisa (bantu)": sisaKuota,
          updated_at: new Date().toISOString(),
        });
        console.log(`  ✓ Berhasil memperbarui dokumen kuota_cuti ID: ${kDoc.id}`);
        updatedKuotaCount++;
      }
    }

    if (updatedKuotaCount === 0) {
      console.warn("  ⚠️ Dokumen kuota_cuti Andi Wijaya 2026 belum ditemukan di Firestore. Menggunakan ID seed...");
      await updateDoc(doc(db, "kuota_cuti", "5d20d824-da83-5165-85cf-ae5bf5579547"), {
        terpakai_hari: totalHariTerpakai,
        terpakai: totalHariTerpakai,
        sisa_kuota: sisaKuota,
        sisa: sisaKuota,
        updated_at: new Date().toISOString(),
      }).catch((e) => console.warn("  Fallback update kuota ID:", e.message));
    }

    console.log("\n=================================================================");
    console.log("  ✅ PROSES PEMBERSIHAN & SINKRONISASI SELESAI DENGAN SUKSES!    ");
    console.log("=================================================================\n");
  } catch (err) {
    console.error("\n❌ Terjadi kesalahan saat menjalankan skrip pembersihan:", err);
    process.exit(1);
  }
}

runCleanup();
