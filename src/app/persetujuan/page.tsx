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
      setAlertSuccess("Pengajuan berhasil disetujui (Tahap 1). Diteruskan ke HRD untuk keputusan akhir.");
    } else {
      setStatusPengajuan("disetujui");
      setAlertSuccess("Pengajuan resmi disetujui HRD (Keputusan Akhir). Kuota cuti pemohon telah terpotong.");
    }
  };

  const handleReject = () => {
    setAlertError(null);
    if (alasanPenolakan.trim().length < 10) {
      setAlertError("Alasan penolakan wajib minimal 10 karakter sesuai Aturan Bisnis BR-09.");
      return;
    }
    setStatusPengajuan("ditolak");
    setAlertSuccess("Pengajuan telah ditolak. Kuota cuti tahunan otomatis dikembalikan ke pemohon.");
  };

  return (
    <AppLayout>
      {/* Breadcrumb & Header Sesuai Wireframe 3 */}
      <div className="breadcrumb-area">
        <span className="breadcrumb-text">Persetujuan / Detail pengajuan</span>
        <div className="title-row">
          <h2 className="leave-title">Cuti tahunan: Andi Wijaya</h2>
          <span className={`status-pill ${statusPengajuan}`}>
            {statusPengajuan === "diajukan" ? "Diajukan" : statusPengajuan === "disetujui_atasan" ? "Disetujui atasan" : statusPengajuan === "disetujui" ? "Disetujui" : "Ditolak"}
          </span>
        </div>
        <p className="subtitle-info">
          Diajukan 13 Okt 2026 pukul 09.12 · {statusPengajuan === "disetujui_atasan" ? "Tahap 2 dari 2 (Menunggu HRD)" : "Tahap 1 dari 2 (Atasan, lalu HRD)"}
        </p>
      </div>

      {alertSuccess && (
        <div className="alert-box-success">
          {alertSuccess}
        </div>
      )}

      {/* Grid 2 Kolom Sesuai Wireframe 3 */}
      <div className="approval-main-grid">
        {/* Kolom Kiri: Rincian Pengajuan & Keputusan */}
        <div className="left-column">
          <div className="ui-card">
            <div className="info-grid">
              <div>
                <span className="caption">Pemohon</span>
                <p className="val font-semibold">Andi Wijaya · KLN-0009 · Sales Executive</p>
              </div>

              <div>
                <span className="caption">Kuota cuti pemohon 2026</span>
                <p className="val">
                  Jatah 12 · terpakai 7 (termasuk pengajuan ini) · <span className="font-semibold text-blue">sisa 5</span>
                </p>
              </div>

              <div>
                <span className="caption">Tanggal</span>
                <p className="val">Senin, 26 Okt 2026 sampai Rabu, 28 Okt 2026</p>
              </div>

              <div>
                <span className="caption">Lampiran</span>
                <p className="val">Tidak ada</p>
              </div>

              <div>
                <span className="caption">Lama</span>
                <p className="val font-semibold">3 hari kerja</p>
              </div>

              <div>
                <span className="caption">Status kerja</span>
                <p className="val">Tetap, masuk 1 Jun 2021</p>
              </div>

              <div className="full-width">
                <span className="caption">Alasan</span>
                <p className="val">Pulang kampung ke Yogyakarta</p>
              </div>
            </div>

            {/* Form Keputusan Anda */}
            {statusPengajuan === "diajukan" && (
              <div className="decision-box">
                <h4 className="decision-heading">Keputusan Anda</h4>

                {alertError && (
                  <div className="alert-box-error">
                    {alertError}
                  </div>
                )}

                <textarea
                  rows={2}
                  value={alasanPenolakan}
                  onChange={(e) => setAlasanPenolakan(e.target.value)}
                  placeholder="Alasan penolakan (wajib minimal 10 karakter bila menolak)"
                  className="rejection-input"
                />

                <div className="action-row">
                  <button onClick={handleApprove} className="ui-btn ui-btn-primary">
                    Setujui
                  </button>
                  <button onClick={handleReject} className="ui-btn ui-btn-secondary">
                    Tolak
                  </button>
                  <span className="action-note">
                    {user?.peran === "atasan"
                      ? "Setelah Anda setujui, pengajuan diteruskan ke HRD."
                      : "Keputusan final HRD akan mengunci status pengajuan."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Riwayat Status & Rekan Tim yang Cuti */}
        <div className="right-column">
          {/* Riwayat Status */}
          <div className="ui-card mb-4">
            <h4 className="section-title">Riwayat status</h4>
            <div className="timeline-flow">
              <div className="timeline-item done">
                <div className="dot"></div>
                <div>
                  <p className="tl-title">Diajukan oleh Andi Wijaya</p>
                  <p className="tl-time">13 Okt 2026, 09.12</p>
                </div>
              </div>

              <div className={`timeline-item ${statusPengajuan !== "diajukan" ? "done" : "active"}`}>
                <div className="dot"></div>
                <div>
                  <p className="tl-title">
                    {statusPengajuan === "diajukan"
                      ? "Menunggu Atasan (Maya Anggraini)"
                      : "Disetujui oleh Maya Anggraini (Tahap 1)"}
                  </p>
                </div>
              </div>

              <div className={`timeline-item ${statusPengajuan === "disetujui" ? "done" : ""}`}>
                <div className="dot"></div>
                <div>
                  <p className="tl-title">
                    {statusPengajuan === "disetujui" ? "Disetujui HRD (Rina Kusumawardani)" : "Menunggu HRD"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tim Penjualan yang Cuti di Sekitar Tanggal Ini */}
          <div className="ui-card">
            <h4 className="section-title">Tim Penjualan yang cuti di sekitar tanggal ini</h4>
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
                  <td className="font-semibold">Yoga Permana</td>
                  <td>19 Okt 2026 sampai 20 Okt 2026</td>
                  <td><span className="status-pill disetujui">Disetujui</span></td>
                </tr>
                <tr>
                  <td className="font-semibold">Putri Lestari</td>
                  <td>9 Nov 2026 sampai 11 Nov 2026</td>
                  <td><span className="status-pill diajukan">Disetujui atasan</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Banner Aturan Bisnis di Bagian Bawah Sesuai Wireframe 3 */}
      <div className="rules-banner">
        Aturan: Anda hanya bisa memutuskan pengajuan anggota divisi Penjualan pada tahap 1. Pengajuan Anda sendiri diputuskan langsung oleh HRD. Data gaji anggota tidak ditampilkan untuk Atasan.
      </div>

      <style jsx>{`
        .breadcrumb-area {
          margin-bottom: -0.25rem;
        }

        .breadcrumb-text {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .leave-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }

        .subtitle-info {
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
          margin-bottom: 0.75rem;
        }

        .approval-main-grid {
          display: grid;
          grid-template-columns: 1.6fr 1.2fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .approval-main-grid {
            grid-template-columns: 1fr;
          }
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 1.25rem;
        }

        .full-width {
          grid-column: span 2;
        }

        .caption {
          font-size: 0.6875rem;
          color: #6b7280;
          display: block;
        }

        .val {
          font-size: 0.8125rem;
          color: #111827;
          margin-top: 0.15rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .text-blue {
          color: #2563eb;
        }

        .decision-box {
          margin-top: 1.25rem;
        }

        .decision-heading {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.625rem;
        }

        .rejection-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          margin-bottom: 0.75rem;
        }

        .action-row {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .action-note {
          font-size: 0.75rem;
          color: #6b7280;
          margin-left: 0.5rem;
        }

        .section-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.875rem;
        }

        .mb-4 {
          margin-bottom: 1.25rem;
        }

        .timeline-flow {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-left: 0.5rem;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          position: relative;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #cbd5e1;
          margin-top: 0.25rem;
          flex-shrink: 0;
        }

        .timeline-item.done .dot {
          background-color: #2563eb;
        }

        .timeline-item.active .dot {
          border: 2px solid #2563eb;
          background-color: #ffffff;
        }

        .tl-title {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #111827;
        }

        .tl-time {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .rules-banner {
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
