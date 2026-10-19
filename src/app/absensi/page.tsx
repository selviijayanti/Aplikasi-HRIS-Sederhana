"use client";

import React, { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import absensiData from "../../../data/seeds/absensi.json";
import profilesData from "../../../data/seeds/profiles.json";
import divisiData from "../../../data/seeds/divisi.json";

interface AttendanceRow {
  id: string;
  nik_karyawan: string;
  nama: string;
  divisi: string;
  divisi_id: string;
  masuk: string;
  pulang: string;
  status: string;
  catatan?: string | null;
}

export default function AbsensiPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState("2026-10-08"); // Sesuai Wireframe 2: Kamis, 8 Okt 2026
  const [selectedDivisi, setSelectedDivisi] = useState("Semua");
  const [selectedStatus, setSelectedStatus] = useState("Semua");

  // State Modal Koreksi (BR-03: Hanya HRD, alasan minimal 10 karakter)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AttendanceRow | null>(null);
  const [koreksiStatus, setKoreksiStatus] = useState("hadir");
  const [koreksiMasuk, setKoreksiMasuk] = useState("");
  const [koreksiPulang, setKoreksiPulang] = useState("");
  const [alasanKoreksi, setAlasanKoreksi] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  // Buat lookup profile
  const profileMap = useMemo(() => {
    const map = new Map<string, { nik: string; nama: string; divisi: string; divisi_id: string }>();
    (profilesData as Array<{
      id: string;
      nik_karyawan: string;
      nama_lengkap: string;
      divisi_id: string;
      "divisi (bantu)"?: string;
    }>).forEach((p) => {
      map.set(p.id, {
        nik: p.nik_karyawan,
        nama: p.nama_lengkap,
        divisi: p["divisi (bantu)"] || "Operasional",
        divisi_id: p.divisi_id,
      });
    });
    return map;
  }, []);

  // Filter & bangun baris absensi
  const rows: AttendanceRow[] = useMemo(() => {
    // Ambil data absensi sesuai tanggal
    const list = (absensiData as Array<{
      id: string;
      karyawan_id: string;
      tanggal: string;
      jam_masuk?: string | null;
      jam_pulang?: string | null;
      status?: string | null;
      "nama (bantu)"?: string;
      "divisi (bantu)"?: string;
    }>).filter((a) => a.tanggal === selectedDate);

    let mapped: AttendanceRow[] = list.map((item) => {
      const p = profileMap.get(item.karyawan_id);
      return {
        id: item.id,
        nik_karyawan: p?.nik || "KLN-0000",
        nama: item["nama (bantu)"] || p?.nama || "Karyawan",
        divisi: item["divisi (bantu)"] || p?.divisi || "Divisi",
        divisi_id: p?.divisi_id || "",
        masuk: item.jam_masuk ? item.jam_masuk.slice(0, 5) : "-",
        pulang: item.jam_pulang ? item.jam_pulang.slice(0, 5) : "-",
        status: item.status || "hadir",
        catatan: !item.jam_pulang && item.jam_masuk ? "Belum check-out" : null,
      };
    });

    // Jika peran Atasan, batasi hanya divisi miliknya (PRD BR-01 & US-06)
    if (user?.peran === "atasan" && user.divisi_id) {
      mapped = mapped.filter((r) => r.divisi_id === user.divisi_id);
    } else if (selectedDivisi !== "Semua") {
      mapped = mapped.filter((r) => r.divisi === selectedDivisi);
    }

    if (selectedStatus !== "Semua") {
      mapped = mapped.filter((r) => r.status.toLowerCase() === selectedStatus.toLowerCase());
    }

    return mapped;
  }, [selectedDate, selectedDivisi, selectedStatus, profileMap, user]);

  // Hitung Metrik Atas (Sesuai Wireframe 2)
  const metrics = useMemo(() => {
    let tepatWaktu = 0;
    let terlambat = 0;
    let izinCuti = 0;
    let tanpaKeterangan = 0;

    rows.forEach((r) => {
      if (r.status === "hadir") tepatWaktu++;
      else if (r.status === "terlambat") terlambat++;
      else if (r.status === "sakit" || r.status === "izin" || r.status === "cuti") izinCuti++;
      else tanpaKeterangan++;
    });

    return { tepatWaktu, terlambat, izinCuti, tanpaKeterangan };
  }, [rows]);

  const handleOpenCorrection = (row: AttendanceRow) => {
    setSelectedRow(row);
    setKoreksiStatus(row.status);
    setKoreksiMasuk(row.masuk !== "-" ? row.masuk : "08:00");
    setKoreksiPulang(row.pulang !== "-" ? row.pulang : "17:00");
    setAlasanKoreksi("");
    setCorrectionError(null);
    setShowCorrectionModal(true);
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (alasanKoreksi.trim().length < 10) {
      setCorrectionError("Alasan koreksi wajib diisi minimal 10 karakter sesuai aturan BR-03.");
      return;
    }

    // Sukses koreksi
    setCorrectionSuccess(`Absensi ${selectedRow?.nama} berhasil diperbarui.`);
    setShowCorrectionModal(false);
    setTimeout(() => setCorrectionSuccess(null), 3000);
  };

  return (
    <AppLayout>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Absensi Harian</h2>
          <p className="page-sub">
            {user?.peran === "atasan" 
              ? `Anggota divisi ${user.divisi_nama || ""} · data dari server, zona WIB`
              : "Semua karyawan aktif · data dari server, zona WIB"}
          </p>
        </div>
      </div>

      {correctionSuccess && (
        <div className="alert-success">
          {correctionSuccess}
        </div>
      )}

      {/* Filter Bar Sesuai Wireframe 2 */}
      <div className="filter-card">
        <div className="filter-group-row">
          <div className="filter-control">
            <label className="filter-lbl">Tanggal:</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="filter-select"
            >
              <option value="2026-10-08">Kamis, 8 Okt 2026</option>
              <option value="2026-10-09">Jumat, 9 Okt 2026</option>
              <option value="2026-10-12">Senin, 12 Okt 2026</option>
              <option value="2026-10-13">Selasa, 13 Okt 2026</option>
              <option value="2026-10-14">Rabu, 14 Okt 2026</option>
              <option value="2026-10-15">Kamis, 15 Okt 2026</option>
            </select>
          </div>

          {user?.peran === "hrd" && (
            <div className="filter-control">
              <label className="filter-lbl">Divisi:</label>
              <select
                value={selectedDivisi}
                onChange={(e) => setSelectedDivisi(e.target.value)}
                className="filter-select"
              >
                <option value="Semua">Semua</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Operasional Gudang">Operasional Gudang</option>
                <option value="Penjualan">Penjualan</option>
                <option value="Keuangan">Keuangan</option>
              </select>
            </div>
          )}

          <div className="filter-control">
            <label className="filter-lbl">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select"
            >
              <option value="Semua">Semua</option>
              <option value="hadir">Hadir</option>
              <option value="terlambat">Terlambat</option>
              <option value="sakit">Sakit</option>
            </select>
          </div>
        </div>

        <button className="ui-btn ui-btn-secondary">
          Unduh CSV
        </button>
      </div>

      {/* 4 Kotak Metrik Sesuai Wireframe 2 */}
      <div className="attendance-metrics-grid">
        <div className="ui-card">
          <div className="metric-title">HADIR TEPAT WAKTU</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">{metrics.tepatWaktu}</span>
          </div>
        </div>

        <div className="ui-card">
          <div className="metric-title">TERLAMBAT</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">{metrics.terlambat}</span>
          </div>
        </div>

        <div className="ui-card">
          <div className="metric-title">CUTI, SAKIT, IZIN</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">{metrics.izinCuti}</span>
          </div>
        </div>

        <div className="ui-card">
          <div className="metric-title">TANPA KETERANGAN</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">{metrics.tanpaKeterangan}</span>
          </div>
        </div>
      </div>

      {/* Tabel Data Absensi Harian */}
      <div className="ui-card">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>NIK</th>
                <th>NAMA</th>
                <th>DIVISI</th>
                <th>MASUK</th>
                <th>PULANG</th>
                <th>STATUS</th>
                <th>CATATAN</th>
                {user?.peran === "hrd" && <th>AKSI</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono">{row.nik_karyawan}</td>
                  <td className="font-semibold">{row.nama}</td>
                  <td>{row.divisi}</td>
                  <td>{row.masuk}</td>
                  <td>{row.pulang}</td>
                  <td>
                    <span className={`status-pill ${row.status.toLowerCase()}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {row.catatan ? (
                      <span className="catatan-text">{row.catatan}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  {user?.peran === "hrd" && (
                    <td>
                      <button
                        onClick={() => handleOpenCorrection(row)}
                        className="ui-btn-cancel"
                      >
                        Koreksi
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Tidak ada data absensi untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Koreksi Absensi (Khusus HRD - BR-03) */}
      {showCorrectionModal && selectedRow && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 className="modal-title">Koreksi Absensi: {selectedRow.nama}</h3>
            <p className="modal-subtitle">
              {selectedRow.nik_karyawan} · {selectedRow.divisi} · Tanggal {selectedDate}
            </p>

            {correctionError && (
              <div className="modal-alert-error">
                {correctionError}
              </div>
            )}

            <form onSubmit={handleSaveCorrection} className="modal-form">
              <div className="form-row">
                <div className="form-item">
                  <label className="lbl">Status Kehadiran</label>
                  <select
                    value={koreksiStatus}
                    onChange={(e) => setKoreksiStatus(e.target.value)}
                    className="inp-select"
                  >
                    <option value="hadir">Hadir</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="sakit">Sakit</option>
                    <option value="izin">Izin</option>
                  </select>
                </div>

                <div className="form-item">
                  <label className="lbl">Jam Masuk (WIB)</label>
                  <input
                    type="time"
                    value={koreksiMasuk}
                    onChange={(e) => setKoreksiMasuk(e.target.value)}
                    className="inp-text"
                  />
                </div>

                <div className="form-item">
                  <label className="lbl">Jam Pulang (WIB)</label>
                  <input
                    type="time"
                    value={koreksiPulang}
                    onChange={(e) => setKoreksiPulang(e.target.value)}
                    className="inp-text"
                  />
                </div>
              </div>

              <div className="form-item">
                <label className="lbl">
                  Alasan Koreksi <span className="req-tag">(Wajib minimal 10 karakter - Aturan BR-03)</span>
                </label>
                <textarea
                  rows={3}
                  value={alasanKoreksi}
                  onChange={(e) => setAlasanKoreksi(e.target.value)}
                  placeholder="Contoh: Karyawan lupa check-in karena fingerprint error..."
                  className="inp-textarea"
                  required
                />
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Simpan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-header-row {
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
          padding: 0.5rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .filter-card {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .filter-group-row {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
        }

        .filter-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-lbl {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #374151;
        }

        .filter-select {
          font-size: 0.8125rem;
          padding: 0.35rem 0.6rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background-color: #ffffff;
          color: #111827;
          font-family: inherit;
        }

        .attendance-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        @media (max-width: 1024px) {
          .attendance-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .font-mono {
          font-family: monospace;
          font-size: 0.75rem;
          color: #4b5563;
        }

        .font-semibold {
          font-weight: 600;
        }

        .catatan-text {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .empty-row {
          text-align: center;
          padding: 2rem !important;
          color: #9ca3af;
        }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
        }

        .modal-box {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 520px;
          padding: 1.5rem;
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .modal-subtitle {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.15rem;
          margin-bottom: 1.25rem;
        }

        .modal-alert-error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.75rem;
        }

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .lbl {
          font-size: 0.75rem;
          font-weight: 600;
          color: #374151;
        }

        .req-tag {
          font-weight: 400;
          color: #ef4444;
        }

        .inp-select, .inp-text, .inp-textarea {
          font-size: 0.8125rem;
          padding: 0.45rem 0.625rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
        }

        .modal-btn-row {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
      `}</style>
    </AppLayout>
  );
}
