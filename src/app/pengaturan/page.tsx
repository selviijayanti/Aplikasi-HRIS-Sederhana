"use client";

import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import hariLiburData from "../../../data/seeds/hari_libur.json";
import auditLogData from "../../../data/seeds/audit_log.json";

export default function PengaturanPage() {
  const [activeTab, setActiveTab] = useState<"libur" | "audit">("libur");

  return (
    <AppLayout>
      <div className="header-row">
        <div>
          <h2 className="page-title">Pengaturan Sistem (HRD)</h2>
          <p className="page-sub">
            Kelola kalender hari libur operasional dan pantau audit log aktivitas sistem (Aturan BR-12).
          </p>
        </div>
      </div>

      {/* Tabs Navigasi Pengaturan */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab("libur")}
          className={`tab-btn ${activeTab === "libur" ? "active" : ""}`}
        >
          Daftar Hari Libur (17 Hari)
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
        >
          Audit Log Aktivitas
        </button>
      </div>

      {/* Tab 1: Hari Libur */}
      {activeTab === "libur" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Hari Libur Perusahaan & Nasional (Tahun 2026)</h3>
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

      {/* Tab 2: Audit Log (BR-12) */}
      {activeTab === "audit" && (
        <div className="ui-card">
          <div className="tab-header">
            <h3 className="section-title">Audit Log Sistem</h3>
            <span className="caption-tag">Catatan permanen dan tidak dapat diubah/dihapus (Aturan BR-12)</span>
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
                {(auditLogData as Array<any>).map((log, idx) => (
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

        .tabs-container {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
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

        .text-muted {
          color: #6b7280;
        }

        .badge-aksi {
          background-color: #f3f4f6;
          color: #374151;
          font-size: 0.6875rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-weight: 600;
        }
      `}</style>
    </AppLayout>
  );
}
