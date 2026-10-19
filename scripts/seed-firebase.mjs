import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  writeBatch 
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// 1. Baca Environment Variables dari .env.local atau .env
function loadEnv() {
  const envPath = path.join(rootDir, ".env.local");
  const fallbackEnvPath = path.join(rootDir, ".env");
  const targetPath = fs.existsSync(envPath) ? envPath : fs.existsSync(fallbackEnvPath) ? fallbackEnvPath : null;

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
    console.warn("⚠️ File .env.local belum ditemukan. Menggunakan konfigurasi default.");
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
  console.error("Silakan buat file .env.local dan isi konfigurasi Firebase Anda terlebih dahulu.\n");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper membaca file seeds JSON
function readSeed(filename) {
  const filePath = path.join(rootDir, "data", "seeds", filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File seed tidak ditemukan: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// Bersihkan kolom berakhiran (bantu) sesuai instruksi Sheet Petunjuk ERD
function cleanRecord(record) {
  const cleaned = {};
  for (const [key, val] of Object.entries(record)) {
    if (!key.endsWith("(bantu)")) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

async function runSeeder() {
  console.log("\n=======================================================");
  console.log("  🚀 MEMULAI SEEDING DATABASE FIREBASE KARSA-HRIS      ");
  console.log("  Project ID:", firebaseConfig.projectId);
  console.log("=======================================================\n");

  try {
    // -------------------------------------------------------------------------
    // TAHAP 1: Mendaftarkan 16 Akun di Firebase Authentication
    // -------------------------------------------------------------------------
    console.log("▶ [1/8] Mendaftarkan Akun di Firebase Authentication...");
    const akunUji = readSeed("akun_uji.json");
    const userUidMap = new Map(); // email -> uid

    for (const akun of akunUji) {
      const email = akun.email.toLowerCase();
      const password = akun.kata_sandi || "Latihan#2026";

      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        userUidMap.set(email, userCred.user.uid);
        console.log(`  + Berhasil mendaftar: ${email} (${akun.nama})`);
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          // Jika akun sudah ada, coba sign-in untuk mendapatkan UID
          try {
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            userUidMap.set(email, userCred.user.uid);
            console.log(`  ✓ Akun sudah ada (UID sinkron): ${email}`);
          } catch (loginErr) {
            console.log(`  ⚠️ Gagal mengambil UID untuk: ${email}`);
          }
        } else {
          console.error(`  ❌ Gagal mendaftarkan ${email}:`, err.message);
        }
      }
    }

    // -------------------------------------------------------------------------
    // TAHAP 2: Koleksi 'divisi' (4 dokumen)
    // -------------------------------------------------------------------------
    console.log("\n▶ [2/8] Mengimpor Koleksi 'divisi'...");
    const divisiList = readSeed("divisi.json");
    for (const d of divisiList) {
      const cleaned = cleanRecord(d);
      await setDoc(doc(db, "divisi", d.id), cleaned);
    }
    console.log(`  ✓ Berhasil mengimpor ${divisiList.length} divisi.`);

    // -------------------------------------------------------------------------
    // TAHAP 3: Koleksi 'profiles' (16 dokumen)
    // -------------------------------------------------------------------------
    console.log("\n▶ [3/8] Mengimpor Koleksi 'profiles'...");
    const profilesList = readSeed("profiles.json");
    for (const p of profilesList) {
      const cleaned = cleanRecord(p);
      // Gunakan UID auth jika tersedia
      const authUid = userUidMap.get(p.email.toLowerCase());
      const docId = authUid || p.id;
      if (authUid) {
        cleaned.id = authUid;
      }
      await setDoc(doc(db, "profiles", docId), cleaned);
    }
    console.log(`  ✓ Berhasil mengimpor ${profilesList.length} profil karyawan.`);

    // -------------------------------------------------------------------------
    // TAHAP 4: Koleksi 'hari_libur' (17 dokumen)
    // -------------------------------------------------------------------------
    console.log("\n▶ [4/8] Mengimpor Koleksi 'hari_libur'...");
    const hariLiburList = readSeed("hari_libur.json");
    for (const h of hariLiburList) {
      const cleaned = cleanRecord(h);
      await setDoc(doc(db, "hari_libur", h.tanggal), cleaned);
    }
    console.log(`  ✓ Berhasil mengimpor ${hariLiburList.length} hari libur nasional & perusahaan.`);

    // -------------------------------------------------------------------------
    // TAHAP 5: Koleksi 'kuota_cuti' (16 dokumen)
    // -------------------------------------------------------------------------
    console.log("\n▶ [5/8] Mengimpor Koleksi 'kuota_cuti'...");
    const kuotaList = readSeed("kuota_cuti.json");
    for (const k of kuotaList) {
      const cleaned = cleanRecord(k);
      await setDoc(doc(db, "kuota_cuti", k.id), cleaned);
    }
    console.log(`  ✓ Berhasil mengimpor ${kuotaList.length} kuota cuti tahunan.`);

    // -------------------------------------------------------------------------
    // TAHAP 6: Koleksi 'pengajuan_cuti' (37 dokumen)
    // -------------------------------------------------------------------------
    console.log("\n▶ [6/8] Mengimpor Koleksi 'pengajuan_cuti'...");
    const pengajuanList = readSeed("pengajuan_cuti.json");
    for (const cuti of pengajuanList) {
      const cleaned = cleanRecord(cuti);
      await setDoc(doc(db, "pengajuan_cuti", cuti.id), cleaned);
    }
    console.log(`  ✓ Berhasil mengimpor ${pengajuanList.length} pengajuan cuti & izin.`);

    // -------------------------------------------------------------------------
    // TAHAP 7: Koleksi 'absensi' (278 dokumen - menggunakan Batch Writes)
    // -------------------------------------------------------------------------
    console.log("\n▶ [7/8] Mengimpor Koleksi 'absensi' (278 data)...");
    const absensiList = readSeed("absensi.json");
    const chunkSize = 200; // Firestore batch max 500 ops
    for (let i = 0; i < absensiList.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = absensiList.slice(i, i + chunkSize);
      for (const a of chunk) {
        const cleaned = cleanRecord(a);
        const ref = doc(db, "absensi", a.id);
        batch.set(ref, cleaned);
      }
      await batch.commit();
      console.log(`  ✓ Batch absensi ${i + 1} s/d ${Math.min(i + chunkSize, absensiList.length)} tersimpan.`);
    }

    // -------------------------------------------------------------------------
    // TAHAP 8: Koleksi 'slip_gaji' & 'audit_log'
    // -------------------------------------------------------------------------
    console.log("\n▶ [8/8] Mengimpor Koleksi 'slip_gaji' & 'audit_log'...");
    const slipList = readSeed("slip_gaji.json");
    for (const s of slipList) {
      const cleaned = cleanRecord(s);
      await setDoc(doc(db, "slip_gaji", String(s.id)), cleaned);
    }

    const auditList = readSeed("audit_log.json");
    for (const logItem of auditList) {
      const cleaned = cleanRecord(logItem);
      await setDoc(doc(db, "audit_log", String(logItem.id)), cleaned);
    }
    console.log(`  ✓ Berhasil mengimpor ${slipList.length} slip gaji dan ${auditList.length} audit log.`);

    console.log("\n=======================================================");
    console.log("  🎉 SEEDING DATABASE FIREBASE SUKSES 100%!           ");
    console.log("=======================================================\n");

  } catch (error) {
    console.error("\n❌ Terjadi kesalahan saat seeding:", error);
  } finally {
    process.exit(0);
  }
}

runSeeder();
