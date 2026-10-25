"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { Profile, Peran } from "../types/database";
import profilesData from "../../../data/seeds/profiles.json";
import akunUjiData from "../../../data/seeds/akun_uji.json";

export interface AuthUser extends Profile {
  divisi_nama?: string;
  seed_id?: string;
  foto_url?: string;
  foto?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, kataSandi: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "karsahr_current_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load persistent session from localStorage on mount and sync with Firebase Auth
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const initAuth = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        let parsedUser: AuthUser | null = null;
        if (stored) {
          parsedUser = JSON.parse(stored);
          setUser(parsedUser);
        }

        // Setup Firebase onAuthStateChanged listener
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            // Firebase user is signed in
            if (parsedUser) {
              if (parsedUser.id !== firebaseUser.uid) {
                const updatedUser: AuthUser = {
                  ...parsedUser,
                  id: firebaseUser.uid,
                  seed_id: parsedUser.seed_id || parsedUser.id,
                };
                setUser(updatedUser);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
              }
            }
          } else if (parsedUser) {
            // Reconnect Firebase Auth using test user credentials if session exists
            const cleanEmail = parsedUser.email?.toLowerCase();
            const akun = (akunUjiData as Array<{ email: string; kata_sandi: string }>).find(
              (a) => a.email.toLowerCase() === cleanEmail
            );
            if (akun) {
              try {
                const cred = await signInWithEmailAndPassword(
                  auth,
                  akun.email,
                  akun.kata_sandi || "Latihan#2026"
                );
                if (cred.user && parsedUser.id !== cred.user.uid) {
                  const updatedUser: AuthUser = {
                    ...parsedUser,
                    id: cred.user.uid,
                    seed_id: parsedUser.seed_id || parsedUser.id,
                  };
                  setUser(updatedUser);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
                }
              } catch (reconnectErr) {
                console.warn("Re-auth Firebase warning:", reconnectErr);
              }
            }
          }
        });
      } catch (e) {
        console.error("Gagal memuat sesi lokal", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const login = async (emailInput: string, kataSandiInput: string): Promise<{ success: boolean; error?: string }> => {
    // Normalisasi input
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPassword = kataSandiInput.trim();

    // 1. Cari data di akun uji
    const akun = (akunUjiData as Array<{
      nama: string;
      email: string;
      peran: string;
      divisi: string;
      kata_sandi: string;
      status: string;
      catatan?: string | null;
    }>).find(
      (a) => a.email.toLowerCase() === cleanEmail
    );

    if (!akun) {
      return { success: false, error: "Email tidak terdaftar dalam sistem perusahaan." };
    }

    // 2. Validasi password (Latihan#2026 atau password tersimpan)
    if (cleanPassword !== akun.kata_sandi) {
      return { success: false, error: "Kata sandi yang Anda masukkan salah." };
    }

    // 3. Validasi Aturan Bisnis BR-01: Akun Nonaktif (kasus Bambang Hartono dan pembaruan HRD)
    if (akun.status === "nonaktif") {
      return { 
        success: false, 
        error: "Akun Anda telah dinonaktifkan oleh HRD. Akses masuk ditolak." 
      };
    }

    if (typeof window !== "undefined") {
      try {
        const storedOverrides = localStorage.getItem("karsahr_profiles_overrides");
        if (storedOverrides) {
          const list = JSON.parse(storedOverrides);
          const found = list.find(
            (p: any) =>
              p.email?.toLowerCase() === cleanEmail ||
              (p.nik_karyawan && p.nik_karyawan === (akun as any).nik_karyawan)
          );
          if (found && found.aktif === false) {
            return {
              success: false,
              error: "Akun Anda telah dinonaktifkan oleh HRD. Akses masuk ditolak.",
            };
          }
        }
      } catch (e) {}
    }

    // 4. Otentikasi dengan Firebase Authentication
    let firebaseUid: string | null = null;
    try {
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      firebaseUid = userCred.user.uid;
    } catch (firebaseErr: any) {
      if (firebaseErr.code === "auth/user-not-found") {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          firebaseUid = newCred.user.uid;
        } catch (createErr) {
          console.warn("Gagal membuat akun Firebase Auth:", createErr);
        }
      } else {
        console.warn("Firebase Auth sign-in warning:", firebaseErr?.message);
      }
    }

    // 5. Cari profile lengkap
    const profile = (profilesData as unknown as Array<Profile & { "divisi (bantu)"?: string }>).find(
      (p) => p.email.toLowerCase() === cleanEmail
    );

    const authUser: AuthUser = {
      id: firebaseUid || (profile ? profile.id : "user-" + Date.now()),
      seed_id: profile ? profile.id : undefined,
      nik_karyawan: profile ? profile.nik_karyawan : "KLN-0000",
      nama_lengkap: akun.nama,
      email: akun.email,
      peran: akun.peran as Peran,
      divisi_id: profile ? profile.divisi_id : "div-default",
      divisi_nama: akun.divisi,
      jabatan: profile ? profile.jabatan : "Staff",
      status_kerja: profile ? profile.status_kerja : "tetap",
      tanggal_masuk: profile ? profile.tanggal_masuk : "2021-01-01",
      aktif: akun.status === "aktif",
    };

    // Simpan ke state dan localStorage
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));

    return { success: true };
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out Firebase:", e);
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
}
