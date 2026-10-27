"use client";

import React, { useState, useMemo } from "react";
import hariLiburSeedData from "../../../data/seeds/hari_libur.json";
import profilesData from "../../../data/seeds/profiles.json";
import pengajuanCutiSeed from "../../../data/seeds/pengajuan_cuti.json";
import divisiData from "../../../data/seeds/divisi.json";
import { getRawAttendanceStore } from "@/lib/firebase/attendance-service";
import { getSubmittedLeaves, getLeaveStatusOverrides } from "@/lib/utils/leave-store";
import { formatTimeWIB, AttendanceRow } from "@/app/absensi/page";

const divisiMap = new Map((divisiData as any[]).map((d) => [d.id, d.nama]));

interface AttendanceCalendarViewProps {
  user: any;
  activeTab: "pribadi" | "tim" | "perusahaan";
  selectedDivisi: string;
  onOpenCorrection?: (row: AttendanceRow) => void;
  onSwitchToDate?: (dateStr: string) => void;
}

const INDO_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const TODAY_STR = "2026-10-27"; // Tanggal acuan sistem WIB (Selasa, 27 Okt 2026)

export default function AttendanceCalendarView({
  user,
  activeTab,
  selectedDivisi,
  onOpenCorrection,
}: AttendanceCalendarViewProps) {
  // State navigasi tahun & bulan (Default: Oktober 2026)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9); // 0-indexed (9 = Oktober)

  // State Modal Detail Tanggal
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Ambil Hari Libur Nasional & Perusahaan (Sinkron dengan Pengaturan HRD)
  const holidayMap = useMemo(() => {
    let list = hariLiburSeedData as Array<{ tanggal: string; keterangan: string; jenis: string }>;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("karsahr_hari_libur_list");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        }
      } catch {}
    }
    const map = new Map<string, { keterangan: string; jenis: string }>();
    list.forEach((h) => map.set(h.tanggal, { keterangan: h.keterangan, jenis: h.jenis }));
    return map;
  }, []);

  // Ambil Master Profiles Aktif
  const activeProfiles = useMemo(() => {
    return (profilesData as Array<any>).filter((p) => p.aktif !== false);
  }, []);

  // Filter anggota tim/perusahaan berdasarkan scope tab & filter divisi
  const targetMembers = useMemo(() => {
    if (!user) return [];
    if (activeTab === "pribadi") {
      return activeProfiles.filter(
        (p) =>
          p.id === user.id ||
          p.id === user.seed_id ||
          p.nik_karyawan === user.nik_karyawan
      );
    }
    if (activeTab === "tim") {
      const userDivId = user.divisi_id;
      const userDivName = (
        user.divisi_nama ||
        user["divisi (bantu)"] ||
        (user.divisi_id ? divisiMap.get(user.divisi_id) : null) ||
        (user.nama_lengkap?.toLowerCase().includes("bayu") ? "Operasional Gudang" : "Penjualan")
      ).toLowerCase().trim();

      return activeProfiles.filter((p) => {
        if (userDivId && p.divisi_id === userDivId) return true;
        const pDiv = (
          p["divisi (bantu)"] ||
          p.divisi_nama ||
          (p.divisi_id ? divisiMap.get(p.divisi_id) : "")
        ).toLowerCase().trim();
        return (userDivName && (pDiv.includes(userDivName) || userDivName.includes(pDiv)));
      });
    }
    // HRD: Perusahaan
    if (selectedDivisi && selectedDivisi !== "Semua") {
      return activeProfiles.filter(
        (p) =>
          p.divisi_id === selectedDivisi ||
          (p["divisi (bantu)"] || "").toLowerCase() === selectedDivisi.toLowerCase() ||
          (p.divisi_nama || "").toLowerCase() === selectedDivisi.toLowerCase()
      );
    }
    return activeProfiles;
  }, [user, activeTab, selectedDivisi, activeProfiles]);

  // Master data absensi dari local store & seed
  const rawAttendance = useMemo(() => {
    return getRawAttendanceStore();
  }, [currentYear, currentMonth]);

  // Master data pengajuan cuti & izin
  const allLeaves = useMemo(() => {
    const localSubmitted = getSubmittedLeaves();
    const overrides = getLeaveStatusOverrides();
    const map = new Map<string, any>();

    (pengajuanCutiSeed as any[]).forEach((c) => {
      map.set(c.id, {
        ...c,
        status: overrides[c.id]?.status || c.status,
      });
    });

    localSubmitted.forEach((c) => {
      map.set(c.id, {
        ...c,
        status: overrides[c.id]?.status || c.status,
      });
    });

    return Array.from(map.values());
  }, [currentYear, currentMonth]);

  // Navigasi Bulan
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(9); // Oktober
  };

  // Kalkulasi Grid 7 Kolom (Senin s/d Minggu)
  const calendarGridDays = useMemo(() => {
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
    const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
      holidayInfo?: { keterangan: string; jenis: string };
    }> = [];

    // Hari dari bulan sebelumnya
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthTotalDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const mmStr = String(prevMonth + 1).padStart(2, "0");
      const ddStr = String(dNum).padStart(2, "0");
      const dateStr = `${prevYear}-${mmStr}-${ddStr}`;
      const dayOfWeek = (new Date(prevYear, prevMonth, dNum).getDay() + 6) % 7;
      days.push({
        dayNum: dNum,
        dateStr,
        isCurrentMonth: false,
        isWeekend: dayOfWeek >= 5,
        isToday: dateStr === TODAY_STR,
        holidayInfo: holidayMap.get(dateStr),
      });
    }

    // Hari dalam bulan aktif
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mmStr = String(currentMonth + 1).padStart(2, "0");
      const ddStr = String(d).padStart(2, "0");
      const dateStr = `${currentYear}-${mmStr}-${ddStr}`;
      const dayOfWeek = (new Date(currentYear, currentMonth, d).getDay() + 6) % 7;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        isWeekend: dayOfWeek >= 5,
        isToday: dateStr === TODAY_STR,
        holidayInfo: holidayMap.get(dateStr),
      });
    }

    // Hari dari bulan berikutnya untuk melengkapi baris terakhir kelipatan 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const mmStr = String(nextMonth + 1).padStart(2, "0");
      const ddStr = String(d).padStart(2, "0");
      const dateStr = `${nextYear}-${mmStr}-${ddStr}`;
      const dayOfWeek = (new Date(nextYear, nextMonth, d).getDay() + 6) % 7;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false,
        isWeekend: dayOfWeek >= 5,
        isToday: dateStr === TODAY_STR,
        holidayInfo: holidayMap.get(dateStr),
      });
    }

    return days;
  }, [currentYear, currentMonth, holidayMap]);

  // Lookup data per tanggal untuk seluruh anggota target
  const calendarDataByDate = useMemo(() => {
    const dataMap = new Map<
      string,
      {
        personalRecord?: {
          status: string;
          masuk: string;
          pulang: string;
          catatan: string;
          rawRecord?: any;
        };
        teamSummary?: {
          hadir: number;
          terlambat: number;
          cutiIzin: number;
          tanpaKeterangan: number;
          total: number;
        };
        memberRecords: AttendanceRow[];
      }
    >();

    const userUid = user?.id;
    const userSeedId = user?.seed_id;
    const userNik = user?.nik_karyawan;

    calendarGridDays.forEach((cell) => {
      const dateStr = cell.dateStr;
      const dayOfWeek = (new Date(dateStr).getDay() + 6) % 7;
      const isWeekend = dayOfWeek >= 5;
      const isHoliday = !!cell.holidayInfo;

      const memberRows: AttendanceRow[] = [];
      let countHadir = 0;
      let countTerlambat = 0;
      let countCuti = 0;
      let countAlpa = 0;

      targetMembers.forEach((member) => {
        // 1. Cek catatan absensi
        const rec = rawAttendance.find(
          (a) =>
            a.tanggal === dateStr &&
            (a.karyawan_id === member.id ||
              a.karyawan_id === member.uid ||
              a.karyawan_id === member.seed_id ||
              (a["nama (bantu)"] && a["nama (bantu)"].toLowerCase() === member.nama_lengkap.toLowerCase()))
        );

        // 2. Cek izin/cuti
        const approvedLeave = allLeaves.find((c) => {
          const matchUser =
            c.karyawan_id === member.id ||
            c.karyawan_id === member.uid ||
            (c["pemohon (bantu)"] && c["pemohon (bantu)"].toLowerCase() === member.nama_lengkap.toLowerCase());
          const isApproved = c.status === "disetujui" || c.status === "disetujui_atasan";
          return matchUser && isApproved && c.tanggal_mulai <= dateStr && dateStr <= c.tanggal_selesai;
        });

        const isUserMember =
          member.id === userUid ||
          member.id === userSeedId ||
          member.nik_karyawan === userNik;

        if (rec) {
          const isLate = rec.status === "terlambat";
          if (isLate) countTerlambat++;
          else countHadir++;

          const memberDivisiName =
            member.divisi_nama ||
            member["divisi (bantu)"] ||
            (member.divisi_id ? divisiMap.get(member.divisi_id) : null) ||
            "Umum";

          memberRows.push({
            id: rec.id || `att-${member.id}-${dateStr}`,
            nik_karyawan: member.nik_karyawan,
            nama: member.nama_lengkap,
            divisi: memberDivisiName,
            divisi_id: member.divisi_id,
            tanggal: dateStr,
            masuk: formatTimeWIB(rec.jam_masuk),
            pulang: formatTimeWIB(rec.jam_pulang),
            raw_jam_masuk: rec.jam_masuk,
            raw_jam_pulang: rec.jam_pulang,
            status: isLate ? "Terlambat" : "Hadir",
            dikoreksi_oleh: rec.dikoreksi_oleh,
            alasan_koreksi: rec.alasan_koreksi,
            catatan: rec.alasan_koreksi ? `Koreksi: ${rec.alasan_koreksi}` : rec.catatan || "-",
          });
        } else if (approvedLeave) {
          countCuti++;
          const leaveLabel =
            approvedLeave.jenis === "cuti_tahunan"
              ? "Cuti Tahunan"
              : approvedLeave.jenis === "sakit"
              ? "Izin Sakit"
              : "Izin";
          const memberDivisiName =
            member.divisi_nama ||
            member["divisi (bantu)"] ||
            (member.divisi_id ? divisiMap.get(member.divisi_id) : null) ||
            "Umum";

          memberRows.push({
            id: `leave-${member.id}-${dateStr}`,
            nik_karyawan: member.nik_karyawan,
            nama: member.nama_lengkap,
            divisi: memberDivisiName,
            divisi_id: member.divisi_id,
            tanggal: dateStr,
            masuk: "-",
            pulang: "-",
            status: leaveLabel,
            catatan: approvedLeave.alasan || leaveLabel,
          });
        } else {
          // Hari libur / weekend tidak dihitung alpa
          if (!isWeekend && !isHoliday && dateStr <= TODAY_STR) {
            countAlpa++;
            const memberDivisiName =
              member.divisi_nama ||
              member["divisi (bantu)"] ||
              (member.divisi_id ? divisiMap.get(member.divisi_id) : null) ||
              "Umum";

            memberRows.push({
              id: `alpa-${member.id}-${dateStr}`,
              nik_karyawan: member.nik_karyawan,
              nama: member.nama_lengkap,
              divisi: memberDivisiName,
              divisi_id: member.divisi_id,
              tanggal: dateStr,
              masuk: "-",
              pulang: "-",
              status: "Tanpa Keterangan",
              catatan: "Belum ada catatan presensi",
            });
          }
        }
      });

      // Data pribadi user
      let personalRecord: any = undefined;
      const myRow = memberRows.find(
        (m) =>
          m.nik_karyawan === userNik ||
          (user?.nama_lengkap && m.nama.toLowerCase() === user.nama_lengkap.toLowerCase())
      );
      if (myRow) {
        personalRecord = {
          status: myRow.status,
          masuk: myRow.masuk,
          pulang: myRow.pulang,
          catatan: myRow.catatan,
          rawRecord: myRow,
        };
      }

      dataMap.set(dateStr, {
        personalRecord,
        teamSummary: {
          hadir: countHadir,
          terlambat: countTerlambat,
          cutiIzin: countCuti,
          tanpaKeterangan: countAlpa,
          total: targetMembers.length,
        },
        memberRecords: memberRows,
      });
    });

    return dataMap;
  }, [calendarGridDays, targetMembers, rawAttendance, allLeaves, user]);

  // Data tanggal yang sedang dibuka di modal
  const activeModalData = useMemo(() => {
    if (!selectedCalendarDate) return null;
    const entry = calendarDataByDate.get(selectedCalendarDate);
    const holiday = holidayMap.get(selectedCalendarDate);
    return {
      dateStr: selectedCalendarDate,
      holiday,
      entry,
    };
  }, [selectedCalendarDate, calendarDataByDate, holidayMap]);

  return (
    <div className="attendance-calendar-root">
      {/* 1. HEADER & NAVIGASI BULAN ALA GOOGLE CALENDAR */}
      <div className="calendar-top-bar">
        <div className="cal-nav-left">
          <button
            type="button"
            onClick={handleJumpToToday}
            className="cal-btn-today"
            title="Lompat ke tanggal aktif hari ini"
          >
            Hari Ini
          </button>

          <div className="cal-nav-arrows">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="cal-arrow-btn"
              title="Bulan sebelumnya"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="cal-arrow-btn"
              title="Bulan berikutnya"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <h3 className="cal-title-month">
            {INDO_MONTHS[currentMonth]} {currentYear}
          </h3>
        </div>

        {/* Legend Ringkas Keterangan Warna */}
        <div className="cal-legend-tags">
          <div className="cal-legend-tag">
            <span className="cal-dot-indicator dot-hadir" />
            <span>Hadir</span>
          </div>
          <div className="cal-legend-tag">
            <span className="cal-dot-indicator dot-terlambat" />
            <span>Terlambat</span>
          </div>
          <div className="cal-legend-tag">
            <span className="cal-dot-indicator dot-cuti" />
            <span>Cuti / Izin</span>
          </div>
          <div className="cal-legend-tag">
            <span className="cal-dot-indicator dot-alpa" />
            <span>Tanpa Keterangan</span>
          </div>
          <div className="cal-legend-tag">
            <span className="cal-dot-indicator dot-weekend" />
            <span>Akhir Pekan</span>
          </div>
        </div>
      </div>

      {/* 2. GRID KALENDER BULANAN (7 KOLOM SENIN - MINGGU) */}
      <div className="calendar-grid-scroll-wrap">
        <div className="calendar-grid-card">
          {/* Header Nama Hari */}
          <div className="calendar-day-header-row">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`calendar-day-header-cell ${i >= 5 ? "is-weekend" : ""}`}
            >
              <span>{name}</span>
            </div>
          ))}
        </div>

        {/* Kotak-Kotak Tanggal */}
        <div className="calendar-cells-grid">
          {calendarGridDays.map((cell) => {
            const dateData = calendarDataByDate.get(cell.dateStr);
            const isPersonalMode = activeTab === "pribadi";
            const pers = dateData?.personalRecord;
            const team = dateData?.teamSummary;
            const hasData = isPersonalMode
              ? !!pers
              : (team && (team.hadir > 0 || team.terlambat > 0 || team.cutiIzin > 0 || team.tanpaKeterangan > 0));

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedCalendarDate(cell.dateStr)}
                className={`cal-cell-box ${
                  !cell.isCurrentMonth ? "not-current-month" : ""
                } ${cell.isWeekend ? "weekend-cell" : ""} ${
                  cell.isToday ? "today-cell" : ""
                }`}
                title={`Klik untuk melihat detail presensi ${cell.dateStr}`}
              >
                {/* Header Sel: Tanggal & Label Libur */}
                <div className="cal-cell-header">
                  <span
                    className={`cal-date-number ${
                      cell.isToday ? "badge-today" : cell.isWeekend ? "text-weekend" : ""
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {cell.holidayInfo && (
                    <span className="cal-holiday-tag" title={cell.holidayInfo.keterangan}>
                      {cell.holidayInfo.keterangan}
                    </span>
                  )}
                </div>

                {/* Konten Badge Kehadiran */}
                <div className="cal-cell-content">
                  {/* Mode Pribadi */}
                  {isPersonalMode ? (
                    pers ? (
                      <div
                        className={`cal-status-chip ${
                          pers.status.toLowerCase().includes("terlambat")
                            ? "chip-terlambat"
                            : pers.status.toLowerCase().includes("cuti") ||
                              pers.status.toLowerCase().includes("izin") ||
                              pers.status.toLowerCase().includes("sakit")
                            ? "chip-cuti"
                            : pers.status.toLowerCase().includes("tanpa")
                            ? "chip-alpa"
                            : "chip-hadir"
                        }`}
                      >
                        <div className="chip-primary-line">
                          {pers.status.toLowerCase().includes("terlambat") ? (
                            <>
                              <span className="chip-dot dot-terlambat" />
                              <span className="chip-time">{pers.masuk}</span>
                              <span className="chip-label">Telat</span>
                            </>
                          ) : pers.status.toLowerCase().includes("cuti") ||
                            pers.status.toLowerCase().includes("izin") ||
                            pers.status.toLowerCase().includes("sakit") ? (
                            <>
                              <span className="chip-dot dot-cuti" />
                              <span className="chip-label">{pers.status}</span>
                            </>
                          ) : pers.status.toLowerCase().includes("tanpa") ? (
                            <>
                              <span className="chip-dot dot-alpa" />
                              <span className="chip-label">Tanpa Ket.</span>
                            </>
                          ) : (
                            <>
                              <span className="chip-dot dot-hadir" />
                              <span className="chip-time">{pers.masuk}</span>
                              <span className="chip-label">Hadir</span>
                            </>
                          )}
                        </div>
                        {pers.pulang && pers.pulang !== "-" && (
                          <div className="chip-sub-line">Plg {pers.pulang}</div>
                        )}
                      </div>
                    ) : cell.isWeekend ? (
                      <div className="cal-empty-subtle">Akhir pekan</div>
                    ) : cell.holidayInfo ? (
                      <div className="cal-empty-subtle">Hari Libur</div>
                    ) : null
                  ) : (
                    /* Mode Tim / Perusahaan (Agregat Ringkas) */
                    team && hasData ? (
                      <div className="cal-team-badges-col">
                        {team.hadir > 0 && (
                          <div className="team-badge-pill hadir">
                            <span className="dot-mini dot-hadir" />
                            <span>{team.hadir} Hadir</span>
                          </div>
                        )}
                        {team.terlambat > 0 && (
                          <div className="team-badge-pill terlambat">
                            <span className="dot-mini dot-terlambat" />
                            <span>{team.terlambat} Telat</span>
                          </div>
                        )}
                        {team.cutiIzin > 0 && (
                          <div className="team-badge-pill cuti">
                            <span className="dot-mini dot-cuti" />
                            <span>{team.cutiIzin} Cuti/Izin</span>
                          </div>
                        )}
                        {team.tanpaKeterangan > 0 && (
                          <div className="team-badge-pill alpa">
                            <span className="dot-mini dot-alpa" />
                            <span>{team.tanpaKeterangan} Belum Hadir</span>
                          </div>
                        )}
                      </div>
                    ) : cell.isWeekend ? (
                      <div className="cal-empty-subtle">Libur akhir pekan</div>
                    ) : cell.holidayInfo ? (
                      <div className="cal-empty-subtle">Libur operasional</div>
                    ) : null
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* 3. MODAL DETAIL POPUP SAAT TANGGAL DIKLIK */}
      {activeModalData && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedCalendarDate(null)}
        >
          <div
            className="modal-box cal-detail-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: activeTab === "pribadi" ? "480px" : "680px" }}
          >
            <div className="cal-modal-header">
              <div>
                <span className="cal-modal-tag">Detail Presensi Harian</span>
                <h3 className="cal-modal-title">
                  {new Date(activeModalData.dateStr).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                {activeModalData.holiday && (
                  <p className="cal-modal-holiday">
                    <span className="cal-dot-indicator dot-alpa" style={{ display: "inline-block", marginRight: "6px" }} />
                    {activeModalData.holiday.keterangan} ({activeModalData.holiday.jenis})
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="cal-modal-close-btn"
                title="Tutup detail"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Konten Detail Mode Pribadi */}
            {activeTab === "pribadi" ? (
              <div className="cal-personal-detail-body">
                {activeModalData.entry?.personalRecord ? (
                  <div className="personal-card-box">
                    <div className="personal-row-item">
                      <span className="p-label">Status Presensi:</span>
                      <span
                        className={`status-pill ${
                          activeModalData.entry.personalRecord.status
                            .toLowerCase()
                            .includes("terlambat")
                            ? "terlambat"
                            : activeModalData.entry.personalRecord.status
                                .toLowerCase()
                                .includes("cuti")
                            ? "cuti"
                            : activeModalData.entry.personalRecord.status
                                .toLowerCase()
                                .includes("tanpa")
                            ? "alpa"
                            : "hadir"
                        }`}
                      >
                        {activeModalData.entry.personalRecord.status}
                      </span>
                    </div>

                    <div className="personal-grid-two">
                      <div className="p-time-box">
                        <span className="p-label">Jam Masuk (WIB)</span>
                        <span className="p-time-val">
                          {activeModalData.entry.personalRecord.masuk}
                        </span>
                      </div>
                      <div className="p-time-box">
                        <span className="p-label">Jam Pulang (WIB)</span>
                        <span className="p-time-val">
                          {activeModalData.entry.personalRecord.pulang}
                        </span>
                      </div>
                    </div>

                    <div className="personal-row-item notes">
                      <span className="p-label">Catatan / Koreksi:</span>
                      <p className="p-notes-text">
                        {activeModalData.entry.personalRecord.catatan || "-"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="empty-day-box">
                    <p>Tidak ada catatan kehadiran mandiri pada tanggal ini.</p>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {activeModalData.dateStr > TODAY_STR
                        ? "Tanggal belum berlangsung."
                        : "Hari libur atau belum melakukan check-in."}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Konten Detail Mode Tim Divisi / Perusahaan */
              <div className="cal-team-detail-body">
                {/* Metrik Mini di Modal */}
                {activeModalData.entry?.teamSummary && (
                  <div className="cal-team-quick-stat-bar">
                    <div className="stat-pill-sm hadir">
                      <span className="dot-mini dot-hadir" />
                      <span>Hadir:</span>
                      <strong>{activeModalData.entry.teamSummary.hadir}</strong>
                    </div>
                    <div className="stat-pill-sm terlambat">
                      <span className="dot-mini dot-terlambat" />
                      <span>Telat:</span>
                      <strong>{activeModalData.entry.teamSummary.terlambat}</strong>
                    </div>
                    <div className="stat-pill-sm cuti">
                      <span className="dot-mini dot-cuti" />
                      <span>Cuti/Izin:</span>
                      <strong>{activeModalData.entry.teamSummary.cutiIzin}</strong>
                    </div>
                    <div className="stat-pill-sm alpa">
                      <span className="dot-mini dot-alpa" />
                      <span>Belum Hadir:</span>
                      <strong>{activeModalData.entry.teamSummary.tanpaKeterangan}</strong>
                    </div>
                  </div>
                )}

                {/* Tabel Daftar Karyawan pada Tanggal Terpilih */}
                <div className="ui-table-wrap" style={{ maxHeight: "320px", overflowY: "auto" }}>
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>NAMA</th>
                        <th>DIVISI</th>
                        <th>MASUK</th>
                        <th>PULANG</th>
                        <th>STATUS</th>
                        {user?.peran === "hrd" && <th>AKSI</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {activeModalData.entry?.memberRecords &&
                      activeModalData.entry.memberRecords.length > 0 ? (
                        activeModalData.entry.memberRecords.map((item) => (
                          <tr key={item.id}>
                            <td className="font-semibold">{item.nama}</td>
                            <td>{item.divisi}</td>
                            <td className="time-val">{item.masuk}</td>
                            <td className="time-val">{item.pulang}</td>
                            <td>
                              <span
                                className={`status-pill ${
                                  item.status.toLowerCase().includes("terlambat")
                                    ? "terlambat"
                                    : item.status.toLowerCase().includes("cuti")
                                    ? "cuti"
                                    : item.status.toLowerCase().includes("tanpa")
                                    ? "alpa"
                                    : "hadir"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            {user?.peran === "hrd" && (
                              <td>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCalendarDate(null);
                                    if (onOpenCorrection) onOpenCorrection(item);
                                  }}
                                  className="ui-btn-cancel"
                                  title="Koreksi presensi karyawan ini"
                                >
                                  Koreksi
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={user?.peran === "hrd" ? 6 : 5} className="empty-row">
                            Tidak ada anggota tim yang terjadwal hadir pada tanggal ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STYLING CSS TERPADU UNTUK KALENDER ENTERPRISE */}
      <style jsx>{`
        .attendance-calendar-root {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }

        /* --- Top Bar & Navigasi --- */
        .calendar-top-bar {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.85rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .cal-nav-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .cal-btn-today {
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 0.35rem 0.85rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cal-btn-today:hover {
          background-color: #f1f5f9;
          border-color: #94a3b8;
        }

        .cal-nav-arrows {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .cal-arrow-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cal-arrow-btn:hover {
          background-color: #f8fafc;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .cal-title-month {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
          margin-left: 0.35rem;
        }

        .cal-legend-tags {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-wrap: wrap;
        }

        .cal-legend-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #475569;
        }

        .cal-dot-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .dot-hadir {
          background-color: #10b981;
        }
        .dot-terlambat {
          background-color: #f59e0b;
        }
        .dot-cuti {
          background-color: #3b82f6;
        }
        .dot-alpa {
          background-color: #ef4444;
        }
        .dot-weekend {
          background-color: #94a3b8;
        }

        /* --- Calendar Grid Card --- */
        .calendar-grid-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .calendar-day-header-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .calendar-day-header-cell {
          padding: 0.65rem 0.5rem;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .calendar-day-header-cell.is-weekend {
          color: #94a3b8;
          background-color: #f1f5f9;
        }

        .calendar-cells-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background-color: #e2e8f0;
          gap: 1px; /* Divider halus antar sel */
        }

        .cal-cell-box {
          background-color: #ffffff;
          min-height: 110px;
          padding: 0.45rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          cursor: pointer;
          transition: background-color 0.12s ease;
        }
        .cal-cell-box:hover {
          background-color: #f0fdf4;
        }

        .cal-cell-box.not-current-month {
          background-color: #fafafa;
          opacity: 0.55;
        }

        .cal-cell-box.weekend-cell {
          background-color: #f8fafc;
        }
        .cal-cell-box.weekend-cell:hover {
          background-color: #f1f5f9;
        }

        .cal-cell-box.today-cell {
          background-color: #eff6ff;
          box-shadow: inset 0 0 0 2px #3b82f6;
        }

        .cal-cell-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.25rem;
        }

        .cal-date-number {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #1e293b;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .cal-date-number.badge-today {
          background-color: #2563eb;
          color: #ffffff;
          font-weight: 700;
        }

        .cal-date-number.text-weekend {
          color: #94a3b8;
        }

        .cal-holiday-tag {
          font-size: 0.625rem;
          background-color: #fee2e2;
          color: #b91c1c;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 90px;
        }

        .cal-cell-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        /* --- Status Chip (Mode Pribadi) --- */
        .cal-status-chip {
          padding: 0.3rem 0.45rem;
          border-radius: 6px;
          font-size: 0.6875rem;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          border: 1px solid transparent;
        }

        .chip-primary-line {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .chip-time {
          font-family: monospace;
          font-weight: 700;
        }

        .chip-sub-line {
          font-size: 0.625rem;
          opacity: 0.8;
          font-family: monospace;
        }

        .chip-hadir {
          background-color: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .chip-terlambat {
          background-color: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }
        .chip-cuti {
          background-color: #eff6ff;
          color: #1e40af;
          border-color: #bfdbfe;
        }
        .chip-alpa {
          background-color: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .cal-empty-subtle {
          font-size: 0.6875rem;
          color: #cbd5e1;
          font-style: italic;
          margin-top: auto;
        }

        /* --- Team Badge Pills (Mode Tim & Perusahaan) --- */
        .cal-team-badges-col {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .team-badge-pill {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
        }

        .dot-mini {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .team-badge-pill.hadir {
          background-color: #f0fdf4;
          color: #166534;
        }
        .team-badge-pill.terlambat {
          background-color: #fffbeb;
          color: #b45309;
        }
        .team-badge-pill.cuti {
          background-color: #eff6ff;
          color: #1d4ed8;
        }
        .team-badge-pill.alpa {
          background-color: #fef2f2;
          color: #b91c1c;
        }

        /* --- Modal Popup Styling --- */
        .cal-detail-modal {
          padding: 1.5rem !important;
        }

        .cal-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 0.85rem;
          margin-bottom: 1rem;
        }

        .cal-modal-tag {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .cal-modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          margin-top: 0.2rem;
        }

        .cal-modal-holiday {
          font-size: 0.75rem;
          color: #dc2626;
          font-weight: 600;
          margin-top: 0.25rem;
        }

        .cal-modal-close-btn {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #64748b;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .cal-modal-close-btn:hover {
          background-color: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .personal-card-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .personal-row-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .personal-grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .p-time-box {
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 0.65rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .p-label {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
        }

        .p-time-val {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          font-family: monospace;
        }

        .p-notes-text {
          font-size: 0.8125rem;
          color: #334155;
          margin-top: 0.25rem;
        }

        .cal-team-quick-stat-bar {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.85rem;
        }

        .stat-pill-sm {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          padding: 0.3rem 0.65rem;
          border-radius: 6px;
          border: 1px solid transparent;
        }
        .stat-pill-sm.hadir {
          background-color: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .stat-pill-sm.terlambat {
          background-color: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }
        .stat-pill-sm.cuti {
          background-color: #eff6ff;
          color: #1e40af;
          border-color: #bfdbfe;
        }
        .stat-pill-sm.alpa {
          background-color: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .cal-modal-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid #e2e8f0;
        }

        .empty-day-box {
          text-align: center;
          padding: 2rem;
          color: #64748b;
        }

        .calendar-grid-scroll-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
        }

        @media (max-width: 768px) {
          .calendar-top-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
            padding: 0.85rem;
          }

          .cal-nav-left {
            justify-content: space-between;
            width: 100%;
          }

          .cal-legend-tags {
            width: 100%;
            gap: 0.5rem;
          }

          .calendar-grid-card {
            min-width: 620px;
          }

          .cal-detail-modal {
            width: calc(100vw - 1.5rem) !important;
            max-width: 100% !important;
            padding: 1.25rem 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
