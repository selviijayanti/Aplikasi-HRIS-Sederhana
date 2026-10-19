"use client";

import React, { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { formatRupiah } from "@/lib/utils/time";
import slipGajiData from "../../../data/seeds/slip_gaji.json";
import profilesData from "../../../data/seeds/profiles.json";

export default function SlipGajiPage() {
  const { user } = useAuth();
  const [selectedPeriode, setSelectedPeriode] = useState("2026-09");
  const [selectedSlipDetail, setSelectedSlipDetail] = useState<any | null>(null);

  // Buat lookup profile
  const profileMap = useMemo(() => {
    const map = new Map<string, { nik: string; nama: string; divisi: string; jabatan: string }>();
    (profilesData as Array<any>).forEach((p) => {
      map.set(p.id, {
        nik: p.nik_karyawan,
        nama: p.nama_lengkap,
        divisi: p["divisi (bantu)"] || "Operasional",
        jabatan: p.jabatan || "Staff",
      });
    });
    return map;
  }, []);

  // Filter slip gaji berdasarkan peran pengguna (PRD BR-11: Karyawan hanya melihat miliknya yang sudah terbit; HRD melihat semua)
  const slips = useMemo(() => {
    let list = slipGajiData as Array<any>;

    if (user?.peran !== "hrd") {
      // Karyawan & Atasan hanya melihat slip miliknya sendiri yang sudah 'terbit'
      list = list.filter((s) => s.karyawan_id === user?.id && s.status === "terbit");
    } else {
      // HRD dapat memfilter berdasarkan periode
      list = list.filter((s) => s.periode === selectedPeriode);
    }

    return list.map((s) => {
      const p = profileMap.get(s.karyawan_id);
      return {
        ...s,
        nik: p?.nik || "KLN-0000",
        nama: s["nama (bantu)"] || p?.nama || user?.nama_lengkap,
        divisi: p?.divisi || user?.divisi_nama,
        jabatan: p?.jabatan || user?.jabatan,
      };
    });
  }, [user, selectedPeriode, profileMap]);

  return (
    <AppLayout>
      <div className="header-row">
        <div>
          <h2 className="page-title">Slip Gaji</h2>
          <p className="page-sub">
            {user?.peran === "hrd"
              ? "Kelola, buat draf, dan terbitkan slip gaji karyawan per periode."
              : "Daftar slip gaji resmi yang telah diterbitkan perusahaan untuk Anda."}
          </p>
        </div>
      </div>

      {/* Filter Periode (Khusus HRD) */}
      {user?.peran === "hrd" && (
        <div className="filter-card">
          <div className="filter-control">
            <label className="filter-lbl">Periode Gaji:</label>
            <select
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
              className="filter-select"
            >
              <option value="2026-09">September 2026 (Terbit)</option>
              <option value="2026-08">Agustus 2026 (Terbit)</option>
              <option value="2026-10">Oktober 2026 (Draf)</option>
            </select>
          </div>
          <span className="privacy-badge">
            🔒 Rahasia: Hanya dapat dilihat oleh HRD dan Karyawan bersangkutan.
          </span>
        </div>
      )}

      {/* Tabel Slip Gaji */}
      <div className="ui-card">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>NOMOR SLIP</th>
                {user?.peran === "hrd" && <th>KARYAWAN</th>}
                <th>PERIODE</th>
                <th>GAJI POKOK</th>
                <th>TUNJANGAN</th>
                <th>POTONGAN</th>
                <th>TOTAL DITERIMA</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono">{item.nomor_slip || "-"}</td>
                  {user?.peran === "hrd" && (
                    <td>
                      <div className="font-semibold">{item.nama}</div>
                      <div className="sub-text">{item.nik} · {item.divisi}</div>
                    </td>
                  )}
                  <td>{item.periode}</td>
                  <td>{formatRupiah(item.gaji_pokok)}</td>
                  <td>{formatRupiah(item.tunjangan)}</td>
                  <td className="text-danger">-{formatRupiah(item.potongan)}</td>
                  <td className="font-bold">{formatRupiah(item.total_diterima)}</td>
                  <td>
                    <span className={`status-pill ${item.status}`}>
                      {item.status === "terbit" ? "Terbit" : "Draf"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedSlipDetail(item)}
                      className="ui-btn ui-btn-secondary btn-sm"
                    >
                      Lihat Slip
                    </button>
                  </td>
                </tr>
              ))}
              {slips.length === 0 && (
                <tr>
                  <td colSpan={user?.peran === "hrd" ? 9 : 8} className="empty-state">
                    Belum ada slip gaji yang terbit untuk akun ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tampilan Cetak Slip Gaji (Sesuai PRD Bab 7) */}
      {selectedSlipDetail && (
        <div className="modal-backdrop">
          <div className="modal-box slip-printable">
            <div className="slip-top-header">
              <div>
                <h3 className="company-name">PT KARSA LINTAS NUSANTARA</h3>
                <p className="company-address">Kawasan Industri & Pergudangan, Bekasi, Jawa Barat</p>
              </div>
              <div className="slip-number-box">
                <span className="caption">SLIP GAJI RESMI</span>
                <p className="slip-num">{selectedSlipDetail.nomor_slip || "DRAF-BELUM-TERBIT"}</p>
              </div>
            </div>

            <hr className="divider" />

            <div className="slip-info-grid">
              <div>
                <span className="caption">Nama Karyawan</span>
                <p className="val font-semibold">{selectedSlipDetail.nama}</p>
              </div>
              <div>
                <span className="caption">Periode Penggajian</span>
                <p className="val font-semibold">{selectedSlipDetail.periode}</p>
              </div>
              <div>
                <span className="caption">NIK / Divisi</span>
                <p className="val">{selectedSlipDetail.nik} · {selectedSlipDetail.divisi}</p>
              </div>
              <div>
                <span className="caption">Jabatan</span>
                <p className="val">{selectedSlipDetail.jabatan}</p>
              </div>
            </div>

            <div className="salary-calc-box">
              <div className="calc-row">
                <span>Gaji Pokok</span>
                <span className="font-semibold">{formatRupiah(selectedSlipDetail.gaji_pokok)}</span>
              </div>
              <div className="calc-row">
                <span>Tunjangan</span>
                <span className="font-semibold">{formatRupiah(selectedSlipDetail.tunjangan)}</span>
              </div>
              <div className="calc-row text-danger">
                <span>Potongan (BPJS / Pajak / Keterlambatan)</span>
                <span className="font-semibold">-{formatRupiah(selectedSlipDetail.potongan)}</span>
              </div>
              <div className="calc-total-row">
                <span>TOTAL DITERIMA (TAKE HOME PAY)</span>
                <span className="total-amount">{formatRupiah(selectedSlipDetail.total_diterima)}</span>
              </div>
            </div>

            <p className="legal-note">
              Dokumen ini dihasilkan secara otomatis oleh sistem KarsaHR dan bersifat rahasia (Privileged & Confidential).
            </p>

            <div className="modal-actions">
              <button
                onClick={() => setSelectedSlipDetail(null)}
                className="ui-btn ui-btn-secondary"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="ui-btn ui-btn-primary"
              >
                Cetak / Unduh PDF
              </button>
            </div>
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
        }

        .privacy-badge {
          font-size: 0.75rem;
          color: #4b5563;
          background-color: #f3f4f6;
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
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

        .sub-text {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .text-danger {
          color: #dc2626;
        }

        .btn-sm {
          font-size: 0.75rem;
          padding: 0.25rem 0.65rem;
        }

        .empty-state {
          text-align: center;
          padding: 2.5rem !important;
          color: #9ca3af;
        }

        /* Modal Slip Styling */
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

        .slip-printable {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          width: 100%;
          max-width: 580px;
          padding: 2rem;
        }

        .slip-top-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .company-name {
          font-size: 1rem;
          font-weight: 800;
          color: #111827;
        }

        .company-address {
          font-size: 0.6875rem;
          color: #6b7280;
          margin-top: 0.15rem;
        }

        .slip-number-box {
          text-align: right;
        }

        .caption {
          font-size: 0.625rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
        }

        .slip-num {
          font-size: 0.8125rem;
          font-family: monospace;
          font-weight: 700;
          color: #2563eb;
        }

        .divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1.25rem 0;
        }

        .slip-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.875rem;
          margin-bottom: 1.25rem;
        }

        .val {
          font-size: 0.8125rem;
          color: #111827;
        }

        .salary-calc-box {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .calc-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
          color: #374151;
        }

        .calc-total-row {
          display: flex;
          justify-content: space-between;
          border-top: 2px dashed #cbd5e1;
          padding-top: 0.75rem;
          margin-top: 0.25rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
        }

        .total-amount {
          color: #2563eb;
          font-size: 1.125rem;
        }

        .legal-note {
          font-size: 0.6875rem;
          color: #9ca3af;
          text-align: center;
          margin-top: 1.25rem;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 1.5rem;
        }
      `}</style>
    </AppLayout>
  );
}
