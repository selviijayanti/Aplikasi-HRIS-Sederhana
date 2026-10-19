"use client";

import React, { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import profilesData from "../../../data/seeds/profiles.json";
import divisiData from "../../../data/seeds/divisi.json";

export default function KaryawanPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivisi, setFilterDivisi] = useState("Semua");
  const [karyawanList, setKaryawanList] = useState<any[]>(profilesData as any[]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDivisi, setNewDivisi] = useState("Operasional Gudang");
  const [newJabatan, setNewJabatan] = useState("");
  const [newStatusKerja, setNewStatusKerja] = useState<"tetap" | "kontrak">("tetap");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter daftar karyawan
  const filteredList = useMemo(() => {
    return karyawanList.filter((k) => {
      // Jika peran Atasan, hanya bisa melihat anggota divisinya sendiri (PRD Bab 7)
      if (user?.peran === "atasan" && k.divisi_id !== user.divisi_id) {
        return false;
      }
      if (filterDivisi !== "Semua" && k["divisi (bantu)"] !== filterDivisi) {
        return false;
      }
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        return (
          k.nama_lengkap.toLowerCase().includes(q) ||
          k.nik_karyawan.toLowerCase().includes(q) ||
          k.jabatan.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [karyawanList, user, filterDivisi, searchTerm]);

  // Aksi HRD: Nonaktifkan / Aktifkan Karyawan (PRD BR-01)
  const handleToggleAktif = (id: string, nama: string, currentStatus: boolean) => {
    if (id === user?.id) {
      alert("HRD tidak boleh mengubah peran atau menonaktifkan akunnya sendiri (Aturan BR-01).");
      return;
    }

    setKaryawanList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, aktif: !currentStatus } : k))
    );
    setActionSuccess(`Status akun ${nama} berhasil diubah menjadi ${!currentStatus ? "Aktif" : "Nonaktif"}.`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleAddKaryawan = (e: React.FormEvent) => {
    e.preventDefault();
    const nextNik = `KLN-00${karyawanList.length + 1}`;
    const newRecord = {
      id: "usr-" + Date.now(),
      nik_karyawan: nextNik,
      nama_lengkap: newNama,
      email: newEmail,
      peran: "karyawan",
      divisi_id: "div-001",
      "divisi (bantu)": newDivisi,
      jabatan: newJabatan,
      status_kerja: newStatusKerja,
      tanggal_masuk: "2026-10-15",
      aktif: true,
    };

    setKaryawanList([...karyawanList, newRecord]);
    setShowAddModal(false);
    setActionSuccess(`Karyawan baru ${newNama} (${nextNik}) berhasil ditambahkan oleh HRD.`);
    setNewNama("");
    setNewEmail("");
    setNewJabatan("");
  };

  return (
    <AppLayout>
      <div className="header-row">
        <div>
          <h2 className="page-title">Data Karyawan</h2>
          <p className="page-sub">
            {user?.peran === "atasan"
              ? `Daftar anggota di divisi Anda (${user.divisi_nama || ""}). Data gaji dirahasiakan.`
              : "Kelola data kepegawaian, peran, divisi, dan status aktif akun (Khusus HRD)."}
          </p>
        </div>

        {user?.peran === "hrd" && (
          <button
            onClick={() => setShowAddModal(true)}
            className="ui-btn ui-btn-primary"
          >
            + Tambah Karyawan
          </button>
        )}
      </div>

      {actionSuccess && <div className="alert-success">{actionSuccess}</div>}

      {/* Filter & Pencarian Sesuai PRD Bab 7 */}
      <div className="filter-card">
        <div className="search-wrap">
          <input
            type="text"
            placeholder="Cari nama, NIK, atau jabatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {user?.peran === "hrd" && (
          <div className="filter-control">
            <label className="filter-lbl">Divisi:</label>
            <select
              value={filterDivisi}
              onChange={(e) => setFilterDivisi(e.target.value)}
              className="filter-select"
            >
              <option value="Semua">Semua Divisi</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Operasional Gudang">Operasional Gudang</option>
              <option value="Penjualan">Penjualan</option>
              <option value="Keuangan">Keuangan</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabel Data Karyawan (Tanpa Kolom Gaji sesuai PRD Bab 7 & BR-11) */}
      <div className="ui-card">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>NIK</th>
                <th>NAMA LENGKAP</th>
                <th>DIVISI</th>
                <th>JABATAN</th>
                <th>STATUS KERJA</th>
                <th>TANGGAL MASUK</th>
                <th>STATUS AKUN</th>
                {user?.peran === "hrd" && <th>AKSI</th>}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((k) => (
                <tr key={k.id}>
                  <td className="font-mono">{k.nik_karyawan}</td>
                  <td>
                    <div className="font-semibold">{k.nama_lengkap}</div>
                    <div className="sub-text">{k.email}</div>
                  </td>
                  <td>{k["divisi (bantu)"] || "Divisi"}</td>
                  <td>{k.jabatan}</td>
                  <td>
                    <span className="badge-text">{k.status_kerja.toUpperCase()}</span>
                  </td>
                  <td>{k.tanggal_masuk}</td>
                  <td>
                    <span className={`status-pill ${k.aktif ? "hadir" : "terlambat"}`}>
                      {k.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  {user?.peran === "hrd" && (
                    <td>
                      <button
                        onClick={() => handleToggleAktif(k.id, k.nama_lengkap, k.aktif)}
                        disabled={k.id === user.id}
                        className="ui-btn-cancel"
                        title={k.id === user.id ? "Tidak boleh menonaktifkan akun sendiri" : ""}
                      >
                        {k.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Karyawan Baru (Khusus HRD - BR-01) */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 className="modal-title">Tambah Karyawan Baru</h3>
            <p className="modal-sub">
              Sesuai Aturan BR-01, akun karyawan baru hanya dapat dibuat oleh HRD.
            </p>

            <form onSubmit={handleAddKaryawan} className="modal-form">
              <div className="form-item">
                <label className="lbl">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Contoh: Rian Pratama"
                  className="inp-text"
                />
              </div>

              <div className="form-item">
                <label className="lbl">Email Resmi Perusahaan</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="rian.pratama@karsalintas.test"
                  className="inp-text"
                />
              </div>

              <div className="form-row">
                <div className="form-item">
                  <label className="lbl">Divisi</label>
                  <select
                    value={newDivisi}
                    onChange={(e) => setNewDivisi(e.target.value)}
                    className="inp-select"
                  >
                    <option value="Operasional Gudang">Operasional Gudang</option>
                    <option value="Penjualan">Penjualan</option>
                    <option value="Keuangan">Keuangan</option>
                    <option value="Human Resources">Human Resources</option>
                  </select>
                </div>

                <div className="form-item">
                  <label className="lbl">Jabatan</label>
                  <input
                    type="text"
                    required
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    placeholder="Contoh: Staf Gudang"
                    className="inp-text"
                  />
                </div>
              </div>

              <div className="form-item">
                <label className="lbl">Status Kepegawaian</label>
                <select
                  value={newStatusKerja}
                  onChange={(e) => setNewStatusKerja(e.target.value as "tetap" | "kontrak")}
                  className="inp-select"
                >
                  <option value="tetap">Pegawai Tetap</option>
                  <option value="kontrak">Pegawai Kontrak</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Simpan Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
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

        .search-wrap {
          flex: 1;
          max-width: 320px;
        }

        .search-input {
          width: 100%;
          font-size: 0.8125rem;
          padding: 0.35rem 0.6rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
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

        .font-mono {
          font-family: monospace;
          font-size: 0.75rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .sub-text {
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .badge-text {
          font-size: 0.6875rem;
          color: #4b5563;
          font-weight: 600;
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

        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
        }

        .modal-sub {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.15rem;
          margin-bottom: 1.25rem;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
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

        .inp-text, .inp-select {
          font-size: 0.8125rem;
          padding: 0.45rem 0.625rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
      `}</style>
    </AppLayout>
  );
}
