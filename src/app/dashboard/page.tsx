"use client";

import React, { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { formatRupiah, calculateWorkingDays } from "@/lib/utils/time";
import hariLiburData from "../../../data/seeds/hari_libur.json";

interface LeaveItem {
  id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  lama: string;
  jumlah_hari: number;
  status: "diajukan" | "disetujui" | "dibatalkan" | "ditolak";
}

interface AttendanceRow {
  tanggal: string;
  masuk: string;
  pulang: string;
  status: string;
}

export default function DashboardPage() {
  const { user } = useAuth();

  // Status Absensi Hari Ini Sesuai Wireframe 1
  const [hasCheckedIn, setHasCheckedIn] = useState(true);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState("07.39");
  const [checkOutTime, setCheckOutTime] = useState("-");

  // Kuota Cuti Karyawan (Wireframe 1: 5 dari 12 hari)
  const [jatahCuti] = useState(12);
  const [terpakaiCuti, setTerpakaiCuti] = useState(7);
  const sisaCuti = jatahCuti - terpakaiCuti;

  // Daftar Pengajuan Saya (Wireframe 1)
  const [pengajuanList, setPengajuanList] = useState<LeaveItem[]>([
    {
      id: "cuti-01",
      jenis: "Cuti tahunan",
      tanggal_mulai: "26 Okt 2026",
      tanggal_selesai: "28 Okt 2026",
      lama: "3 hari",
      jumlah_hari: 3,
      status: "diajukan",
    },
    {
      id: "cuti-02",
      jenis: "Cuti tahunan",
      tanggal_mulai: "21 Sep 2026",
      tanggal_selesai: "22 Sep 2026",
      lama: "2 hari",
      jumlah_hari: 2,
      status: "disetujui",
    },
    {
      id: "cuti-03",
      jenis: "Cuti tahunan",
      tanggal_mulai: "24 Mar 2026",
      tanggal_selesai: "25 Mar 2026",
      lama: "2 hari",
      jumlah_hari: 2,
      status: "disetujui",
    },
  ]);

  // Absensi 5 Hari Terakhir (Wireframe 1)
  const [absensiList, setAbsensiList] = useState<AttendanceRow[]>([
    { tanggal: "Kamis, 15 Okt 2026", masuk: "07.39", pulang: "-", status: "Hadir" },
    { tanggal: "Rabu, 14 Okt 2026", masuk: "07.22", pulang: "17.59", status: "Hadir" },
    { tanggal: "Selasa, 13 Okt 2026", masuk: "07.51", pulang: "17.39", status: "Hadir" },
    { tanggal: "Senin, 12 Okt 2026", masuk: "08.15", pulang: "17.49", status: "Hadir" },
    { tanggal: "Jumat, 9 Okt 2026", masuk: "07.20", pulang: "17.14", status: "Hadir" },
  ]);

  // Modal States
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Pengajuan Cuti / Izin State
  const [formJenis, setFormJenis] = useState<"cuti_tahunan" | "sakit" | "izin">("cuti_tahunan");
  const [formStart, setFormStart] = useState("2026-11-02");
  const [formEnd, setFormEnd] = useState("2026-11-03");
  const [formAlasan, setFormAlasan] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Set Hari Libur untuk kalkulasi hari kerja
  const holidaySet = useMemo(() => {
    return new Set((hariLiburData as Array<{ tanggal: string }>).map((h) => h.tanggal));
  }, []);

  const calculatedDays = useMemo(() => {
    if (!formStart || !formEnd) return 0;
    return calculateWorkingDays(formStart, formEnd, holidaySet);
  }, [formStart, formEnd, holidaySet]);

  // Aksi Check-in
  const handleCheckIn = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const jamNow = `${hh}.${mm}`;
    setCheckInTime(jamNow);
    setHasCheckedIn(true);

    // Update baris pertama di tabel absensi 5 hari
    setAbsensiList((prev) =>
      prev.map((row, idx) => (idx === 0 ? { ...row, masuk: jamNow } : row))
    );
    setToastMessage(`Check-in berhasil tercatat pada ${jamNow} WIB dari server.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Aksi Check-out
  const handleCheckOut = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const jamNow = `${hh}.${mm}`;
    setCheckOutTime(jamNow);
    setHasCheckedOut(true);

    setAbsensiList((prev) =>
      prev.map((row, idx) => (idx === 0 ? { ...row, pulang: jamNow } : row))
    );
    setToastMessage(`Check-out berhasil pada ${jamNow} WIB. Presensi hari ini lengkap.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Aksi Batalkan Pengajuan (PRD BR-06 & BR-10: Kuota cuti tahunan dikembalikan)
  const handleCancelLeave = (id: string) => {
    const item = pengajuanList.find((p) => p.id === id);
    if (!item) return;

    if (item.status !== "diajukan") {
      alert("Hanya pengajuan dengan status Diajukan atau Disetujui Atasan yang dapat dibatalkan.");
      return;
    }

    if (confirm(`Apakah Anda yakin ingin membatalkan pengajuan ${item.jenis} (${item.lama})? Kuota cuti Anda akan dikembalikan.`)) {
      setPengajuanList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "dibatalkan" } : p))
      );

      // Kembalikan kuota jika cuti tahunan
      if (item.jenis.toLowerCase().includes("cuti")) {
        setTerpakaiCuti((prev) => Math.max(0, prev - item.jumlah_hari));
      }

      setToastMessage("Pengajuan berhasil dibatalkan. Kuota cuti tahunan Anda telah dikembalikan.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Kirim Pengajuan Cuti Baru dari Modal Dashboard
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (calculatedDays < 1) {
      setFormError("Rentang tanggal tidak berisi hari kerja (hanya akhir pekan / hari libur).");
      return;
    }

    if (formJenis === "cuti_tahunan" && calculatedDays > sisaCuti) {
      setFormError(`Jumlah hari cuti (${calculatedDays} hari) melebihi sisa kuota Anda (${sisaCuti} hari).`);
      return;
    }

    if (formAlasan.trim().length < 5) {
      setFormError("Alasan pengajuan wajib diisi minimal 5 huruf.");
      return;
    }

    const labelJenis =
      formJenis === "cuti_tahunan" ? "Cuti tahunan" : formJenis === "sakit" ? "Sakit" : "Izin";

    const newItem: LeaveItem = {
      id: "cuti-" + Date.now(),
      jenis: labelJenis,
      tanggal_mulai: formStart,
      tanggal_selesai: formEnd,
      lama: `${calculatedDays} hari`,
      jumlah_hari: calculatedDays,
      status: "diajukan",
    };

    setPengajuanList([newItem, ...pengajuanList]);

    // Kurangi kuota jika cuti tahunan (PRD BR-06: Cuti tahunan langsung mengurangi sisa kuota saat diajukan)
    if (formJenis === "cuti_tahunan") {
      setTerpakaiCuti((prev) => prev + calculatedDays);
    }

    setShowLeaveModal(false);
    setFormAlasan("");
    setToastMessage(`Pengajuan ${labelJenis} (${calculatedDays} hari) berhasil diajukan dan sedang diproses.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <AppLayout>
      {toastMessage && <div className="toast-notification">{toastMessage}</div>}

      {/* 3 Kotak Metrik Ringkasan (Wireframe Halaman 1) */}
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
              ? `Sudah check-out pada pukul ${checkOutTime} WIB.`
              : "Check-out bisa dilakukan sampai pukul 23.59 WIB"}
          </p>
          <div className="metric-btn-row">
            <button
              onClick={handleCheckIn}
              disabled={hasCheckedIn}
              className={`ui-btn ${hasCheckedIn ? "ui-btn-disabled" : "ui-btn-primary"}`}
            >
              Check-in
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!hasCheckedIn || hasCheckedOut}
              className={`ui-btn ${!hasCheckedIn || hasCheckedOut ? "ui-btn-disabled" : "ui-btn-primary"}`}
            >
              {hasCheckedOut ? "Sudah Pulang" : "Check-out"}
            </button>
          </div>
        </div>

        {/* Card 2: Sisa Cuti Tahunan 2026 */}
        <div className="ui-card">
          <div className="metric-title">SISA CUTI TAHUNAN 2026</div>
          <div className="metric-highlight-row">
            <span className="metric-big-number">{sisaCuti}</span>
            <span className="metric-sublabel">dari {jatahCuti} hari</span>
          </div>
          <p className="metric-footnote">
            {terpakaiCuti} hari terpakai atau sedang diajukan
          </p>
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

      {/* Baris Kedua: Pengajuan Saya & Slip Gaji Terakhir (Wireframe 1) */}
      <div className="two-col-layout">
        {/* Kolom Kiri: Pengajuan Saya */}
        <div className="ui-card">
          <div className="card-top-action">
            <h3 className="section-heading">Pengajuan saya</h3>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="ui-btn ui-btn-primary"
            >
              + Ajukan cuti atau izin
            </button>
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
                {pengajuanList.map((item) => (
                  <tr key={item.id}>
                    <td>{item.jenis}</td>
                    <td>{item.tanggal_mulai} sampai {item.tanggal_selesai}</td>
                    <td>{item.lama}</td>
                    <td>
                      <span className={`status-pill ${item.status}`}>
                        {item.status === "diajukan"
                          ? "Diajukan"
                          : item.status === "disetujui"
                          ? "Disetujui"
                          : item.status === "dibatalkan"
                          ? "Dibatalkan"
                          : "Ditolak"}
                      </span>
                    </td>
                    <td>
                      {item.status === "diajukan" && (
                        <button
                          onClick={() => handleCancelLeave(item.id)}
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

        {/* Kolom Kanan: Slip Gaji Terakhir */}
        <div className="ui-card slip-card-flex">
          <div>
            <h3 className="section-heading">Slip gaji terakhir</h3>
            <div className="slip-meta-group">
              <span className="slip-caption">Periode</span>
              <p className="slip-period-val">September 2026 · SG-202609-007</p>
            </div>
            <div className="slip-meta-group">
              <span className="slip-caption">Total diterima</span>
              <p className="slip-salary-val">{formatRupiah(8112000)}</p>
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowSlipModal(true)}
              className="ui-btn ui-btn-secondary w-full"
            >
              Lihat dan unduh slip
            </button>
            <p className="slip-note-text">
              Slip hanya bisa dilihat oleh Anda dan HRD.
            </p>
          </div>
        </div>
      </div>

      {/* Baris Ketiga: Absensi 5 Hari Terakhir (Wireframe 1) */}
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
              {absensiList.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.tanggal}</td>
                  <td>{row.masuk}</td>
                  <td>{row.pulang}</td>
                  <td>
                    <span className="status-pill hadir">{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: FORMULIR PENGAJUAN CUTI / IZIN CEPAT (PRD BAB 7 & BR-05, BR-06) */}
      {showLeaveModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 className="modal-title">Pengajuan Cuti / Izin</h3>
            <p className="modal-sub">
              Sisa kuota cuti tahunan Anda: <strong>{sisaCuti} hari</strong>
            </p>

            {formError && <div className="alert-error-mini">{formError}</div>}

            <form onSubmit={handleSubmitLeave} className="modal-form">
              <div className="form-item">
                <label className="lbl">Jenis Pengajuan</label>
                <select
                  value={formJenis}
                  onChange={(e) => setFormJenis(e.target.value as any)}
                  className="inp-select"
                >
                  <option value="cuti_tahunan">Cuti Tahunan (Memotong Kuota)</option>
                  <option value="sakit">Sakit</option>
                  <option value="izin">Izin (Maks. 2 hari kerja)</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-item">
                  <label className="lbl">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="inp-text"
                  />
                </div>
                <div className="form-item">
                  <label className="lbl">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="inp-text"
                  />
                </div>
              </div>

              <div className="calc-pill">
                Durasi Dihitung: <strong>{calculatedDays} hari kerja</strong> (Sabtu, Minggu & Hari Libur tidak dihitung)
              </div>

              <div className="form-item">
                <label className="lbl">Alasan Pengajuan</label>
                <textarea
                  rows={2}
                  required
                  value={formAlasan}
                  onChange={(e) => setFormAlasan(e.target.value)}
                  placeholder="Contoh: Keperluan keluarga..."
                  className="inp-textarea"
                />
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRATINJAU SLIP GAJI RESMI (WIREFRAME 1 & PRD BR-11) */}
      {showSlipModal && (
        <div className="modal-backdrop">
          <div className="modal-box slip-printable-box">
            <div className="slip-head">
              <div>
                <h4 className="comp-name">PT KARSA LINTAS NUSANTARA</h4>
                <p className="comp-sub">Distribusi & Pergudangan, Bekasi, Jawa Barat</p>
              </div>
              <div className="slip-no-wrap">
                <span className="caption">NOMOR SLIP</span>
                <p className="font-mono font-bold text-blue">SG-202609-007</p>
              </div>
            </div>

            <hr className="divider" />

            <div className="slip-details">
              <div>
                <span className="caption">Nama Pemilik</span>
                <p className="val font-semibold">{user?.nama_lengkap}</p>
              </div>
              <div>
                <span className="caption">Periode</span>
                <p className="val">September 2026</p>
              </div>
              <div>
                <span className="caption">NIK / Divisi</span>
                <p className="val">{user?.nik_karyawan} · {user?.divisi_nama}</p>
              </div>
              <div>
                <span className="caption">Jabatan</span>
                <p className="val">{user?.jabatan}</p>
              </div>
            </div>

            <div className="slip-summary-table">
              <div className="sum-row">
                <span>Gaji Pokok</span>
                <span>{formatRupiah(7200000)}</span>
              </div>
              <div className="sum-row">
                <span>Tunjangan Operasional & Transport</span>
                <span>{formatRupiah(1200000)}</span>
              </div>
              <div className="sum-row text-danger">
                <span>Potongan Keterlambatan & Pajak</span>
                <span>-{formatRupiah(288000)}</span>
              </div>
              <div className="sum-total-row">
                <span>TOTAL DITERIMA (NETTO)</span>
                <span className="netto-text">{formatRupiah(8112000)}</span>
              </div>
            </div>

            <p className="confidential-text">
              🔒 Dokumen ini bersifat rahasia. Hanya dapat dilihat oleh Anda dan HRD.
            </p>

            <div className="modal-btn-row">
              <button
                onClick={() => setShowSlipModal(false)}
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
        .toast-notification {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 0.625rem 1rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

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
          max-width: 480px;
          padding: 1.5rem;
        }

        .slip-printable-box {
          max-width: 540px;
          padding: 1.75rem;
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .modal-sub {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.15rem;
          margin-bottom: 1rem;
        }

        .alert-error-mini {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          margin-bottom: 0.875rem;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
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

        .inp-select, .inp-text, .inp-textarea {
          font-size: 0.8125rem;
          padding: 0.45rem 0.625rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
        }

        .calc-pill {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 0.4rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
        }

        .modal-btn-row {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        /* Slip Modal Internals */
        .slip-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .comp-name {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #111827;
        }

        .comp-sub {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .slip-no-wrap {
          text-align: right;
        }

        .caption {
          font-size: 0.625rem;
          color: #6b7280;
          text-transform: uppercase;
          display: block;
        }

        .font-mono {
          font-family: monospace;
        }

        .font-bold {
          font-weight: 700;
        }

        .text-blue {
          color: #2563eb;
        }

        .divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1rem 0;
        }

        .slip-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .val {
          font-size: 0.8125rem;
          color: #111827;
        }

        .font-semibold {
          font-weight: 600;
        }

        .slip-summary-table {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sum-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
          color: #374151;
        }

        .text-danger {
          color: #dc2626;
        }

        .sum-total-row {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #cbd5e1;
          padding-top: 0.625rem;
          margin-top: 0.25rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
        }

        .netto-text {
          color: #2563eb;
          font-size: 1.125rem;
        }

        .confidential-text {
          font-size: 0.6875rem;
          color: #6b7280;
          text-align: center;
          margin-top: 1rem;
        }
      `}</style>
    </AppLayout>
  );
}
