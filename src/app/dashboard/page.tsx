"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  LayoutDashboard, 
  Clock, 
  Calendar, 
  FileText, 
  CheckSquare, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus, 
  Download, 
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  QrCode
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { formatRupiah } from "@/lib/utils/time";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  
  // Realtime Server Time WIB
  const [serverTime, setServerTime] = useState("");
  const [hasCheckedIn, setHasCheckedIn] = useState(true);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState("07.39");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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
      
      const timeStr = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(wib) + " WIB";
      
      setServerTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !user) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Memuat data KarsaHR...</p>
        <style jsx>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 1rem;
            color: #64748b;
            font-size: 0.9375rem;
          }
          .spinner {
            width: 36px;
            height: 36px;
            border: 3px solid #e2e8f0;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
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
    setActionNotice(`Berhasil Check-in pada pukul ${hh}.${mm} WIB. Jam tercatat dari server.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCheckOut = () => {
    setHasCheckedOut(true);
    setActionNotice("Berhasil Check-out. Presensi Anda hari ini telah lengkap.");
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="brand-name">KarsaHR</h1>
            <p className="brand-company">PT Karsa Lintas Nusantara</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link href="/dashboard" className="nav-item active">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <Link href="/dashboard" className="nav-item">
            <Clock className="w-4 h-4" />
            <span>Absensi</span>
          </Link>

          <Link href="/dashboard" className="nav-item">
            <Calendar className="w-4 h-4" />
            <span>Cuti dan Izin</span>
          </Link>

          {(user.peran === "atasan" || user.peran === "hrd") && (
            <Link href="/dashboard" className="nav-item">
              <CheckSquare className="w-4 h-4" />
              <span>Persetujuan</span>
              <span className="nav-badge">
                {user.peran === "atasan" ? "1" : "4"}
              </span>
            </Link>
          )}

          {(user.peran === "atasan" || user.peran === "hrd") && (
            <Link href="/dashboard" className="nav-item">
              <Users className="w-4 h-4" />
              <span>Data Karyawan</span>
            </Link>
          )}

          <Link href="/dashboard" className="nav-item">
            <FileText className="w-4 h-4" />
            <span>Slip Gaji</span>
          </Link>

          {user.peran === "hrd" && (
            <>
              <Link href="/dashboard" className="nav-item">
                <BarChart3 className="w-4 h-4" />
                <span>Laporan</span>
              </Link>

              <Link href="/dashboard" className="nav-item">
                <Settings className="w-4 h-4" />
                <span>Pengaturan</span>
              </Link>
            </>
          )}
        </nav>

        {/* User Card at bottom of sidebar */}
        <div className="sidebar-user">
          <div className="user-info">
            <p className="user-name">{user.nama_lengkap}</p>
            <p className="user-role">
              {user.peran.toUpperCase()} · {user.divisi_nama || user.jabatan}
            </p>
          </div>
          <button onClick={logout} title="Keluar dari akun" className="btn-logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="content-header">
          <div>
            <h2 className="greeting-title">
              Selamat {new Date().getHours() < 12 ? "pagi" : new Date().getHours() < 16 ? "siang" : "sore"},{" "}
              <span className="text-primary">{user.nama_lengkap.split(" ")[0]}</span>
            </h2>
            <p className="server-timestamp">
              <Clock className="w-3.5 h-3.5 inline mr-1 text-primary" />
              {serverTime}
            </p>
          </div>

          <div className="header-meta">
            <span className="ref-badge">REFERENSI WIREFRAME · AKTIF</span>
          </div>
        </header>

        {actionNotice && (
          <div className="action-alert">
            <CheckCircle2 className="w-4 h-4 text-emerald" />
            <span>{actionNotice}</span>
          </div>
        )}

        <div className="dashboard-body">
          {/* Top 3 Stat Cards */}
          <div className="metrics-grid">
            {/* Card 1: Absensi Hari Ini */}
            <div className="card stat-card">
              <span className="stat-label">ABSENSI HARI INI</span>
              <div className="stat-value-row">
                <span className="stat-value">
                  {hasCheckedIn ? `Check-in ${checkInTime}` : "Belum Check-in"}
                </span>
                {hasCheckedIn && <span className="badge badge-hadir">Hadir</span>}
              </div>
              <p className="stat-subtext">
                {hasCheckedOut 
                  ? "Sudah Check-out hari ini."
                  : "Check-out bisa dilakukan sampai pukul 23.59 WIB"}
              </p>
              <div className="stat-actions">
                <button 
                  onClick={handleCheckIn} 
                  disabled={hasCheckedIn} 
                  className="btn btn-secondary btn-sm"
                >
                  Check-in
                </button>
                <button 
                  onClick={handleCheckOut} 
                  disabled={!hasCheckedIn || hasCheckedOut} 
                  className="btn btn-primary btn-sm"
                >
                  {hasCheckedOut ? "Sudah Check-out" : "Check-out"}
                </button>
              </div>
            </div>

            {/* Card 2: Sisa Cuti */}
            <div className="card stat-card">
              <span className="stat-label">SISA CUTI TAHUNAN 2026</span>
              <div className="stat-value-row">
                <span className="stat-value text-blue">5 <span className="stat-unit">dari 12 hari</span></span>
              </div>
              <p className="stat-subtext">7 hari terpakai atau sedang diajukan</p>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: "58.3%" }}></div>
              </div>
            </div>

            {/* Card 3: Kehadiran Oktober */}
            <div className="card stat-card">
              <span className="stat-label">KEHADIRAN OKTOBER</span>
              <div className="stat-value-row">
                <span className="stat-value text-emerald">10 <span className="stat-unit">tepat waktu</span></span>
              </div>
              <p className="stat-subtext">1 kali terlambat · batas jam masuk 08.15</p>
            </div>
          </div>

          {/* Middle Row: Pengajuan Cuti & Slip Gaji */}
          <div className="middle-grid">
            {/* Left: Pengajuan Saya */}
            <div className="card section-card">
              <div className="section-card-header">
                <h3 className="section-title">Pengajuan saya</h3>
                <button className="btn btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajukan cuti atau izin</span>
                </button>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>JENIS</th>
                      <th>TANGGAL</th>
                      <th>LAMA</th>
                      <th>STATUS</th>
                      <th>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-semibold">Cuti tahunan</td>
                      <td>26 Okt 2026 sampai 28 Okt 2026</td>
                      <td>3 hari</td>
                      <td><span className="badge badge-diajukan">Diajukan</span></td>
                      <td>
                        <button className="btn-table-cancel">Batalkan</button>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Cuti tahunan</td>
                      <td>21 Sep 2026 sampai 22 Sep 2026</td>
                      <td>2 hari</td>
                      <td><span className="badge badge-disetujui">Disetujui</span></td>
                      <td><span className="text-muted">-</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Cuti tahunan</td>
                      <td>24 Mar 2026 sampai 25 Mar 2026</td>
                      <td>2 hari</td>
                      <td><span className="badge badge-disetujui">Disetujui</span></td>
                      <td><span className="text-muted">-</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Slip Gaji Terakhir */}
            <div className="card section-card">
              <div className="section-card-header">
                <h3 className="section-title">Slip gaji terakhir</h3>
              </div>

              <div className="slip-box">
                <div className="slip-meta">
                  <span className="slip-label">Periode</span>
                  <p className="slip-period">September 2026 · SG-202609-007</p>
                </div>

                <div className="slip-total-box">
                  <span className="slip-label">Total diterima</span>
                  <p className="slip-nominal">{formatRupiah(8112000)}</p>
                </div>

                <button className="btn btn-secondary w-full">
                  <Download className="w-4 h-4" />
                  <span>Lihat dan unduh slip</span>
                </button>

                <p className="slip-disclaimer">
                  🔒 Slip hanya bisa dilihat oleh Anda dan HRD.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row: Absensi 5 Hari Terakhir */}
          <div className="card section-card">
            <div className="section-card-header">
              <h3 className="section-title">Absensi 5 hari terakhir</h3>
            </div>

            <div className="table-container">
              <table className="table">
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
                    <td className="font-semibold">Kamis, 15 Okt 2026</td>
                    <td>07.39</td>
                    <td>{hasCheckedOut ? "17.05" : "-"}</td>
                    <td><span className="badge badge-hadir">Hadir</span></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Rabu, 14 Okt 2026</td>
                    <td>07.22</td>
                    <td>17.59</td>
                    <td><span className="badge badge-hadir">Hadir</span></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Selasa, 13 Okt 2026</td>
                    <td>07.51</td>
                    <td>17.39</td>
                    <td><span className="badge badge-hadir">Hadir</span></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Senin, 12 Okt 2026</td>
                    <td>08.15</td>
                    <td>17.49</td>
                    <td><span className="badge badge-hadir">Hadir</span></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Jumat, 9 Okt 2026</td>
                    <td>07.20</td>
                    <td>17.14</td>
                    <td><span className="badge badge-hadir">Hadir</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .sidebar {
          width: 250px;
          background: #0f172a;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          height: 100vh;
          position: sticky;
          top: 0;
        }

        .sidebar-brand {
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-name {
          font-size: 1.125rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.1;
        }

        .brand-company {
          font-size: 0.6875rem;
          color: #94a3b8;
        }

        .sidebar-nav {
          flex: 1;
          padding: 1rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          border-radius: 8px;
          font-size: 0.875rem;
          color: #cbd5e1;
          text-decoration: none;
          transition: all 150ms ease;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        .nav-item.active {
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
        }

        .nav-badge {
          margin-left: auto;
          background: #ef4444;
          color: #ffffff;
          font-size: 0.6875rem;
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
          font-weight: 700;
        }

        .sidebar-user {
          padding: 1rem 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.2);
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #ffffff;
        }

        .user-role {
          font-size: 0.6875rem;
          color: #94a3b8;
        }

        .btn-logout {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.375rem;
          border-radius: 6px;
          transition: all 150ms ease;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .content-header {
          padding: 1.5rem 2rem;
          background: #ffffff;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .greeting-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .server-timestamp {
          font-size: 0.8125rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        .ref-badge {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .action-alert {
          margin: 1.5rem 2rem 0;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .dashboard-body {
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .stat-label {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.05em;
        }

        .stat-value-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0.5rem 0 0.25rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
        }

        .stat-unit {
          font-size: 0.875rem;
          font-weight: 500;
          color: #64748b;
        }

        .stat-subtext {
          font-size: 0.8125rem;
          color: #64748b;
          margin-bottom: 0.875rem;
        }

        .stat-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.45rem 0.875rem;
          font-size: 0.8125rem;
        }

        .progress-bar-bg {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: #2563eb;
          border-radius: 9999px;
        }

        .middle-grid {
          display: grid;
          grid-template-columns: 2fr 1.2fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .middle-grid {
            grid-template-columns: 1fr;
          }
        }

        .section-card {
          padding: 1.5rem;
        }

        .section-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #0f172a;
        }

        .btn-table-cancel {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-table-cancel:hover {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fca5a5;
        }

        .slip-box {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .slip-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
        }

        .slip-period {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #1e293b;
        }

        .slip-nominal {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
        }

        .slip-disclaimer {
          font-size: 0.75rem;
          color: #64748b;
          text-align: center;
        }

        .w-full {
          width: 100%;
        }

        .font-semibold {
          font-weight: 600;
        }

        .text-blue {
          color: #2563eb;
        }

        .text-emerald {
          color: #10b981;
        }
      `}</style>
    </div>
  );
}
