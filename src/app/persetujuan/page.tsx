"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";

export default function PersetujuanPage() {
  const { user } = useAuth();
  const [statusPengajuan, setStatusPengajuan] = useState<"diajukan" | "disetujui_atasan" | "disetujui" | "ditolak">("diajukan");
  const [alasanPenolakan, setAlasanPenolakan] = useState("");
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  const handleApprove = () => {
    setAlertError(null);
    if (user?.peran === "atasan") {
      setStatusPengajuan("disetujui_atasan");
      setAlertSuccess("Pengajuan berhasil disetujui pada Tahap 1 oleh Atasan. Diteruskan ke HRD.");
    } else {
      setStatusPengajuan("disetujui");
      setAlertSuccess("Pengajuan resmi disetujui oleh HRD (Keputusan Akhir).");
    }
  };

  const handleReject = () => {
    setAlertError(null);
    if (alasanPenolakan.trim().length < 10) {
      setAlertError("Alasan penolakan wajib minimal 10 karakter bila menolak (Aturan Bisnis BR-09).");
      return;
    }
    setStatusPengajuan("ditolak");
    setAlertSuccess("Pengajuan telah ditolak. Sisa kuota cuti tahunan dikembalikan ke pemohon.");
  };

  return (
    <AppLayout>
      {/* Header Persetujuan Sesuai Wireframe 3 */}
      <div className="breadcrumb-box">
        <span className="breadcrumb-sub">Persetujuan / Detail pengajuan</span>
        <div className="title-row">
          <h2 className="title-main">Cuti tahunan: Andi Wijaya</h2>
          <span className={`status-pill ${statusPengajuan}`}>
            {statusPengajuan === "diajukan"
              ? "Diajukan"
              : statusPengajuan === "disetujui_atasan"
              ? "Disetujui atasan"
              : statusPengajuan === "disetujui"
              ? "Disetujui"
              : "Ditolak"}
          </span>
        </div>
        <p className="subtitle-date">
          Diajukan 13 Okt 2026 pukul 09.12 · Tahap 1 dari 2 (Atasan, lalu HRD)
        </p>
      </div>

      {alertSuccess && <div className="alert-box-success">{alertSuccess}</div>}

      {/* Grid 2 Kolom Sesuai Wireframe 3 */}
      <div className="approval-wireframe-grid">
        {/* Kolom Kiri: Detail Data & Form Keputusan */}
        <div className="left-panel-col">
          <div className="ui-card">
            <div className="info-two-col">
              <div>
                <span className="caption-lbl">Pemohon</span>
                <p className="val-text font-bold">Andi Wijaya · KLN-0009 · Sales Executive</p>
              </div>

              <div>
                <span className="caption-lbl">Kuota cuti pemohon 2026</span>
                <p className="val-text">
                  Jatah 12 · terpakai 7 (termasuk pengajuan ini) · <span className="text-blue font-bold">sisa 5</span>
                </p>
              </div>

              <div>
                <span className="caption-lbl">Tanggal</span>
                <p className="val-text font-medium">Senin, 26 Okt 2026 sampai Rabu, 28 Okt 2026</p>
              </div>

              <div>
                <span className="caption-lbl">Lampiran</span>
                <p className="val-text">Tidak ada</p>
              </div>

              <div>
                <span className="caption-lbl">Lama</span>
                <p className="val-text font-bold">3 hari kerja</p>
              </div>

              <div>
                <span className="caption-lbl">Status kerja</span>
                <p className="val-text">Tetap, masuk 1 Jun 2021</p>
              </div>

              <div className="full-col">
                <span className="caption-lbl">Alasan</span>
                <p className="val-text font-medium">Pulang kampung ke Yogyakarta</p>
              </div>
            </div>

            {/* Form Keputusan Anda (Wireframe 3) */}
            <div className="decision-section">
              <h4 className="decision-label">Keputusan Anda</h4>

              {alertError && <div className="alert-box-error">{alertError}</div>}

              <input
                type="text"
                value={alasanPenolakan}
                onChange={(e) => setAlasanPenolakan(e.target.value)}
                placeholder="Alasan penolakan (wajib minimal 10 karakter bila menolak)"
                className="reason-input-line"
              />

              <div className="decision-btn-row">
                <button
                  onClick={handleApprove}
                  disabled={statusPengajuan === "disetujui" || statusPengajuan === "ditolak"}
                  className="ui-btn ui-btn-primary"
                >
                  Setujui
                </button>
                <button
                  onClick={handleReject}
                  disabled={statusPengajuan === "disetujui" || statusPengajuan === "ditolak"}
                  className="ui-btn ui-btn-secondary"
                >
                  Tolak
                </button>
                <span className="info-note">
                  Setelah Anda setujui, pengajuan diteruskan ke HRD.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Riwayat Status & Rekan Tim Cuti (Wireframe 3) */}
        <div className="right-panel-col">
          {/* Riwayat Status */}
          <div className="ui-card mb-4">
            <h4 className="side-card-title">Riwayat status</h4>
            <div className="status-flow-list">
              <div className="flow-step done">
                <div className="circle-dot"></div>
                <div>
                  <p className="step-label">Diajukan oleh Andi Wijaya</p>
                  <p className="step-time">13 Okt 2026, 09.12</p>
                </div>
              </div>

              <div className={`flow-step ${statusPengajuan !== "diajukan" ? "done" : "active"}`}>
                <div className="circle-dot"></div>
                <div>
                  <p className="step-label">
                    {statusPengajuan === "diajukan"
                      ? "Menunggu Atasan (Maya Anggraini)"
                      : "Disetujui oleh Maya Anggraini"}
                  </p>
                </div>
              </div>

              <div className={`flow-step ${statusPengajuan === "disetujui" ? "done" : ""}`}>
                <div className="circle-dot"></div>
                <div>
                  <p className="step-label">
                    {statusPengajuan === "disetujui"
                      ? "Disetujui oleh HRD (Rina Kusumawardani)"
                      : "Menunggu HRD"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tim Penjualan yang Cuti di Sekitar Tanggal Ini */}
          <div className="ui-card">
            <h4 className="side-card-title">Tim Penjualan yang cuti di sekitar tanggal ini</h4>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>NAMA</th>
                    <th>TANGGAL</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold">Yoga Permana</td>
                    <td>19 Okt 2026 sampai 20 Okt 2026</td>
                    <td><span className="status-pill disetujui">Disetujui</span></td>
                  </tr>
                  <tr>
                    <td className="font-bold">Putri Lestari</td>
                    <td>9 Nov 2026 sampai 11 Nov 2026</td>
                    <td><span className="status-pill diajukan">Disetujui atasan</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Aturan Bisnis di Bawah Sesuai Wireframe 3 */}
      <div className="footer-rules-banner">
        Aturan: Anda hanya bisa memutuskan pengajuan anggota divisi Penjualan pada tahap 1. Pengajuan Anda sendiri diputuskan langsung oleh HRD. Data gaji anggota tidak ditampilkan untuk Atasan.
      </div>

      <style jsx>{`
        .breadcrumb-box {
          margin-bottom: -0.25rem;
        }

        .breadcrumb-sub {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.2rem;
        }

        .title-main {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }

        .subtitle-date {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.15rem;
        }

        .alert-box-success {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.625rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .alert-box-error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          margin-bottom: 0.625rem;
        }

        .approval-wireframe-grid {
          display: grid;
          grid-template-columns: 1.6fr 1.2fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .approval-wireframe-grid {
            grid-template-columns: 1fr;
          }
        }

        .info-two-col {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 1.125rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 1.25rem;
        }

        .full-col {
          grid-column: span 2;
        }

        .caption-lbl {
          font-size: 0.6875rem;
          color: #6b7280;
          display: block;
        }

        .val-text {
          font-size: 0.8125rem;
          color: #111827;
          margin-top: 0.15rem;
        }

        .font-bold {
          font-weight: 700;
        }

        .font-medium {
          font-weight: 500;
        }

        .text-blue {
          color: #2563eb;
        }

        .decision-section {
          margin-top: 1.25rem;
        }

        .decision-label {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.625rem;
        }

        .reason-input-line {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          margin-bottom: 0.75rem;
        }

        .decision-btn-row {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .info-note {
          font-size: 0.75rem;
          color: #6b7280;
          margin-left: 0.5rem;
        }

        .side-card-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.875rem;
        }

        .mb-4 {
          margin-bottom: 1.25rem;
        }

        .status-flow-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-left: 0.25rem;
        }

        .flow-step {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .circle-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #cbd5e1;
          margin-top: 0.35rem;
          flex-shrink: 0;
        }

        .flow-step.done .circle-dot {
          background-color: #2563eb;
        }

        .flow-step.active .circle-dot {
          border: 2px solid #2563eb;
          background-color: #ffffff;
        }

        .step-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #111827;
        }

        .step-time {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .footer-rules-banner {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          font-size: 0.75rem;
          color: #4b5563;
          line-height: 1.4;
        }
      `}</style>
    </AppLayout>
  );
}
