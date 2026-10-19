"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";

export default function DashboardPage() {
  const [hasCheckedIn, setHasCheckedIn] = useState(true);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState("07.39");

  const handleCheckIn = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setCheckInTime(`${hh}.${mm}`);
    setHasCheckedIn(true);
  };

  const handleCheckOut = () => {
    setHasCheckedOut(true);
  };

  return (
    <AppLayout>
      {/* 3 Kotak Metrik Atas (Wireframe 1) */}
      <div className="metrics-row">
        {/* Card 1: Absensi Hari Ini */}
        <div className="ui-card">
          <div className="metric-title">ABSENSI HARI INI</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">
              {hasCheckedIn ? `Check-in ${checkInTime}` : "Belum check-in"}
            </span>
            {hasCheckedIn && <span className="status-pill hadir">Hadir</span>}
          </div>
          <p className="metric-footnote">
            {hasCheckedOut
              ? "Sudah check-out untuk hari ini."
              : "Check-out bisa dilakukan sampai pukul 23.59 WIB"}
          </p>
          <div className="metric-btn-row">
            <button
              onClick={handleCheckIn}
              disabled={hasCheckedIn}
              className={`ui-btn ${hasCheckedIn ? "ui-btn-disabled" : "ui-btn-secondary"}`}
            >
              Check-in
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!hasCheckedIn || hasCheckedOut}
              className={`ui-btn ${!hasCheckedIn || hasCheckedOut ? "ui-btn-disabled" : "ui-btn-primary"}`}
            >
              Check-out
            </button>
          </div>
        </div>

        {/* Card 2: Sisa Cuti */}
        <div className="ui-card">
          <div className="metric-title">SISA CUTI TAHUNAN 2026</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">5</span>
            <span className="metric-sublabel">dari 12 hari</span>
          </div>
          <p className="metric-footnote">7 hari terpakai atau sedang diajukan</p>
        </div>

        {/* Card 3: Kehadiran Oktober */}
        <div className="ui-card">
          <div className="metric-title">KEHADIRAN OKTOBER</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">10</span>
            <span className="metric-sublabel">tepat waktu</span>
          </div>
          <p className="metric-footnote">1 kali terlambat · batas jam masuk 08.15</p>
        </div>
      </div>

      {/* Baris Kedua: Pengajuan Saya & Slip Gaji */}
      <div className="two-col-layout">
        {/* Pengajuan Saya */}
        <div className="ui-card">
          <div className="card-top-action">
            <h3 className="section-heading">Pengajuan saya</h3>
            <button className="ui-btn ui-btn-primary">+ Ajukan cuti atau izin</button>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
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
                  <td><span className="status-pill diajukan">Diajukan</span></td>
                  <td><button className="ui-btn-cancel">Batalkan</button></td>
                </tr>
                <tr>
                  <td>Cuti tahunan</td>
                  <td>21 Sep 2026 sampai 22 Sep 2026</td>
                  <td>2 hari</td>
                  <td><span className="status-pill disetujui">Disetujui</span></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Cuti tahunan</td>
                  <td>24 Mar 2026 sampai 25 Mar 2026</td>
                  <td>2 hari</td>
                  <td><span className="status-pill disetujui">Disetujui</span></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Slip Gaji Terakhir */}
        <div className="ui-card slip-card-flex">
          <div>
            <h3 className="section-heading">Slip gaji terakhir</h3>
            <div className="slip-meta-group">
              <span className="slip-caption">Periode</span>
              <p className="slip-period-val">September 2026 · SG-202609-007</p>
            </div>
            <div className="slip-meta-group">
              <span className="slip-caption">Total diterima</span>
              <p className="slip-salary-val">Rp8.112.000</p>
            </div>
          </div>

          <div>
            <button className="ui-btn ui-btn-secondary w-full">
              Lihat dan unduh slip
            </button>
            <p className="slip-note-text">
              Slip hanya bisa dilihat oleh Anda dan HRD.
            </p>
          </div>
        </div>
      </div>

      {/* Baris Ketiga: Absensi 5 Hari Terakhir */}
      <div className="ui-card">
        <h3 className="section-heading mb-3">Absensi 5 hari terakhir</h3>
        <div className="ui-table-wrap">
          <table className="ui-table">
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
                <td><span className="status-pill hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Rabu, 14 Okt 2026</td>
                <td>07.22</td>
                <td>17.59</td>
                <td><span className="status-pill hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Selasa, 13 Okt 2026</td>
                <td>07.51</td>
                <td>17.39</td>
                <td><span className="status-pill hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Senin, 12 Okt 2026</td>
                <td>08.15</td>
                <td>17.49</td>
                <td><span className="status-pill hadir">Hadir</span></td>
              </tr>
              <tr>
                <td>Jumat, 9 Okt 2026</td>
                <td>07.20</td>
                <td>17.14</td>
                <td><span className="status-pill hadir">Hadir</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .two-col-layout {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .two-col-layout {
            grid-template-columns: 1fr;
          }
        }

        .card-top-action {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.875rem;
        }

        .section-heading {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
        }

        .mb-3 {
          margin-bottom: 0.875rem;
        }

        .slip-card-flex {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.25rem;
        }

        .slip-meta-group {
          margin-top: 0.75rem;
        }

        .slip-caption {
          font-size: 0.6875rem;
          color: #6b7280;
          display: block;
        }

        .slip-period-val {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #111827;
          margin-top: 0.1rem;
        }

        .slip-salary-val {
          font-size: 1.375rem;
          font-weight: 700;
          color: #111827;
          margin-top: 0.15rem;
        }

        .w-full {
          width: 100%;
        }

        .slip-note-text {
          font-size: 0.6875rem;
          color: #6b7280;
          margin-top: 0.5rem;
          text-align: center;
        }
      `}</style>
    </AppLayout>
  );
}
