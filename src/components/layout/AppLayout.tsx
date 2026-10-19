"use client";

import React, { useEffect, useState } from "react";
import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [serverTimeFormatted, setServerTimeFormatted] = useState("Kamis, 15 Okt 2026 · Jam server 10.24 WIB");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wib = new Date(utc + 7 * 3600000);

      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

      const dayName = days[wib.getDay()];
      const dayDate = wib.getDate();
      const monthName = months[wib.getMonth()];
      const year = wib.getFullYear();
      const hh = String(wib.getHours()).padStart(2, "0");
      const mm = String(wib.getMinutes()).padStart(2, "0");

      setServerTimeFormatted(`${dayName}, ${dayDate} ${monthName} ${year} · Jam server ${hh}.${mm} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#6b7280" }}>
        Memuat data...
      </div>
    );
  }

  // Tentukan sapaan dan role label
  const roleLabel = user.peran === "hrd" ? "HRD" : user.peran === "atasan" ? "Atasan" : "Karyawan";
  const divisiLabel = user.divisi_nama || user.jabatan;

  return (
    <div className="app-shell">
      {/* Sidebar Navigasi Sesuai Wireframe */}
      <aside className="app-sidebar">
        <div>
          <div className="sidebar-header">
            <h1 className="brand-title">KarsaHR</h1>
            <p className="brand-company">PT Karsa Lintas Nusantara</p>
          </div>

          <nav className="sidebar-menu">
            <a
              href="/dashboard"
              className={`menu-item ${pathname === "/dashboard" ? "active" : ""}`}
            >
              <span>Dashboard</span>
            </a>

            <a
              href="/absensi"
              className={`menu-item ${pathname === "/absensi" ? "active" : ""}`}
            >
              <span>Absensi</span>
            </a>

            <a
              href="/cuti"
              className={`menu-item ${pathname === "/cuti" ? "active" : ""}`}
            >
              <span>Cuti dan Izin</span>
            </a>

            {/* Menu Khusus Atasan & HRD sesuai PRD */}
            {(user.peran === "atasan" || user.peran === "hrd") && (
              <a
                href="/persetujuan"
                className={`menu-item ${pathname === "/persetujuan" ? "active" : ""}`}
              >
                <span>Persetujuan</span>
                <span className="menu-badge">
                  {user.peran === "atasan" ? "1" : "4"}
                </span>
              </a>
            )}

            {(user.peran === "atasan" || user.peran === "hrd") && (
              <a
                href="/karyawan"
                className={`menu-item ${pathname === "/karyawan" ? "active" : ""}`}
              >
                <span>Data Karyawan</span>
              </a>
            )}

            <a
              href="/slip-gaji"
              className={`menu-item ${pathname === "/slip-gaji" ? "active" : ""}`}
            >
              <span>Slip Gaji</span>
            </a>

            {/* Menu Khusus HRD sesuai PRD */}
            {user.peran === "hrd" && (
              <>
                <a
                  href="/laporan"
                  className={`menu-item ${pathname === "/laporan" ? "active" : ""}`}
                >
                  <span>Laporan</span>
                </a>
                <a
                  href="/pengaturan"
                  className={`menu-item ${pathname === "/pengaturan" ? "active" : ""}`}
                >
                  <span>Pengaturan</span>
                </a>
              </>
            )}
          </nav>
        </div>

        {/* Profil Bawah Sidebar */}
        <div className="sidebar-footer">
          <p className="user-display-name">{user.nama_lengkap}</p>
          <p className="user-display-role">{roleLabel} · {divisiLabel}</p>
          <button onClick={logout} className="btn-signout">
            Keluar akun
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="app-main">
        {/* Header Kanan Atas Sesuai Wireframe */}
        <header className="main-header">
          <div>
            <h2 className="header-title">
              Selamat {new Date().getHours() < 12 ? "pagi" : new Date().getHours() < 16 ? "siang" : "sore"},{" "}
              {user.nama_lengkap.split(" ")[0]}
            </h2>
            <p className="header-time">{serverTimeFormatted}</p>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
