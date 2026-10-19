"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Profile, Peran } from "../types/database";
import profilesData from "../../../data/seeds/profiles.json";
import akunUjiData from "../../../data/seeds/akun_uji.json";

interface AuthUser extends Profile {
  divisi_nama?: string;
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

  // Load persistent session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Gagal memuat sesi lokal", e);
    } finally {
      setLoading(false);
    }
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

    // 3. Validasi Aturan Bisnis BR-01: Akun Nonaktif (kasus Bambang Hartono)
    if (akun.status === "nonaktif") {
      return { 
        success: false, 
        error: "Akun Anda telah dinonaktifkan oleh HRD. Akses masuk ditolak." 
      };
    }

    // 4. Cari profile lengkap
    const profile = (profilesData as Array<Profile & { "divisi (bantu)"?: string }>).find(
      (p) => p.email.toLowerCase() === cleanEmail
    );

    const authUser: AuthUser = {
      id: profile ? profile.id : "user-" + Date.now(),
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

  const logout = () => {
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
