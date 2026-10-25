import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, deleteDoc, updateDoc } from "firebase/firestore";
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

async function cleanFirestore() {
  await signInWithEmailAndPassword(auth, "rina.kusumawardani@karsalintas.test", "Latihan#2026");
  console.log("Logged in as Rina (HRD)");

  // 1. Hapus dokumen test/invalid wJxsktRTRnFrRRqBYggh
  const invalidDocRef = doc(db, "pengajuan_cuti", "wJxsktRTRnFrRRqBYggh");
  try {
    await deleteDoc(invalidDocRef);
    console.log("✓ Berhasil menghapus dokumen test invalid ID: wJxsktRTRnFrRRqBYggh");
  } catch (e) {
    console.warn("Doc wJxsktRTRnFrRRqBYggh:", e.message);
  }

  // 2. Update kuota_cuti milik Andi Wijaya (tahun 2026): terpakai = 7, sisa = 5
  const kuotaRef = doc(db, "kuota_cuti", "5d20d824-da83-5165-85cf-ae5bf5579547");
  await updateDoc(kuotaRef, {
    terpakai_hari: 7,
    terpakai: 7,
    sisa_kuota: 5,
    sisa: 5,
    "sisa (bantu)": 5,
    updated_at: new Date().toISOString(),
  });
  console.log("✓ Berhasil menyinkronkan kuota cuti Andi Wijaya 2026: Terpakai = 7 hari, Sisa = 5 hari.");
}

cleanFirestore().catch(console.error);
