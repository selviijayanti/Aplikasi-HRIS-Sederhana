"use client";

import React, { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { calculateWorkingDays } from "@/lib/utils/time";
import hariLiburData from "../../../data/seeds/hari_libur.json";
import pengajuanCutiData from "../../../data/seeds/pengajuan_cuti.json";

export default function CutiPage() {
  const { user } = useAuth();

  // State Formulir Pengajuan
  const [jenis, setJenis] = useState<"cuti_tahunan" | "sakit" | "izin">("cuti_tahunan");
  const [tanggalMulai, setTanggalMulai] = useState("2026-10-26");
  const [tanggalSelesai, setTanggalSelesai] = useState("2026-10-28");
  const [alasan, setAlasan] = useState("");
  const [fileSurat, setFileSurat] = useState<File | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Set Hari Libur
  const holidaySet = useMemo(() => {
    return new Set(
      (hariLiburData as Array<{ tanggal: string }>).map((h) => h.tanggal)
    );
  }, []);

  // Hitung Hari Kerja (PRD BR-05: tanpa sabtu, minggu, dan hari libur)
  const hitungHariKerja = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return 0;
    return calculateWorkingDays(tanggalMulai, tanggalSelesai, holidaySet);
  }, [tanggalMulai, tanggalSelesai, holidaySet]);

  // Daftar pengajuan milik pengguna
  const [daftarPengajuan, setDaftarPengajuan] = useState([
    {
      id: "cuti-001",
      jenis: "Cuti tahunan",
      tanggal_mulai: "26 Okt 2026",
      tanggal_selesai: "28 Okt 2026",
      jumlah_hari: 3,
      status: "diajukan",
      alasan: "Pulang kampung ke Yogyakarta",
    },
    {
      id: "cuti-002",
      jenis: "Cuti tahunan",
      tanggal_mulai: "21 Sep 2026",
      tanggal_selesai: "22 Sep 2026",
      jumlah_hari: 2,
      status: "disetujui",
      alasan: "Keperluan keluarga",
    },
    {
      id: "cuti-003",
      jenis: "Cuti tahunan",
      tanggal_mulai: "24 Mar 2026",
      tanggal_selesai: "25 Mar 2026",
      jumlah_hari: 2,
      status: "disetujui",
      alasan: "Istirahat tahunan",
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validasi BR-05: Minimal 1 hari kerja
    if (hitungHariKerja < 1) {
      setFormError("Rentang tanggal tidak berisi hari kerja (hanya sabtu/minggu/hari libur).");
      return;
    }

    // Validasi BR-08: Sakit > 1 hari wajib surat dokter
    if (jenis === "sakit" && hitungHariKerja > 1 && !fileSurat) {
      setFormError("Pengajuan sakit lebih dari 1 hari kerja wajib melampirkan surat dokter.");
      return;
    }

    // Validasi BR-08: Izin maks 2 hari kerja
    if (jenis === "izin" && hitungHariKerja > 2) {
      setFormError("Pengajuan izin paling banyak 2 hari kerja per pengajuan (Aturan BR-08).");
      return;
    }

    // Validasi kuota (Sisa kuota 5 hari)
    if (jenis === "cuti_tahunan" && hitungHariKerja > 5) {
      setFormError("Jumlah hari cuti melebihi sisa kuota Anda (tersedia 5 hari).");
      return;
    }

    const labelJenis = jenis === "cuti_tahunan" ? "Cuti tahunan" : jenis === "sakit" ? "Sakit" : "Izin";

    const baru = {
      id: "cuti-" + Date.now(),
      jenis: labelJenis,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      jumlah_hari: hitungHariKerja,
      status: "diajukan",
      alasan: alasan,
    };

    setDaftarPengajuan([baru, ...daftarPengajuan]);
    setFormSuccess(`Pengajuan ${labelJenis} (${hitungHariKerja} hari kerja) berhasil dikirim dan menunggu persetujuan.`);
    setAlasan("");
    setFileSurat(null);
  };

  const handleCancel = (id: string) => {
    setDaftarPengajuan((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "dibatalkan" } : item))
    );
    setFormSuccess("Pengajuan berhasil dibatalkan. Kuota cuti dikembalikan.");
  };

  return (
    <AppLayout>
      <div className="cuti-header">
        <h2 className="page-title">Cuti dan Izin</h2>
        <p className="page-sub">Kelola permohonan cuti tahunan, sakit, dan izin Anda.</p>
      </div>

      {formSuccess && <div className="alert-success">{formSuccess}</div>}

      <div className="cuti-grid">
        {/* Formulir Pengajuan (PRD Bab 7) */}
        <div className="ui-card">
          <h3 className="section-title">Formulir Pengajuan Baru</h3>

          {formError && <div className="alert-error">{formError}</div>}

          <form onSubmit={handleSubmit} className="cuti-form">
            <div className="form-item">
              <label className="lbl">Jenis Pengajuan</label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value as "cuti_tahunan" | "sakit" | "izin")}
                className="inp-select"
              >
                <option value="cuti_tahunan">Cuti Tahunan (Mengurangi Kuota)</option>
                <option value="sakit">Sakit</option>
                <option value="izin">Izin (Maks. 2 hari kerja)</option>
              </select>
            </div>

            <div className="date-row">
              <div className="form-item">
                <label className="lbl">Tanggal Mulai</label>
                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="inp-text"
                  required
                />
              </div>

              <div className="form-item">
                <label className="lbl">Tanggal Selesai</label>
                <input
                  type="date"
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className="inp-text"
                  required
                />
              </div>
            </div>

            {/* Info Hari Kerja Dihitung Otomatis */}
            <div className="calculation-badge">
              <span>Hari Kerja Dihitung: <strong>{hitungHariKerja} hari kerja</strong> (Sabtu, Minggu & Hari Libur tidak dihitung)</span>
            </div>

            <div className="form-item">
              <label className="lbl">Alasan Pengajuan</label>
              <textarea
                rows={3}
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Tuliskan alasan pengajuan secara jelas..."
                className="inp-textarea"
                required
              />
            </div>

            {jenis === "sakit" && (
              <div className="form-item">
                <label className="lbl">
                  Lampiran Surat Dokter {hitungHariKerja > 1 && <span className="req-star">*Wajib untuk sakit &gt; 1 hari</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={(e) => setFileSurat(e.target.files?.[0] || null)}
                  className="inp-file"
                />
              </div>
            )}

            <button type="submit" className="ui-btn ui-btn-primary submit-btn">
              Kirim Pengajuan
            </button>
          </form>
        </div>

        {/* Kuota & Riwayat Pengajuan Saya */}
        <div className="right-col-cuti">
          {/* Card Kuota */}
          <div className="ui-card mb-4">
            <span className="caption">Sisa Kuota Cuti Tahunan 2026</span>
            <div className="quota-row">
              <span className="big-quota">5</span>
              <span className="quota-desc">dari 12 hari kerja</span>
            </div>
            <p className="quota-note">7 hari sudah dipakai atau sedang diajukan.</p>
          </div>

          {/* Tabel Riwayat Pengajuan */}
          <div className="ui-card">
            <h3 className="section-title">Riwayat Pengajuan Saya</h3>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>JENIS</th>
                    <th>RENTANG</th>
                    <th>HARI</th>
                    <th>STATUS</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarPengajuan.map((item) => (
                    <tr key={item.id}>
                      <td className="font-semibold">{item.jenis}</td>
                      <td>{item.tanggal_mulai} s/d {item.tanggal_selesai}</td>
                      <td>{item.jumlah_hari} hari</td>
                      <td>
                        <span className={`status-pill ${item.status}`}>
                          {item.status === "diajukan" ? "Diajukan" : item.status === "disetujui" ? "Disetujui" : item.status === "dibatalkan" ? "Dibatalkan" : "Ditolak"}
                        </span>
                      </td>
                      <td>
                        {item.status === "diajukan" && (
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="ui-btn-cancel"
                          >
                            Batalkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cuti-header {
          margin-bottom: -0.25rem;
        }

        .page-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .page-sub {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.1rem;
        }

        .alert-success {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.625rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .alert-error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          margin-bottom: 1rem;
        }

        .cuti-grid {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .cuti-grid {
            grid-template-columns: 1fr;
          }
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 1rem;
        }

        .cuti-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .date-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .lbl {
          font-size: 0.75rem;
          font-weight: 600;
          color: #374151;
        }

        .req-star {
          color: #ef4444;
          font-weight: 400;
        }

        .inp-select, .inp-text, .inp-textarea, .inp-file {
          font-size: 0.8125rem;
          padding: 0.45rem 0.625rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
        }

        .calculation-badge {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
        }

        .submit-btn {
          width: 100%;
          padding: 0.625rem;
          margin-top: 0.5rem;
        }

        .mb-4 {
          margin-bottom: 1.25rem;
        }

        .caption {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          display: block;
        }

        .quota-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin: 0.35rem 0 0.2rem 0;
        }

        .big-quota {
          font-size: 1.75rem;
          font-weight: 700;
          color: #111827;
        }

        .quota-desc {
          font-size: 0.8125rem;
          color: #4b5563;
        }

        .quota-note {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .font-semibold {
          font-weight: 600;
        }
      `}</style>
    </AppLayout>
  );
}
