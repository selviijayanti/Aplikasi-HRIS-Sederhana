"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";

interface ApprovalItem {
  id: string;
  nama: string;
  nik: string;
  divisi: string;
  jabatan: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  alasan: string;
  status: "diajukan" | "disetujui_atasan" | "disetujui" | "ditolak";
  kuota_jatah: number;
  kuota_terpakai: number;
  kuota_sisa: number;
  lampiran: string;
  status_kerja: string;
  dibuat_pada: string;
}

export default function PersetujuanPage() {
  const { user } = useAuth();

  // Daftar antrean pengajuan menunggu
  const [queue, setQueue] = useState<ApprovalItem[]>([
    {
      id: "appr-01",
      nama: "Andi Wijaya",
      nik: "KLN-0009",
      divisi: "Penjualan",
      jabatan: "Sales Executive",
      jenis: "Cuti tahunan",
      tanggal_mulai: "Senin, 26 Okt 2026",
      tanggal_selesai: "Rabu, 28 Okt 2026",
      jumlah_hari: 3,
      alasan: "Pulang kampung ke Yogyakarta",
      status: "diajukan",
      kuota_jatah: 12,
      kuota_terpakai: 7,
      kuota_sisa: 5,
      lampiran: "Tidak ada",
      status_kerja: "Tetap, masuk 1 Jun 2021",
      dibuat_pada: "13 Okt 2026 pukul 09.12",
    },
    {
      id: "appr-02",
      nama: "Putri Lestari",
      nik: "KLN-0012",
      divisi: "Penjualan",
      jabatan: "Sales Representative",
      jenis: "Cuti tahunan",
      tanggal_mulai: "Senin, 9 Nov 2026",
      tanggal_selesai: "Rabu, 11 Nov 2026",
      jumlah_hari: 3,
      alasan: "Keperluan keluarga di Bandung",
      status: "disetujui_atasan",
      kuota_jatah: 12,
      kuota_terpakai: 12,
      kuota_sisa: 0,
      lampiran: "Tidak ada",
      status_kerja: "Tetap, masuk 1 Agu 2021",
      dibuat_pada: "12 Okt 2026 pukul 14.20",
    },
    {
      id: "appr-03",
      nama: "Larasati Dewi",
      nik: "KLN-0010",
      divisi: "Keuangan",
      jabatan: "Staff Keuangan",
      jenis: "Sakit",
      tanggal_mulai: "Rabu, 14 Okt 2026",
      tanggal_selesai: "Kamis, 15 Okt 2026",
      jumlah_hari: 2,
      alasan: "Demam dan flu berat",
      status: "diajukan",
      kuota_jatah: 12,
      kuota_terpakai: 4,
      kuota_sisa: 8,
      lampiran: "surat_dokter_larasati.pdf (1.2 MB)",
      status_kerja: "Tetap, masuk 10 Jan 2022",
      dibuat_pada: "14 Okt 2026 pukul 08.05",
    },
  ]);

  const [selectedId, setSelectedId] = useState<string>("appr-01");
  const selected = queue.find((q) => q.id === selectedId) || queue[0];

  const [alasanPenolakan, setAlasanPenolakan] = useState("");
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  const handleApprove = () => {
    setAlertError(null);
    const isAtasan = user?.peran === "atasan";
    const nextStatus = isAtasan ? "disetujui_atasan" : "disetujui";

    setQueue((prev) =>
      prev.map((item) => (item.id === selected.id ? { ...item, status: nextStatus } : item))
    );

    setAlertSuccess(
      isAtasan
        ? `Pengajuan ${selected.nama} berhasil disetujui (Tahap 1). Diteruskan ke HRD.`
        : `Pengajuan ${selected.nama} resmi disetujui HRD (Keputusan Akhir).`
    );
    setTimeout(() => setAlertSuccess(null), 4000);
  };

  const handleReject = () => {
    setAlertError(null);
    if (alasanPenolakan.trim().length < 10) {
      setAlertError("Alasan penolakan wajib minimal 10 karakter sesuai Aturan Bisnis BR-09.");
      return;
    }

    setQueue((prev) =>
      prev.map((item) => (item.id === selected.id ? { ...item, status: "ditolak" } : item))
    );
    setAlertSuccess(`Pengajuan ${selected.nama} telah ditolak. Kuota cuti otomatis dikembalikan.`);
    setAlasanPenolakan("");
    setTimeout(() => setAlertSuccess(null), 4000);
  };

  return (
    <AppLayout>
      {/* Header & Antrean Singkat */}
      <div className="breadcrumb-area">
        <span className="breadcrumb-text">Persetujuan / Detail pengajuan</span>
        <div className="title-row">
          <h2 className="leave-title">
            {selected.jenis}: {selected.nama}
          </h2>
          <span className={`status-pill ${selected.status}`}>
            {selected.status === "diajukan"
              ? "Diajukan"
              : selected.status === "disetujui_atasan"
              ? "Disetujui atasan"
              : selected.status === "disetujui"
              ? "Disetujui"
              : "Ditolak"}
          </span>
        </div>
        <p className="subtitle-info">
          Diajukan {selected.dibuat_pada} ·{" "}
          {selected.status === "disetujui_atasan"
            ? "Tahap 2 dari 2 (Menunggu Keputusan Akhir HRD)"
            : "Tahap 1 dari 2 (Atasan divisi, lalu HRD)"}
        </p>
      </div>

      {alertSuccess && <div className="alert-box-success">{alertSuccess}</div>}

      {/* Antrean Pengajuan Selector Tabs */}
      <div className="queue-selector-card">
        <span className="queue-title">Antrean Pengajuan Menunggu:</span>
        <div className="queue-tabs">
          {queue.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setAlertError(null);
              }}
              className={`queue-btn ${selectedId === item.id ? "active" : ""}`}
            >
              <span className="btn-name">{item.nama}</span>
              <span className="btn-type">({item.jenis})</span>
              <span className={`queue-badge ${item.status}`}>
                {item.status === "diajukan" ? "Tahap 1" : item.status === "disetujui_atasan" ? "Tahap HRD" : item.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid 2 Kolom Sesuai Wireframe 3 */}
      <div className="approval-main-grid">
        {/* Kolom Kiri: Rincian Pengajuan & Keputusan */}
        <div className="left-column">
          <div className="ui-card">
            <div className="info-grid">
              <div>
                <span className="caption">Pemohon</span>
                <p className="val font-semibold">{selected.nama} · {selected.nik} · {selected.jabatan}</p>
              </div>

              <div>
                <span className="caption">Kuota cuti pemohon 2026</span>
                <p className="val">
                  Jatah {selected.kuota_jatah} · terpakai {selected.kuota_terpakai} ·{" "}
                  <span className="font-semibold text-blue">sisa {selected.kuota_sisa}</span>
                </p>
              </div>

              <div>
                <span className="caption">Tanggal</span>
                <p className="val">{selected.tanggal_mulai} sampai {selected.tanggal_selesai}</p>
              </div>

              <div>
                <span className="caption">Lampiran</span>
                <p className="val">{selected.lampiran}</p>
              </div>

              <div>
                <span className="caption">Lama</span>
                <p className="val font-semibold">{selected.jumlah_hari} hari kerja</p>
              </div>

              <div>
                <span className="caption">Status kerja</span>
                <p className="val">{selected.status_kerja}</p>
              </div>

              <div className="full-width">
                <span className="caption">Alasan</span>
                <p className="val">{selected.alasan}</p>
              </div>
            </div>

            {/* Form Keputusan Anda */}
            {(selected.status === "diajukan" || (selected.status === "disetujui_atasan" && user?.peran === "hrd")) && (
              <div className="decision-box">
                <h4 className="decision-heading">Keputusan Anda</h4>

                {alertError && <div className="alert-box-error">{alertError}</div>}

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
                      : "Keputusan akhir HRD akan memotong kuota dan mengunci status pengajuan."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Riwayat Status & Rekan Tim */}
        <div className="right-column">
          {/* Riwayat Status */}
          <div className="ui-card mb-4">
            <h4 className="section-title">Riwayat status</h4>
            <div className="timeline-flow">
              <div className="timeline-item done">
                <div className="dot"></div>
                <div>
                  <p className="tl-title">Diajukan oleh {selected.nama}</p>
                  <p className="tl-time">{selected.dibuat_pada}</p>
                </div>
              </div>

              <div className={`timeline-item ${selected.status !== "diajukan" ? "done" : "active"}`}>
                <div className="dot"></div>
                <div>
                  <p className="tl-title">
                    {selected.status === "diajukan"
                      ? "Menunggu Atasan (Maya Anggraini)"
                      : "Disetujui Atasan (Tahap 1)"}
                  </p>
                </div>
              </div>

              <div className={`timeline-item ${selected.status === "disetujui" ? "done" : ""}`}>
                <div className="dot"></div>
                <div>
                  <p className="tl-title">
                    {selected.status === "disetujui"
                      ? "Disetujui HRD (Rina Kusumawardani)"
                      : "Menunggu HRD"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tim yang Cuti di Sekitar Tanggal Ini */}
          <div className="ui-card">
            <h4 className="section-title">Tim {selected.divisi} yang cuti di sekitar tanggal ini</h4>
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

      {/* Banner Aturan Bisnis Wireframe 3 */}
      <div className="rules-banner">
        Aturan: Anda hanya bisa memutuskan pengajuan anggota divisi {selected.divisi} pada tahap 1. Pengajuan Anda sendiri diputuskan langsung oleh HRD. Data gaji anggota tidak ditampilkan untuk Atasan.
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

        .queue-selector-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.625rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.875rem;
          flex-wrap: wrap;
        }

        .queue-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #4b5563;
        }

        .queue-tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .queue-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          background-color: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          font-family: inherit;
        }

        .queue-btn.active {
          background-color: #dbeafe;
          border-color: #2563eb;
          color: #1d4ed8;
          font-weight: 600;
        }

        .btn-name {
          font-weight: 600;
        }

        .btn-type {
          color: #6b7280;
        }

        .queue-badge {
          font-size: 0.625rem;
          padding: 0.05rem 0.35rem;
          border-radius: 4px;
          background: #e5e7eb;
          color: #374151;
        }

        .queue-badge.diajukan {
          background: #fef3c7;
          color: #92400e;
        }

        .queue-badge.disetujui_atasan {
          background: #dbeafe;
          color: #1e40af;
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
