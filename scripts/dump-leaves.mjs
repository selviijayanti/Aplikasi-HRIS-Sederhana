import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...values] = trimmed.split("=");
      if (key && values.length) {
        process.env[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listAll() {
  const snap = await getDocs(collection(db, "pengajuan_cuti"));
  console.log("Total docs:", snap.size);
  const docs = [];
  snap.forEach((d) => {
    const data = d.data();
    docs.push({
      id: d.id,
      karyawan_id: data.karyawan_id,
      nama: data.nama_karyawan || data["pemohon (bantu)"],
      nik: data.nik_karyawan,
      jenis: data.jenis,
      mulai: data.tanggal_mulai,
      selesai: data.tanggal_selesai,
      hari: data.jumlah_hari,
      status: data.status,
      created: data.dibuat_pada || data.created_at,
    });
  });
  console.log(JSON.stringify(docs, null, 2));
}

listAll().catch(console.error);
