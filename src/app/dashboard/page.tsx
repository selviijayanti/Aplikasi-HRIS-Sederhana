"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [hasCheckedIn, setHasCheckedIn] = useState(true);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState("07.39");
  const [serverTimeFormatted, setServerTimeFormatted] = useState("Kamis, 15 Okt 2026 · Jam server 10.24 WIB");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Realtime clock format sesuai wireframe: "Kamis, 15 Okt 2026 · Jam server HH.MM WIB"
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
      <div className="loading-state">
        <p>Memuat data KarsaHR...</p>
        <style jsx>{`
          .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #64748b;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  const handleCheckIn = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setCheckInTime(`${hh}.${mm}`);
    setHasCheckedIn(true);
    setActionNotice(`Berhasil check-in pada pukul ${hh}.${mm} WIB.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleCheckOut = () => {
    setHasCheckedOut(true);
    setActionNotice("Berhasil check-out. Presensi hari ini telah lengkap.");
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="layout-root">
      {/* Sidebar Kiri */}
      <aside className="sidebar">
        <div>
          <div className="brand-box">
            <h1 className="brand-title">KarsaHR</h1>
            <p className="brand-sub">PT Karsa Lintas Nusantara</p>
          </div>

          <nav className="nav-menu">
            <Link href="/dashboard" className="nav-link active">
              Dashboard
            </Link>
            <Link href="/absensi" className="nav-link">
              Absensi
            </Link>
            <Link href="/cuti" className="nav-link">
              Cuti dan Izin
            </Link>

            {/* Menu Khusus Atasan & HRD sesuai PRD */}
            {(user.peran === "atasan" || user.peran === "hrd") && (
              <Link href="/persetujuan" className="nav-link nav-badge-row">
                <span>Persetujuan</span>
                <span className="badge-pill">{user.peran === "atasan" ? "1" : "4"}</span>
              </Link>
            )}

            {(user.peran === "atasan" || user.peran === "hrd") && (
              <Link href="/karyawan" className="nav-link">
                Data Karyawan
              </Link>
            )}

            <Link href="/slip-gaji" className="nav-link">
              Slip Gaji
            </Link>

            {/* Menu Khusus HRD sesuai PRD */}
            {user.peran === "hrd" && (
              <>
                <Link href="/laporan" className="nav-link">
                  Laporan
                </Link>
                <Link href="/pengaturan" className="nav-link">
                  Pengaturan
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Profil Bawah Sidebar */}
        <div className="user-profile-box">
          <p className="user-name">{user.nama_lengkap}</p>
          <p className="user-detail">
            {user.peran === "hrd" ? "HRD" : user.peran === "atasan" ? "Atasan" : "Karyawan"} · {user.divisi_nama || user.jabatan}
          </p>
          <button onClick={logout} className="logout-link">
            Keluar akun
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="content-area">
        {/* Header Sapaan & Waktu Server */}
        <header className="page-header">
          <div>
            <h2 className="greeting-text">
              Selamat {new Date().getHours() < 12 ? "pagi" : new Date().getHours() < 16 ? "siang" : "sore"},{" "}
              {user.nama_lengkap.split(" ")[0]}
            </h2>
            <p className="server-time-text">{serverTimeFormatted}</p>
          </div>
          <div className="reference-tag">
            REFERENSI TAMPILAN, bukan desain wajib
          </div>
        </header>

        {actionNotice && (
          <div className="toast-notice">
            {actionNotice}
          </div>
        )}

        {/* 3 Kotak Metrik Ringkasan (Wireframe Halaman 1) */}
        <div className="metrics-row">
          {/* Card 1: Absensi Hari Ini */}
          <div className="card metric-card">
            <span className="metric-header-title">ABSENSI HARI INI</span>
            <div className="checkin-status-row">
              <span className="checkin-time">
                {hasCheckedIn ? `Check-in ${checkInTime}` : "Belum check-in"}
              </span>
              {hasCheckedIn && <span className="status-badge status-hadir">Hadir</span>}
            </div>
            <p className="metric-desc">
              {hasCheckedOut
                ? "Sudah check-out untuk hari ini."
                : "Check-out bisa dilakukan sampai pukul 23.59 WIB"}
            </p>
            <div className="button-group">
              <button
                onClick={handleCheckIn}
                disabled={hasCheckedIn}
                className="btn-attendance btn-checkin"
              >
                Check-in
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!hasCheckedIn || hasCheckedOut}
                className="btn-attendance btn-checkout"
              >
                {hasCheckedOut ? "Selesai" : "Check-out"}
              </button>
            </div>
          </div>

          {/* Card 2: Sisa Cuti Tahunan */}
          <div className="card metric-card">
            <span className="metric-header-title">SISA CUTI TAHUNAN 2026</span>
            <div className="leave-balance-row">
              <span className="leave-amount">5</span>
              <span className="leave-total">dari 12 hari</span>
            </div>
            <p className="metric-desc">7 hari terpakai atau sedang diajukan</p>
          </div>

          {/* Card 3: Kehadiran Oktober */}
          <div className="card metric-card">
            <span className="metric-header-title">KEHADIRAN OKTOBER</span>
            <div className="attendance-month-row">
              <span className="month-stat">10</span>
              <span className="leave-total">tepat waktu</span>
            </div>
            <p className="metric-desc">1 kali terlambat · batas jam masuk 08.15</p>
          </div>
        </div>

        {/* Baris Kedua: Pengajuan Saya & Slip Gaji Terakhir */}
        <div className="two-columns-row">
          {/* Pengajuan Saya */}
          <div className="card section-panel">
            <div className="panel-header">
              <h3 className="panel-title">Pengajuan saya</h3>
              <button className="btn-action-primary">+ Ajukan cuti atau izin</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>JENIS</th>
                  <th>TANGGAL</th>
                  <th>LAMA</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cuti tahunan</td>
                  <td>26 Okt 2026 sampai 28 Okt 2026</td>
                  <td>3 hari</td>
                  <td><span className="status-badge status-diajukan">Diajukan</span></td>
                  <td><button className="btn-cancel">Batalkan</button></td>
                </tr>
                <tr>
                  <td>Cuti tahunan</td>
                  <td>21 Sep 2026 sampai 22 Sep 2026</td>
                  <td>2 hari</td>
                  <td><span className="status-badge status-disetujui">Disetujui</span></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Cuti tahunan</td>
                  <td>24 Mar 2026 sampai 25 Mar 2026</td>
                  <td>2 hari</td>
                  <td><span className="status-badge status-disetujui">Disetujui</span></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Slip Gaji Terakhir */}
          <div className="card section-panel slip-panel">
            <h3 className="panel-title">Slip gaji terakhir</h3>
            <div className="slip-content">
              <div>
                <span className="slip-sub">Periode</span>
                <p className="slip-value">September 2026 · SG-202609-007</p>
              </div>

              <div>
                <span className="slip-sub">Total diterima</span>
                <p className="salary-amount">Rp8.112.000</p>
              </div>

              <button className="btn-view-slip">Lihat dan unduh slip</button>
              <p className="slip-note">Slip hanya bisa dilihat oleh Anda dan HRD.</p>
            </div>
          </div>
        </div>

        {/* Baris Ketiga: Absensi 5 Hari Terakhir */}
        <div className="card section-panel">
          <div className="panel-header">
            <h3 className="panel-title">Absensi 5 hari terakhir</h3>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>TANGGAL</th>
                <th>MASUK</th>
                <th>PULANG</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Kamis, 15 Okt 2026</td>
                <td>07.39</td>
                <td>{hasCheckedOut ? "17.05" : "-"}</td>
                <td><span className="status-badge status-hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Rabu, 14 Okt 2026</td>
                <td>07.22</td>
                <td>17.59</td>
                <td><span className="status-badge status-hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Selasa, 13 Okt 2026</td>
                <td>07.51</td>
                <td>17.39</td>
                <td><span className="status-badge status-hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Senin, 12 Okt 2026</td>
                <td>08.15</td>
                <td>17.49</td>
                <td><span className="status-badge status-hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Jumat, 9 Okt 2026</td>
                <td>07.20</td>
                <td>17.14</td>
                <td><span className="status-badge status-hadir">Hadir</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <style jsx>{`
        .layout-root {
          display: flex;
          min-height: 100vh;
          background-color: #f8fafc;
          font-family: inherit;
        }

        /* Sidebar Sesuai Wireframe */
        .sidebar {
          width: 220px;
          background-color: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex-shrink: 0;
          height: 100vh;
          position: sticky;
          top: 0;
          padding: 1.5rem 1rem;
        }

        .brand-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
        }

        .brand-sub {
          font-size: 0.6875rem;
          color: #64748b;
          margin: 0.15rem 0 1.5rem 0;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .nav-link {
          display: block;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #475569;
          text-decoration: none;
          border-radius: 6px;
          transition: background-color 150ms ease, color 150ms ease;
        }

        .nav-link:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }

        .nav-link.active {
          color: #2563eb;
          font-weight: 600;
          background-color: #eff6ff;
        }

        .nav-badge-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .badge-pill {
          background-color: #2563eb;
          color: #ffffff;
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
        }

        .user-profile-box {
          border-top: 1px solid #e2e8f0;
          padding-top: 1rem;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .user-detail {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0.15rem 0 0.5rem 0;
        }

        .logout-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 0.75rem;
          color: #dc2626;
          cursor: pointer;
          font-family: inherit;
        }

        .logout-link:hover {
          text-decoration: underline;
        }

        /* Area Konten */
        .content-area {
          flex: 1;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          min-width: 0;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .greeting-text {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .server-time-text {
          font-size: 0.8125rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        .reference-tag {
          background: #0f172a;
          color: #ffffff;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.3rem 0.65rem;
          border-radius: 4px;
          letter-spacing: 0.04em;
        }

        .toast-notice {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.625rem 1rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        /* 3 Card Metrik */
        .metrics-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .metrics-row {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1.25rem;
        }

        .metric-header-title {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.05em;
          display: block;
        }

        .checkin-status-row, .leave-balance-row, .attendance-month-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin: 0.4rem 0 0.2rem 0;
        }

        .checkin-time, .leave-amount, .month-stat {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
        }

        .leave-total {
          font-size: 0.875rem;
          color: #64748b;
          font-weight: 500;
        }

        .metric-desc {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0 0 1rem 0;
        }

        .button-group {
          display: flex;
          gap: 0.5rem;
        }

        .btn-attendance {
          padding: 0.5rem 1rem;
          font-size: 0.8125rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .btn-checkin {
          background: #f1f5f9;
          color: #94a3b8;
          border-color: #e2e8f0;
          cursor: not-allowed;
        }

        .btn-checkout {
          background: #2563eb;
          color: #ffffff;
        }

        .btn-checkout:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .btn-checkout:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        /* Baris Kedua */
        .two-columns-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .two-columns-row {
            grid-template-columns: 1fr;
          }
        }

        .section-panel {
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .panel-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .btn-action-primary {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 0.4rem 0.875rem;
          font-size: 0.8125rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-action-primary:hover {
          background: #1d4ed8;
        }

        /* Tabel Data Sesuai Wireframe */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }

        .data-table th {
          text-align: left;
          padding: 0.625rem 0.5rem;
          color: #64748b;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.6875rem;
          letter-spacing: 0.05em;
        }

        .data-table td {
          padding: 0.75rem 0.5rem;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
        }

        .data-table tr:last-child td {
          border-bottom: none;
        }

        .status-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 600;
        }

        .status-hadir {
          background: #eff6ff;
          color: #2563eb;
        }

        .status-diajukan {
          background: #f1f5f9;
          color: #475569;
        }

        .status-disetujui {
          background: #eff6ff;
          color: #2563eb;
        }

        .btn-cancel {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 0.6875rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-cancel:hover {
          background: #f8fafc;
        }

        /* Slip Gaji Box Sesuai Wireframe */
        .slip-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .slip-content {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          margin-top: 0.5rem;
        }

        .slip-sub {
          font-size: 0.75rem;
          color: #64748b;
          display: block;
        }

        .slip-value {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0.15rem 0 0 0;
        }

        .salary-amount {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0.15rem 0 0 0;
        }

        .btn-view-slip {
          width: 100%;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.625rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-view-slip:hover {
          background: #f8fafc;
        }

        .slip-note {
          font-size: 0.6875rem;
          color: #64748b;
          margin: 0;
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}
