"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import hariLiburData from "../../../data/seeds/hari_libur.json";
import auditLogData from "../../../data/seeds/audit_log.json";
import divisiData from "../../../data/seeds/divisi.json";
import kuotaCutiData from "../../../data/seeds/kuota_cuti.json";

export default function PengaturanPage() {
  const [activeTab, setActiveTab] = useState<"divisi" | "libur" | "kuota" | "audit">("divisi");
  const [filterAksi, setFilterAksi] = useState("Semua");
  const [kuotaList, setKuotaList] = useState<any[]>(kuotaCutiData as any[]);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const handleUpdateJatah = (id: string, nama: string, currentJatah: number) => {
    const input = prompt(`Masukkan jatah cuti baru untuk ${nama} (0 sampai 12 hari):`, String(currentJatah));
    if (input === null) return;
    const num = parseInt(input, 10);
    if (isNaN(num) || num < 0 || num > 12) {
      alert("Jatah cuti harus berupa angka bulat antara 0 sampai 12 hari (Aturan BR-04).");
      return;
    }

    setKuotaList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, jatah_hari: num } : k))
    );
    setEditSuccess(`Jatah cuti tahunan ${nama} berhasil diubah menjadi ${num} hari.`);
    setTimeout(() => setEditSuccess(null), 3000);
  };

  const filteredAudit = (auditLogData as Array<any>).filter((log) => {
    if (filterAksi !== "Semua" && !log.aksi.toLowerCase().includes(filterAksi.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="header-row">
        <div>
          <h2 className="page-title">Pengaturan Sistem (HRD)</h2>
          <p className="page-sub">
            Kelola divisi &amp; atasan, kalender hari libur, jatah kuota cuti tahunan, dan audit log (Aturan BR-01, BR-04, BR-12).
          </p>
        </div>
      </div>

      {editSuccess && <div className="alert-success">{editSuccess}</div>}

      {/* Tabs Navigasi Pengaturan Sesuai PRD Bab 7 */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab("divisi")}
          className={`tab-btn ${activeTab === "divisi" ? "active" : ""}`}
        >
          Divisi &amp; Atasan
        </button>
        <button
          onClick={() => setActiveTab("libur")}
          className={`tab-btn ${activeTab === "libur" ? "active" : ""}`}
        >
          Daftar Hari Libur (17 Hari)
        </button>
        <button
          onClick={() => setActiveTab("kuota")}
          className={`tab-btn ${activeTab === "kuota" ? "active" : ""}`}
        >
          Jatah Kuota Cuti Karyawan
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
        >
          Audit Log Aktivitas
        </button>
      </div>

      {/* Tab 1: Divisi & Atasan (PRD BR-01) */}
      {activeTab === "divisi" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Struktur Divisi &amp; Manajer Atasan</h3>
            <span className="caption-tag">
              Aturan BR-01: Setiap divisi dipimpin paling banyak satu Atasan, dan satu Atasan hanya memimpin satu divisi.
            </span>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>NAMA DIVISI</th>
                  <th>MANAJER (ATASAN)</th>
                  <th>STATUS PEMIMPIN</th>
                </tr>
              </thead>
              <tbody>
                {(divisiData as Array<any>).map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.nama}</td>
                    <td>
                      <span className="text-dark font-medium">{d["manajer (bantu)"] || "-"}</span>
                    </td>
                    <td>
                      <span className="status-pill hadir">
                        {d["manajer (bantu)"] ? "Dipimpin 1 Atasan" : "Belum Ada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Hari Libur */}
      {activeTab === "libur" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Hari Libur Perusahaan &amp; Nasional (Tahun 2026)</h3>
            <span className="caption-tag">Digunakan otomatis untuk kalkulasi hari kerja pengajuan cuti (BR-05)</span>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>TANGGAL</th>
                  <th>KETERANGAN HARI LIBUR</th>
                  <th>JENIS LIBUR</th>
                </tr>
              </thead>
              <tbody>
                {(hariLiburData as Array<any>).map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{item.tanggal}</td>
                    <td className="font-semibold">{item.keterangan}</td>
                    <td>
                      <span className="status-pill diajukan">
                        {item.jenis === "nasional" ? "Nasional" : item.jenis === "cuti_bersama" ? "Cuti Bersama" : "Perusahaan"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Jatah Kuota Cuti Karyawan (PRD BR-04) */}
      {activeTab === "kuota" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Jatah Cuti Tahunan Karyawan (Tahun 2026)</h3>
            <span className="caption-tag">
              Aturan BR-04: Ditetapkan HRD per karyawan paling banyak 12 hari kerja per tahun kalender.
            </span>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>NAMA KARYAWAN</th>
                  <th>TAHUN</th>
                  <th>JATAH HARI</th>
                  <th>TERPAKAI / DIAJUKAN</th>
                  <th>SISA KUOTA</th>
                  <th>CATATAN KASUS</th>
                  <th>AKSI HRD</th>
                </tr>
              </thead>
              <tbody>
                {kuotaList.map((k) => {
                  const sisa = k.jatah_hari - k.terpakai_hari;
                  return (
                    <tr key={k.id}>
                      <td className="font-semibold">{k["nama (bantu)"]}</td>
                      <td>{k.tahun}</td>
                      <td className="font-bold">{k.jatah_hari} hari</td>
                      <td>{k.terpakai_hari} hari</td>
                      <td>
                        <span className={`status-pill ${sisa > 0 ? "hadir" : "terlambat"}`}>
                          {sisa} hari
                        </span>
                      </td>
                      <td>
                        <span className="case-note">{k["kasus_uji (bantu)"] || "-"}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleUpdateJatah(k.id, k["nama (bantu)"], k.jatah_hari)}
                          className="ui-btn-cancel"
                        >
                          Ubah Jatah
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Log (BR-12) */}
      {activeTab === "audit" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Audit Log Aktivitas Sistem</h3>
            <div className="filter-audit">
              <label className="lbl-mini">Filter Aksi:</label>
              <select
                value={filterAksi}
                onChange={(e) => setFilterAksi(e.target.value)}
                className="select-mini"
              >
                <option value="Semua">Semua Aksi</option>
                <option value="buat">Pembuatan Data</option>
                <option value="ubah">Perubahan Status / Data</option>
                <option value="koreksi">Koreksi Absensi</option>
                <option value="terbit">Penerbitan Slip</option>
              </select>
            </div>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>WAKTU (WIB)</th>
                  <th>PELAKU</th>
                  <th>AKSI</th>
                  <th>TABEL TERKAIT</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((log, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{log.dibuat_pada?.replace("T", " ")?.slice(0, 19) || "-"}</td>
                    <td className="font-semibold">{log["pelaku (bantu)"] || "HRD / Sistem"}</td>
                    <td>
                      <span className="badge-aksi">{log.aksi}</span>
                    </td>
                    <td><span className="font-mono text-muted">{log.nama_tabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .header-row {
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

        .tabs-container {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 0.4rem 0.875rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          border-radius: 6px;
          font-family: inherit;
        }

        .tab-btn.active {
          background-color: #dbeafe;
          color: #2563eb;
        }

        .tab-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
        }

        .caption-tag {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .font-mono {
          font-family: monospace;
          font-size: 0.75rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .font-bold {
          font-weight: 700;
          color: #111827;
        }

        .text-dark {
          color: #111827;
        }

        .text-muted {
          color: #6b7280;
        }

        .case-note {
          font-size: 0.6875rem;
          color: #6b7280;
          font-style: italic;
        }

        .badge-aksi {
          background-color: #f3f4f6;
          color: #374151;
          font-size: 0.6875rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-weight: 600;
        }

        .filter-audit {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .lbl-mini {
          font-size: 0.75rem;
          color: #4b5563;
          font-weight: 600;
        }

        .select-mini {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: #ffffff;
        }
      `}</style>
    </AppLayout>
  );
}
