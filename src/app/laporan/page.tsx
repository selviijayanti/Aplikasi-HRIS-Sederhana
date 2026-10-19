"use client";

import React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { formatRupiah } from "@/lib/utils/time";

export default function LaporanPage() {
  return (
    <AppLayout>
      {/* Header Laporan Sesuai Wireframe 4 */}
      <div className="laporan-header-row">
        <div>
          <h2 className="laporan-title">Laporan Kehadiran, Cuti, dan Gaji</h2>
          <p className="laporan-subtitle">
            Rentang 21 Sep sampai 15 Okt 2026 · Semua divisi · <button className="link-btn">Unduh CSV</button>
          </p>
        </div>
      </div>

      {/* 4 Kotak Metrik Ringkasan Eksekutif */}
      <div className="metrics-row">
        <div className="ui-card">
          <div className="metric-title">TEPAT WAKTU OKTOBER</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">93,5%</span>
          </div>
        </div>

        <div className="ui-card">
          <div className="metric-title">PENGAJUAN MENUNGGU</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">7</span>
          </div>
        </div>

        <div className="ui-card">
          <div className="metric-title">RATA-RATA SISA CUTI</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">5,4 <span className="metric-sublabel">hari</span></span>
          </div>
        </div>

        <div className="ui-card">
          <div className="metric-title">KARYAWAN AKTIF</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">15</span>
          </div>
        </div>
      </div>

      {/* Baris Grafik Dua Kolom Sesuai Wireframe 4 */}
      <div className="charts-grid">
        {/* Grafik 1: Kehadiran per Minggu */}
        <div className="ui-card">
          <h3 className="section-title">Kehadiran per minggu (orang-hari)</h3>
          
          <div className="chart-container">
            <div className="chart-bars-wrap">
              {/* Minggu 21 Sep */}
              <div className="bar-col">
                <div className="stacked-bar">
                  <div className="bar-segment terlambat" style={{ height: "14%" }} title="Terlambat: 11">11</div>
                  <div className="bar-segment tepat-waktu" style={{ height: "82%" }} title="Tepat waktu: 65">65</div>
                </div>
                <span className="bar-lbl">21 Sep</span>
              </div>

              {/* Minggu 28 Sep */}
              <div className="bar-col">
                <div className="stacked-bar">
                  <div className="bar-segment tepat-waktu" style={{ height: "92%" }} title="Tepat waktu: 73">73</div>
                </div>
                <span className="bar-lbl">28 Sep</span>
              </div>

              {/* Minggu 5 Okt */}
              <div className="bar-col">
                <div className="stacked-bar">
                  <div className="bar-segment terlambat" style={{ height: "7%" }} title="Terlambat: 5">5</div>
                  <div className="bar-segment tepat-waktu" style={{ height: "84%" }} title="Tepat waktu: 66">66</div>
                </div>
                <span className="bar-lbl">5 Okt</span>
              </div>

              {/* Minggu 12 Okt */}
              <div className="bar-col">
                <div className="stacked-bar">
                  <div className="bar-segment tepat-waktu" style={{ height: "65%" }} title="Tepat waktu: 51">51</div>
                </div>
                <span className="bar-lbl">12 Okt</span>
              </div>
            </div>

            {/* Legend */}
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-box tepat-waktu"></span> Hadir tepat waktu</span>
              <span className="legend-item"><span className="legend-box terlambat"></span> Terlambat</span>
              <span className="legend-item"><span className="legend-box cuti"></span> Cuti, sakit, izin</span>
              <span className="legend-item"><span className="legend-box alpa"></span> Tanpa keterangan</span>
            </div>
          </div>
        </div>

        {/* Grafik 2: Cuti Disetujui per Divisi */}
        <div className="ui-card">
          <h3 className="section-title">Hari cuti, sakit, izin disetujui per divisi</h3>

          <div className="chart-container">
            <div className="grouped-bars-wrap">
              {/* Operasional */}
              <div className="divisi-col">
                <div className="group-bars">
                  <div className="g-bar agustus" style={{ height: "70%" }} title="Agustus: 4">4</div>
                  <div className="g-bar september" style={{ height: "0%" }}></div>
                  <div className="g-bar oktober" style={{ height: "55%" }} title="Oktober: 3">3</div>
                </div>
                <span className="bar-lbl">Operasional</span>
              </div>

              {/* Penjualan */}
              <div className="divisi-col">
                <div className="group-bars">
                  <div className="g-bar agustus" style={{ height: "0%" }}></div>
                  <div className="g-bar september" style={{ height: "35%" }} title="September: 2">2</div>
                  <div className="g-bar oktober" style={{ height: "55%" }} title="Oktober: 3">3</div>
                </div>
                <span className="bar-lbl">Penjualan</span>
              </div>

              {/* Keuangan */}
              <div className="divisi-col">
                <div className="group-bars">
                  <div className="g-bar agustus" style={{ height: "0%" }}></div>
                  <div className="g-bar september" style={{ height: "35%" }} title="September: 2">2</div>
                  <div className="g-bar oktober" style={{ height: "18%" }} title="Oktober: 1">1</div>
                </div>
                <span className="bar-lbl">Keuangan</span>
              </div>

              {/* HR */}
              <div className="divisi-col">
                <div className="group-bars">
                  <div className="g-bar agustus" style={{ height: "0%" }}></div>
                  <div className="g-bar september" style={{ height: "0%" }}></div>
                  <div className="g-bar oktober" style={{ height: "0%" }}></div>
                </div>
                <span className="bar-lbl">Human Resources</span>
              </div>
            </div>

            <div className="chart-legend">
              <span className="legend-item"><span className="legend-box agustus"></span> Agustus</span>
              <span className="legend-item"><span className="legend-box september"></span> September</span>
              <span className="legend-item"><span className="legend-box oktober"></span> Oktober</span>
            </div>
          </div>
        </div>
      </div>

      {/* Baris Ketiga: Keterlambatan & Rekap Gaji Sesuai Wireframe 4 */}
      <div className="tables-two-col">
        {/* Tabel Keterlambatan */}
        <div className="ui-card">
          <h3 className="section-title">Paling sering terlambat (Oktober)</h3>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>NAMA</th>
                  <th>DIVISI</th>
                  <th>KALI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Rizky Ramadhan</td>
                  <td>Operasional Gudang</td>
                  <td className="font-semibold">4</td>
                </tr>
                <tr>
                  <td className="font-semibold">Yoga Permana</td>
                  <td>Penjualan</td>
                  <td className="font-semibold">3</td>
                </tr>
                <tr>
                  <td className="font-semibold">Andi Wijaya</td>
                  <td>Penjualan</td>
                  <td className="font-semibold">1</td>
                </tr>
                <tr>
                  <td className="font-semibold">Agus Salim</td>
                  <td>Operasional Gudang</td>
                  <td className="font-semibold">1</td>
                </tr>
                <tr>
                  <td className="font-semibold">Siti Nurhaliza</td>
                  <td>Operasional Gudang</td>
                  <td className="font-semibold">1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel Rekap Gaji */}
        <div className="ui-card">
          <h3 className="section-title">Rekap gaji September 2026 (slip terbit, khusus HRD)</h3>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>DIVISI</th>
                  <th>SLIP</th>
                  <th>POKOK + TUNJANGAN</th>
                  <th>POTONGAN</th>
                  <th>TOTAL DITERIMA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Operasional Gudang</td>
                  <td>6</td>
                  <td>Rp56.000.000</td>
                  <td>Rp1.948.000</td>
                  <td className="font-semibold">{formatRupiah(54052000)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Penjualan</td>
                  <td>5</td>
                  <td>Rp50.350.000</td>
                  <td>Rp2.190.000</td>
                  <td className="font-semibold">{formatRupiah(48160000)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Keuangan</td>
                  <td>3</td>
                  <td>Rp34.600.000</td>
                  <td>Rp1.212.000</td>
                  <td className="font-semibold">{formatRupiah(33388000)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Human Resources</td>
                  <td>2</td>
                  <td>Rp27.200.000</td>
                  <td>Rp952.000</td>
                  <td className="font-semibold">{formatRupiah(26248000)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .laporan-header-row {
          margin-bottom: -0.25rem;
        }

        .laporan-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .laporan-subtitle {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.1rem;
        }

        .link-btn {
          background: none;
          border: none;
          color: #2563eb;
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0;
          font-family: inherit;
        }

        .link-btn:hover {
          text-decoration: underline;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        .section-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 1.25rem;
        }

        .chart-container {
          display: flex;
          flex-direction: column;
          height: 220px;
          justify-content: space-between;
        }

        .chart-bars-wrap {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 160px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.25rem;
        }

        .bar-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          height: 100%;
          justify-content: flex-end;
        }

        .stacked-bar {
          width: 48px;
          display: flex;
          flex-direction: column-reverse;
          border-radius: 4px;
          overflow: hidden;
          background-color: #f3f4f6;
          height: 130px;
          justify-content: flex-start;
        }

        .bar-segment {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #ffffff;
        }

        .bar-segment.tepat-waktu {
          background-color: #2563eb;
        }

        .bar-segment.terlambat {
          background-color: #0f172a;
        }

        .bar-lbl {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .grouped-bars-wrap {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 160px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.25rem;
        }

        .divisi-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          height: 100%;
          justify-content: flex-end;
        }

        .group-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 130px;
        }

        .g-bar {
          width: 14px;
          border-radius: 2px 2px 0 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          font-size: 0.625rem;
          color: #374151;
          padding-top: 2px;
          font-weight: 600;
        }

        .g-bar.agustus {
          background-color: #cbd5e1;
        }

        .g-bar.september {
          background-color: #93c5fd;
        }

        .g-bar.oktober {
          background-color: #2563eb;
          color: #ffffff;
        }

        .chart-legend {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .legend-box {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }

        .legend-box.tepat-waktu {
          background-color: #2563eb;
        }

        .legend-box.terlambat {
          background-color: #0f172a;
        }

        .legend-box.cuti {
          background-color: #93c5fd;
        }

        .legend-box.alpa {
          background-color: #e5e7eb;
        }

        .legend-box.agustus {
          background-color: #cbd5e1;
        }

        .legend-box.september {
          background-color: #93c5fd;
        }

        .legend-box.oktober {
          background-color: #2563eb;
        }

        .tables-two-col {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .tables-two-col {
            grid-template-columns: 1fr;
          }
        }

        .font-semibold {
          font-weight: 600;
        }
      `}</style>
    </AppLayout>
  );
}
