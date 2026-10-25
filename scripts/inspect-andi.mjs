import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
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
const auth = getAuth(app);
const db = getFirestore(app);

async function inspectAndi() {
  await signInWithEmailAndPassword(auth, "rina.kusumawardani@karsalintas.test", "Latihan#2026");
  console.log("Logged in as Rina (HRD)");

  const snap = await getDocs(collection(db, "pengajuan_cuti"));
  console.log("Total pengajuan_cuti in Firestore:", snap.size);

  const andiDocs = [];
  snap.forEach((d) => {
    const data = d.data();
    const nama = (data.nama_karyawan || data["pemohon (bantu)"] || "").toLowerCase();
    const isAndi =
      data.karyawan_id === "3ce404ad-885e-51ef-bbf7-10345f2c2f04" ||
      data.karyawan_id === "karyawan-andi" ||
      data.nik_karyawan === "KLN-0009" ||
      nama === "andi wijaya";

    if (isAndi) {
      andiDocs.push({ id: d.id, ...data });
    }
  });

  console.log("Andi docs in Firestore:", JSON.stringify(andiDocs, null, 2));
}

inspectAndi().catch(console.error);
