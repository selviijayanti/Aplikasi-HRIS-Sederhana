"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth/auth-context";
import { exportToCSV } from "@/lib/utils/csv";
import {
  fetchAttendanceRecords,
  executeAttendanceCorrection,
  getProfilesMap,
  formatDivisionName,
  AttendanceRecord,
} from "@/lib/firebase/attendance-service";
import AttendanceCalendarView from "@/components/absensi/AttendanceCalendarView";
import { formatWIBDateString } from "@/lib/utils/time";
import "./absensi.css";

export interface AttendanceRow {
  id: string;
  nik_karyawan: string;
  nama: string;
  divisi: string;
  divisi_id: string;
  tanggal: string;
  masuk: string;
  pulang: string;
  raw_jam_masuk?: string | null;
  raw_jam_pulang?: string | null;
  status: string;
  dikoreksi_oleh?: string | null;
  alasan_koreksi?: string | null;
  catatan?: string | null;
}

/**
 * Format string waktu dari database ke format WIB (HH.mm)
 */
export function formatTimeWIB(timeStr: string | null | undefined): string {
  if (!timeStr || timeStr === "-" || timeStr === "null" || timeStr === "undefined") {
    return "-";
  }
  if (timeStr.includes("T")) {
    const afterT = timeStr.split("T")[1];
    if (afterT) {
      return afterT.slice(0, 5).replace(":", ".");
    }
  }
  if (timeStr.includes(":")) {
    const parts = timeStr.split(":");
    return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}`;
  }
  if (timeStr.includes(".")) {
    return timeStr.slice(0, 5);
  }
  return timeStr;
}

export default function AbsensiPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // Tab State:
  // - Karyawan: Terkunci pada "pribadi"
  // - Atasan: "tim" atau "pribadi"
  // - HRD: "perusahaan" atau "pribadi"
  const [activeTab, setActiveTab] = useState<"perusahaan" | "tim" | "pribadi">("pribadi");

  // Mode Tampilan: "table" (default) atau "calendar" (bulanan Google Calendar style)
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  // Filter Harian & Periode
  const [selectedDate, setSelectedDate] = useState(() => formatWIBDateString(new Date()));
  const [selectedMonth, setSelectedMonth] = useState("2026-10");
  const [selectedDivisi, setSelectedDivisi] = useState("Semua");
  const [selectedStatus, setSelectedStatus] = useState("Semua");

  // State Data Absensi
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // State Modal Koreksi (Khusus HRD - Sesuai Aturan BR-03)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AttendanceRow | null>(null);
  const [koreksiStatus, setKoreksiStatus] = useState<"hadir" | "terlambat">("hadir");
  const [koreksiMasuk, setKoreksiMasuk] = useState("08:00");
  const [koreksiPulang, setKoreksiPulang] = useState("17:00");
  const [alasanKoreksi, setAlasanKoreksi] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  // Multi-Select Baris (Khusus HRD / Atasan)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Tentukan default tab saat user dimuat
  useEffect(() => {
    if (user) {
      if (user.peran === "karyawan") {
        setActiveTab("pribadi");
      } else if (user.peran === "atasan") {
        setActiveTab("tim");
      } else if (user.peran === "hrd") {
        setActiveTab("perusahaan");
      }
    }
  }, [user]);

  // Master profiles map untuk pengkaitan NIK, Nama, dan Divisi
  const profileMap = useMemo(() => getProfilesMap(), []);

  // Fetch data dengan validasi RBAC backend / service
  const loadData = async () => {
    if (!user) return;
    setIsDataLoading(true);
    try {
      let scope: "personal" | "team" | "company" = "personal";
      if (user.peran === "karyawan") {
        scope = "personal";
      } else if (user.peran === "atasan") {
        scope = activeTab === "tim" ? "team" : "personal";
      } else if (user.peran === "hrd") {
        scope = activeTab === "perusahaan" ? "company" : "personal";
      }

      // Panggil query service yang memberlakukan proteksi RBAC ketat
      const records = await fetchAttendanceRecords(user, {
        viewScope: scope,
        date: selectedDate,
        month: selectedMonth,
        divisionId: selectedDivisi,
        status: scope === "team" ? "Semua" : selectedStatus,
      });

      setAttendanceData(records);
    } catch (err: any) {
      console.error("Gagal memuat absensi:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const execute = async () => {
      if (!user) return;
      setIsDataLoading(true);
      try {
        let scope: "personal" | "team" | "company" = "personal";
        if (user.peran === "karyawan") {
          scope = "personal";
        } else if (user.peran === "atasan") {
          scope = activeTab === "tim" ? "team" : "personal";
        } else if (user.peran === "hrd") {
          scope = activeTab === "perusahaan" ? "company" : "personal";
        }

        const records = await fetchAttendanceRecords(user, {
          viewScope: scope,
          date: selectedDate,
          month: selectedMonth,
          divisionId: selectedDivisi,
          status: scope === "team" ? "Semua" : selectedStatus,
        });

        if (!isCancelled) {
          setAttendanceData(records);
        }
      } catch (err: any) {
        if (!isCancelled) console.error("Gagal memuat absensi:", err);
      } finally {
        if (!isCancelled) setIsDataLoading(false);
      }
    };

    execute();

    return () => {
      isCancelled = true;
    };
  }, [user, activeTab, selectedDate, selectedMonth, selectedDivisi, selectedStatus]);

  // Transformasi data mentah ke baris tabel terstruktur dengan deduplikasi ketat
  const allTableRows: AttendanceRow[] = useMemo(() => {
    const rawRows = attendanceData.map((item) => {
      const p = profileMap.get(item.karyawan_id);
      const isBelumPulang = !item.jam_pulang && item.jam_masuk;

      const rawDiv = item["divisi (bantu)"] || p?.divisi;
      const displayDivisi = formatDivisionName(rawDiv, p?.divisi);

      return {
        id: item.id,
        nik_karyawan: item.nik_karyawan || p?.nik || "KLN-0000",
        nama: item["nama (bantu)"] || p?.nama || "Karyawan",
        divisi: displayDivisi,
        divisi_id: p?.divisi_id || "",
        tanggal: item.tanggal,
        masuk: formatTimeWIB(item.jam_masuk),
        pulang: formatTimeWIB(item.jam_pulang),
        raw_jam_masuk: item.jam_masuk,
        raw_jam_pulang: item.jam_pulang,
        status: item.status || "hadir",
        dikoreksi_oleh: item.dikoreksi_oleh || null,
        alasan_koreksi: item.alasan_koreksi || null,
        catatan: item.alasan_koreksi
          ? `Koreksi: ${item.alasan_koreksi}`
          : item.catatan
          ? item.catatan
          : isBelumPulang
          ? "Belum check-out"
          : "-",
      };
    });

    if (activeTab === "pribadi") {
      return rawRows.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
    }

    // Deduplikasi per karyawan: 1 karyawan tepat 1 baris untuk tab tim / perusahaan
    const dedupMap = new Map<string, AttendanceRow>();
    rawRows.forEach((row) => {
      const key = (row.nik_karyawan || row.nama).trim().toLowerCase();
      if (!dedupMap.has(key)) {
        dedupMap.set(key, row);
      }
    });

    return Array.from(dedupMap.values());
  }, [attendanceData, profileMap, activeTab]);

  // Hitung Metrik Ringkasan (Dari seluruh anggota tim divisi yang terdeduplikasi)
  const metrics = useMemo(() => {
    let tepatWaktu = 0;
    let terlambat = 0;
    let izinCuti = 0;
    let tanpaKeterangan = 0;

    allTableRows.forEach((r) => {
      const s = r.status.toLowerCase();
      if (s === "hadir") tepatWaktu++;
      else if (s === "terlambat") terlambat++;
      else if (s === "sakit" || s === "izin" || s === "cuti") izinCuti++;
      else if (s.includes("tanpa") || s.includes("belum") || s === "alpa") tanpaKeterangan++;
      else tanpaKeterangan++;
    });

    return { tepatWaktu, terlambat, izinCuti, tanpaKeterangan };
  }, [allTableRows]);

  // Baris tabel yang ditampilkan (memfilter berdasarkan selectedStatus pada tab Tim)
  const tableRows: AttendanceRow[] = useMemo(() => {
    if (activeTab !== "tim" || selectedStatus === "Semua") {
      return allTableRows;
    }
    const st = selectedStatus.toLowerCase();
    return allTableRows.filter((r) => {
      const rowStatus = r.status.toLowerCase();
      if (st === "hadir") return rowStatus === "hadir";
      if (st === "terlambat") return rowStatus === "terlambat";
      if (st === "sakit" || st.includes("cuti")) return ["sakit", "cuti", "izin"].includes(rowStatus);
      if (st.includes("tanpa") || st.includes("belum")) return rowStatus.includes("tanpa") || rowStatus.includes("belum");
      return rowStatus === st;
    });
  }, [allTableRows, selectedStatus, activeTab]);

  // Handler Multi-Select Checkbox
  useEffect(() => {
    setSelectedIds([]);
  }, [selectedDate, selectedMonth, selectedDivisi, selectedStatus, activeTab]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        selectedIds.length > 0 && selectedIds.length < tableRows.length;
    }
  }, [selectedIds, tableRows]);

  const isAllSelected = tableRows.length > 0 && selectedIds.length === tableRows.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tableRows.map((r) => r.id));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Handler Buka Modal Koreksi (Khusus HRD)
  const handleOpenCorrection = (row: AttendanceRow) => {
    if (user?.peran !== "hrd") return;

    setSelectedRow(row);
    setKoreksiStatus(row.status.toLowerCase() === "terlambat" ? "terlambat" : "hadir");

    const extractTimeInput = (rawVal: string | null | undefined, fallback: string) => {
      if (!rawVal || rawVal === "-") return fallback;
      if (rawVal.includes("T")) {
        const afterT = rawVal.split("T")[1];
        return afterT ? afterT.slice(0, 5) : fallback;
      }
      if (rawVal.includes(".")) {
        return rawVal.replace(".", ":").slice(0, 5);
      }
      if (rawVal.includes(":")) {
        return rawVal.slice(0, 5);
      }
      return fallback;
    };

    setKoreksiMasuk(extractTimeInput(row.raw_jam_masuk, "08:00"));
    setKoreksiPulang(extractTimeInput(row.raw_jam_pulang, "17:00"));
    setAlasanKoreksi(row.alasan_koreksi || "");
    setCorrectionError(null);
    setShowCorrectionModal(true);
  };

  // Handler Simpan Koreksi (Validasi BR-03: Wajib HRD & Alasan >= 10 Karakter)
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow || !user) return;

    if (alasanKoreksi.trim().length < 10) {
      setCorrectionError("Alasan koreksi bersifat wajib dan harus minimal 10 karakter.");
      return;
    }

    try {
      await executeAttendanceCorrection(user, selectedRow.id, {
        jamMasuk: koreksiMasuk,
        jamPulang: koreksiPulang || null,
        status: koreksiStatus,
        alasanKoreksi: alasanKoreksi.trim(),
      });

      setShowCorrectionModal(false);
      setCorrectionSuccess(`Absensi ${selectedRow.nama} berhasil dikoreksi.`);
      setTimeout(() => setCorrectionSuccess(null), 3500);
      loadData();
    } catch (err: any) {
      setCorrectionError(err.message || "Gagal mengoreksi absensi.");
    }
  };

  // Handler Ekspor CSV
  const handleDownloadCSV = () => {
    const isSelectedMode = selectedIds.length > 0;
    const targetRows = isSelectedMode
      ? tableRows.filter((r) => selectedIds.includes(r.id))
      : tableRows;

    const prefix = user?.peran === "atasan" ? "Absensi_Tim" : "Absensi_Perusahaan";
    const filename = `${prefix}_${selectedDate}`;

    exportToCSV(filename, targetRows, [
      "nik_karyawan",
      "nama",
      "divisi",
      "masuk",
      "pulang",
      "status",
      "catatan",
    ]);
  };

  const isKaryawan = user?.peran === "karyawan";
  const isAtasan = user?.peran === "atasan";
  const isHRD = user?.peran === "hrd";

  if (loading || !user) {
    return null;
  }

  return (
    <>
      {/* Header Halaman Sesuai Peran */}
      <div className="page-header-row">
        <div>
          <h2 className="page-title">
            {isKaryawan
              ? "Riwayat Absensi Saya"
              : isAtasan
              ? activeTab === "tim"
                ? `Absensi Tim Divisi ${user?.divisi_nama || ""}`
                : "Absensi Pribadi Saya"
              : activeTab === "perusahaan"
              ? "Rekap Absensi Perusahaan"
              : "Absensi Pribadi Saya"}
          </h2>
          <p className="page-sub">
            {isKaryawan
              ? "Riwayat presensi check-in dan check-out akun Anda per bulan."
              : isAtasan
              ? activeTab === "tim"
                ? `Memantau kehadiran seluruh anggota divisi ${user?.divisi_nama || ""} · Data server WIB`
                : "Riwayat presensi mandiri akun Anda."
              : activeTab === "perusahaan"
              ? "Pengawasan dan koreksi presensi seluruh karyawan PT Karsa Lintas Nusantara."
              : "Riwayat presensi check-in akun Kepala HRD."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {/* Tombol Switcher Tampilan (View Toggle: Tabel vs Kalender) */}
          <div className="view-mode-switch" role="group" aria-label="Pilihan Tampilan">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
              title="Tampilkan dalam format Tabel daftar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18" />
              </svg>
              <span>Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`view-mode-btn ${viewMode === "calendar" ? "active" : ""}`}
              title="Tampilkan dalam format Grid Kalender Bulanan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Kalender</span>
            </button>
          </div>

          {/* Tab Switcher untuk Atasan ("Absensi Saya" dan "Tim Divisi") & HRD */}
          {isAtasan && (
            <div className="tab-switch">
              <button
                onClick={() => setActiveTab("tim")}
                className={`switch-btn ${activeTab === "tim" ? "active" : ""}`}
              >
                Tim Divisi
              </button>
              <button
                onClick={() => setActiveTab("pribadi")}
                className={`switch-btn ${activeTab === "pribadi" ? "active" : ""}`}
              >
                Absensi Saya
              </button>
            </div>
          )}

          {isHRD && (
            <div className="tab-switch">
              <button
                onClick={() => setActiveTab("perusahaan")}
                className={`switch-btn ${activeTab === "perusahaan" ? "active" : ""}`}
              >
                Rekap Perusahaan
              </button>
              <button
                onClick={() => setActiveTab("pribadi")}
                className={`switch-btn ${activeTab === "pribadi" ? "active" : ""}`}
              >
                Absensi Saya
              </button>
            </div>
          )}
        </div>
      </div>

      {correctionSuccess && <div className="alert-success">✓ {correctionSuccess}</div>}

      {/* RENDER VIEW: KALENDER BULANAN vs TABEL */}
      {viewMode === "calendar" ? (
        <AttendanceCalendarView
          user={user}
          activeTab={activeTab}
          selectedDivisi={selectedDivisi}
          onOpenCorrection={handleOpenCorrection}
        />
      ) : (
        <>
          {/* ====================================================================
              TAMPILAN 1: ROLE KARYAWAN & TAB PRIBADI ATASAN/HRD
              (Riwayat Absensi Pribadi per Bulan, Tanpa Metrik Global & Tanpa Unduh CSV)
              ==================================================================== */}
          {(isKaryawan || activeTab === "pribadi") && (
            <div className="ui-card">
              <div className="table-header-action" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label className="filter-lbl" htmlFor="filter-bulan-pribadi">Pilih Bulan:</label>
                  <select
                id="filter-bulan-pribadi"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="filter-select"
              >
                <option value="2026-10">Oktober 2026</option>
                <option value="2026-09">September 2026</option>
                <option value="Semua">Semua Riwayat</option>
              </select>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Total Catatan: <strong>{tableRows.length}</strong> hari
            </span>
          </div>

          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>TANGGAL</th>
                  <th>JAM MASUK (WIB)</th>
                  <th>JAM PULANG (WIB)</th>
                  <th>STATUS</th>
                  <th>CATATAN</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.tanggal}</td>
                    <td className="time-val">{item.masuk}</td>
                    <td className="time-val">{item.pulang}</td>
                    <td>
                      <span className={`status-pill ${item.status.toLowerCase()}`}>
                        {item.status.toLowerCase() === "terlambat" ? "Terlambat" : "Hadir"}
                      </span>
                    </td>
                    <td>
                      {item.alasan_koreksi ? (
                        <span className="catatan-koreksi" title={item.alasan_koreksi}>
                          {item.catatan}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>{item.catatan || "-"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      {isDataLoading
                        ? "Memuat data absensi..."
                        : "Belum ada riwayat absensi untuk periode ini."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAMPILAN 2: ROLE ATASAN - TAB "TIM DIVISI"
          (Hanya Anggota Divisi Sendiri, Filter Tanggal & Status, Tanpa Koreksi)
          ==================================================================== */}
      {isAtasan && activeTab === "tim" && (
        <>
          {/* Filter Bar Khusus Atasan */}
          <div className="filter-card">
            <div className="filter-group-row">
              <div className="filter-control">
                <label className="filter-lbl">Tanggal:</label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="filter-select"
                >
                  <option value="2026-10-27">Selasa, 27 Okt 2026 (Hari Ini)</option>
                  <option value="2026-10-15">Kamis, 15 Okt 2026</option>
                  <option value="2026-10-14">Rabu, 14 Okt 2026</option>
                  <option value="2026-10-13">Selasa, 13 Okt 2026</option>
                  <option value="2026-10-12">Senin, 12 Okt 2026</option>
                  <option value="2026-10-09">Jumat, 9 Okt 2026</option>
                  <option value="2026-10-08">Kamis, 8 Okt 2026</option>
                  <option value="2026-09-21">Senin, 21 Sep 2026</option>
                </select>
              </div>

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
                  <option value="sakit">Cuti / Izin / Sakit</option>
                  <option value="tanpa keterangan">Tanpa Keterangan</option>
                </select>
              </div>
            </div>

            <div className="filter-actions-right">
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="ui-btn ui-btn-secondary"
              >
                Unduh CSV Tim
              </button>
            </div>
          </div>

          {/* Ringkasan Kehadiran Tim Divisi Atasan */}
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

          {/* Tabel Absensi Anggota Divisi */}
          <div className="ui-card">
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>NIK</th>
                    <th>NAMA ANGGOTA</th>
                    <th>DIVISI</th>
                    <th>MASUK</th>
                    <th>PULANG</th>
                    <th>STATUS</th>
                    <th>CATATAN</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono">{row.nik_karyawan}</td>
                      <td className="font-semibold">{row.nama}</td>
                      <td>{row.divisi}</td>
                      <td className="time-val">{row.masuk}</td>
                      <td className="time-val">{row.pulang}</td>
                      <td>
                        <span className={`status-pill ${row.status.toLowerCase().replace(/\s+/g, "_")}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        {row.alasan_koreksi ? (
                          <span className="catatan-koreksi" title={row.alasan_koreksi}>
                            {row.alasan_koreksi}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>{row.catatan || "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        Tidak ada data absensi anggota divisi untuk tanggal ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ====================================================================
          TAMPILAN 3: ROLE HRD - REKAP ABSENSI SELURUH PERUSAHAAN
          (Lengkap 4 Kartu Metrik, Filter Divisi, Unduh CSV, dan Tombol Koreksi BR-03)
          ==================================================================== */}
      {isHRD && activeTab === "perusahaan" && (
        <>
          {/* Filter Bar Lengkap dengan Dropdown Divisi */}
          <div className="filter-card">
            <div className="filter-group-row">
              <div className="filter-control">
                <label className="filter-lbl">Tanggal:</label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="filter-select"
                >
                  <option value="2026-10-27">Selasa, 27 Okt 2026 (Hari Ini)</option>
                  <option value="2026-10-15">Kamis, 15 Okt 2026</option>
                  <option value="2026-10-14">Rabu, 14 Okt 2026</option>
                  <option value="2026-10-13">Selasa, 13 Okt 2026</option>
                  <option value="2026-10-12">Senin, 12 Okt 2026</option>
                  <option value="2026-10-09">Jumat, 9 Okt 2026</option>
                  <option value="2026-10-08">Kamis, 8 Okt 2026</option>
                  <option value="2026-09-21">Senin, 21 Sep 2026</option>
                </select>
              </div>

              {/* Dropdown Filter Divisi Lengkap sesuai PRD */}
              <div className="filter-control">
                <label className="filter-lbl">Divisi:</label>
                <select
                  value={selectedDivisi}
                  onChange={(e) => setSelectedDivisi(e.target.value)}
                  className="filter-select"
                >
                  <option value="Semua">Semua Divisi</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Operasional Gudang">Operasional Gudang</option>
                  <option value="Penjualan">Penjualan</option>
                  <option value="Keuangan">Keuangan</option>
                </select>
              </div>

              <div className="filter-control">
                <label className="filter-lbl">Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="hadir">Hadir</option>
                  <option value="terlambat">Terlambat</option>
                  <option value="sakit">Sakit</option>
                </select>
              </div>
            </div>

            <div className="filter-actions-right">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="btn-cancel-selection"
                >
                  Batal Pilih
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadCSV}
                className={`ui-btn ${
                  selectedIds.length > 0
                    ? "ui-btn-primary ui-btn-primary-export"
                    : "ui-btn-secondary"
                }`}
              >
                {selectedIds.length > 0
                  ? `Unduh Terpilih (${selectedIds.length}) CSV`
                  : "Unduh CSV"}
              </button>
            </div>
          </div>

          {/* 4 Kotak Metrik Ringkasan Harian Perusahaan */}
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

          {/* Tabel Absensi Perusahaan dengan Tombol Koreksi */}
          <div className="ui-card">
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th className="th-checkbox">
                      <input
                        type="checkbox"
                        ref={headerCheckboxRef}
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="table-checkbox"
                        aria-label="Pilih Semua Baris"
                      />
                    </th>
                    <th>NIK</th>
                    <th>NAMA</th>
                    <th>DIVISI</th>
                    <th>MASUK</th>
                    <th>PULANG</th>
                    <th>STATUS</th>
                    <th>CATATAN</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const isSelected = selectedIds.includes(row.id);
                    return (
                      <tr key={row.id} className={isSelected ? "row-selected" : ""}>
                        <td className="td-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(row.id)}
                            className="table-checkbox"
                            aria-label={`Pilih baris ${row.nama}`}
                          />
                        </td>
                        <td className="font-mono">{row.nik_karyawan}</td>
                        <td className="font-semibold">{row.nama}</td>
                        <td>{row.divisi}</td>
                        <td className="time-val">{row.masuk}</td>
                        <td className="time-val">{row.pulang}</td>
                        <td>
                          <span className={`status-pill ${row.status.toLowerCase().replace(/\s+/g, "_")}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>
                          {row.alasan_koreksi ? (
                            <span className="catatan-koreksi" title={row.alasan_koreksi}>
                              {row.alasan_koreksi}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>{row.catatan || "-"}</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => handleOpenCorrection(row)}
                            className="ui-btn-cancel"
                            title="Koreksi jam atau status presensi karyawan"
                          >
                            Koreksi
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        Tidak ada data absensi untuk filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
        </>
      )}

      {/* MODAL KOREKSI ABSENSI (Hanya Boleh Diakses HRD - Sesuai PRD BR-03) */}
      {showCorrectionModal && selectedRow && isHRD && (
        <div className="modal-backdrop" onClick={() => setShowCorrectionModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Koreksi Absensi: {selectedRow.nama}</h3>
            <p className="modal-subtitle">
              {selectedRow.nik_karyawan} · {selectedRow.divisi} · Tanggal {selectedRow.tanggal || selectedDate}
            </p>

            {correctionError && <div className="modal-alert-error">⚠️ {correctionError}</div>}

            <form onSubmit={handleSaveCorrection} className="modal-form">
              <div className="form-row">
                <div className="form-item">
                  <label className="lbl">Status Kehadiran</label>
                  <select
                    value={koreksiStatus}
                    onChange={(e) => setKoreksiStatus(e.target.value as "hadir" | "terlambat")}
                    className="inp-select"
                  >
                    <option value="hadir">Hadir</option>
                    <option value="terlambat">Terlambat</option>
                  </select>
                </div>

                <div className="form-item">
                  <label className="lbl">Jam Masuk (WIB)</label>
                  <input
                    type="time"
                    required
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label className="lbl">
                    Alasan Koreksi <span className="req-tag">*Wajib (minimal 10 karakter)</span>
                  </label>
                  <span style={{ fontSize: "0.6875rem", color: alasanKoreksi.trim().length >= 10 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                    {alasanKoreksi.trim().length} / 10 karakter
                  </span>
                </div>
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
                <button
                  type="submit"
                  disabled={alasanKoreksi.trim().length < 10}
                  className={`ui-btn ${alasanKoreksi.trim().length >= 10 ? "ui-btn-primary" : "ui-btn-disabled"}`}
                >
                  Simpan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
