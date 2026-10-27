"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import AppLayout from "@/components/layout/AppLayout";
import { formatRupiah } from "@/lib/utils/time";
import { exportToCSV } from "@/lib/utils/csv";
import slipGajiSeed from "../../../data/seeds/slip_gaji.json";
import profilesSeed from "../../../data/seeds/profiles.json";

// Pemetaan divisi resmi karyawan KarsaHR untuk kalkulasi dinamis rekapitulasi gaji (PRD BR-11)
const EMPLOYEE_DIV_MAP: Record<string, string> = {};
(profilesSeed as any[]).forEach((p) => {
  const divName =
    p["divisi (bantu)"] ||
    (p.divisi_id === "8865d249-d46e-5207-bf19-1b9163f5e954"
      ? "Operasional Gudang"
      : p.divisi_id === "867481d0-6289-54a1-87db-47bb81db15ef"
      ? "Penjualan"
      : p.divisi_id === "400c86ae-d2db-5185-b2d3-db5f60a08649"
      ? "Keuangan"
      : "Human Resources");
  if (p.id) EMPLOYEE_DIV_MAP[p.id] = divName;
  if (p.nik_karyawan) EMPLOYEE_DIV_MAP[p.nik_karyawan] = divName;
});

interface PeriodeConfig {
  key: string;
  label: string;
  start_date: string;
  end_date: string;
  namaBulan: string;
  tepatWaktuPersen: string;
  avgSisaCuti: string;
  pengajuanMenunggu: number;
  statusGaji: string;
  attendanceData: Array<{
    label: string;
    range: string;
    tepatWaktu: number;
    terlambat: number;
    cutiIzin: number;
    tanpaKeterangan: number;
    total: number;
    persenTepat: string;
    heightTepat: string;
    heightTerlambat: string;
    heightCuti: string;
    heightAlpa: string;
    isMonth?: boolean;
  }>;
  leaveDivisionData: Array<{
    divisi: string;
    agustus: number;
    september: number;
    oktober: number;
    total: number;
    heightAgustus: string;
    heightSeptember: string;
    heightOktober: string;
  }>;
  rekapGaji: Array<{
    divisi: string;
    slip_terbit: number;
    pokok_tunjangan: number;
    potongan: number;
    total_diterima: number;
  }>;
  keterlambatan: Array<{
    nama: string;
    divisi: string;
    kali: number;
  }>;
}

const INDO_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const INDO_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const pad = (n: number) => String(n).padStart(2, "0");

// Menghitung kuartal relevan (Q1–Q4) terakhir berdasarkan bulan berjalan
function getRelevantQuarter(year: number, monthIdx: number) {
  if (monthIdx >= 9) {
    // Okt, Nov, Des -> Kuartal 3 (Jul – Sep)
    return {
      key: `${year}-Q3`,
      label: `Kuartal 3 ${year} (Jul – Sep)`,
      namaBulan: `Kuartal 3 ${year}`,
      start_date: `${year}-07-01`,
      end_date: `${year}-09-30`,
    };
  } else if (monthIdx >= 6) {
    // Jul, Agu, Sep -> Kuartal 2 (Apr – Jun)
    return {
      key: `${year}-Q2`,
      label: `Kuartal 2 ${year} (Apr – Jun)`,
      namaBulan: `Kuartal 2 ${year}`,
      start_date: `${year}-04-01`,
      end_date: `${year}-06-30`,
    };
  } else if (monthIdx >= 3) {
    // Apr, Mei, Jun -> Kuartal 1 (Jan – Mar)
    return {
      key: `${year}-Q1`,
      label: `Kuartal 1 ${year} (Jan – Mar)`,
      namaBulan: `Kuartal 1 ${year}`,
      start_date: `${year}-01-01`,
      end_date: `${year}-03-31`,
    };
  } else {
    // Jan, Feb, Mar -> Kuartal 4 tahun sebelumnya
    const prevYear = year - 1;
    return {
      key: `${prevYear}-Q4`,
      label: `Kuartal 4 ${prevYear} (Okt – Des)`,
      namaBulan: `Kuartal 4 ${prevYear}`,
      start_date: `${prevYear}-10-01`,
      end_date: `${prevYear}-12-31`,
    };
  }
}

const SEED_DATA_MAP: Record<string, any> = {
  "2026-10": {
    tepatWaktuPersen: "93,5%",
    avgSisaCuti: "5,4",
    pengajuanMenunggu: 4,
    statusGaji: "0 slip terbit (16 draf belum terbit, khusus HRD)",
    attendanceData: [
      {
        label: "21 Sep",
        range: "21 Sep – 25 Sep",
        tepatWaktu: 65,
        terlambat: 11,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "81,3%",
        heightTepat: "71%",
        heightTerlambat: "13%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "28 Sep",
        range: "28 Sep – 2 Okt",
        tepatWaktu: 73,
        terlambat: 3,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "91,3%",
        heightTepat: "80%",
        heightTerlambat: "4%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "5 Okt",
        range: "5 Okt – 9 Okt",
        tepatWaktu: 66,
        terlambat: 5,
        cutiIzin: 7,
        tanpaKeterangan: 2,
        total: 80,
        persenTepat: "82,5%",
        heightTepat: "72%",
        heightTerlambat: "6%",
        heightCuti: "8%",
        heightAlpa: "3%",
      },
      {
        label: "12 Okt",
        range: "12 Okt – 16 Okt",
        tepatWaktu: 51,
        terlambat: 4,
        cutiIzin: 5,
        tanpaKeterangan: 0,
        total: 60,
        persenTepat: "85,0%",
        heightTepat: "55%",
        heightTerlambat: "5%",
        heightCuti: "6%",
        heightAlpa: "0%",
      },
    ],
    leaveDivisionData: [
      {
        divisi: "Operasional",
        agustus: 4,
        september: 0,
        oktober: 3,
        total: 7,
        heightAgustus: "70%",
        heightSeptember: "0%",
        heightOktober: "55%",
      },
      {
        divisi: "Penjualan",
        agustus: 0,
        september: 2,
        oktober: 3,
        total: 5,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "55%",
      },
      {
        divisi: "Keuangan",
        agustus: 0,
        september: 2,
        oktober: 1,
        total: 3,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "18%",
      },
      {
        divisi: "Human Resources",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
    ],
    rekapGaji: [
      { divisi: "Operasional Gudang", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
      { divisi: "Penjualan", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
      { divisi: "Keuangan", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
      { divisi: "Human Resources", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
    ],
    keterlambatan: [
      { nama: "Rizky Ramadhan", divisi: "Operasional Gudang", kali: 4 },
      { nama: "Yoga Permana", divisi: "Penjualan", kali: 3 },
      { nama: "Andi Wijaya", divisi: "Penjualan", kali: 1 },
      { nama: "Agus Salim", divisi: "Operasional Gudang", kali: 1 },
      { nama: "Siti Nurhaliza", divisi: "Operasional Gudang", kali: 1 },
    ],
  },
  "2026-09": {
    tepatWaktuPersen: "95,2%",
    avgSisaCuti: "6,2",
    pengajuanMenunggu: 0,
    statusGaji: "slip terbit, khusus HRD",
    attendanceData: [
      {
        label: "21 Agu",
        range: "21 Agu – 25 Agu",
        tepatWaktu: 70,
        terlambat: 6,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "87,5%",
        heightTepat: "77%",
        heightTerlambat: "7%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "28 Agu",
        range: "28 Agu – 1 Sep",
        tepatWaktu: 72,
        terlambat: 4,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "90,0%",
        heightTepat: "79%",
        heightTerlambat: "4%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "4 Sep",
        range: "4 Sep – 8 Sep",
        tepatWaktu: 69,
        terlambat: 7,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "86,3%",
        heightTepat: "76%",
        heightTerlambat: "8%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "11 Sep",
        range: "11 Sep – 15 Sep",
        tepatWaktu: 74,
        terlambat: 3,
        cutiIzin: 3,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "92,5%",
        heightTepat: "81%",
        heightTerlambat: "3%",
        heightCuti: "4%",
        heightAlpa: "0%",
      },
    ],
    leaveDivisionData: [
      {
        divisi: "Operasional",
        agustus: 4,
        september: 0,
        oktober: 0,
        total: 4,
        heightAgustus: "70%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
      {
        divisi: "Penjualan",
        agustus: 0,
        september: 2,
        oktober: 0,
        total: 2,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "0%",
      },
      {
        divisi: "Keuangan",
        agustus: 0,
        september: 2,
        oktober: 0,
        total: 2,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "0%",
      },
      {
        divisi: "Human Resources",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
    ],
    rekapGaji: [
      { divisi: "Operasional Gudang", slip_terbit: 6, pokok_tunjangan: 56000000, potongan: 1948000, total_diterima: 54052000 },
      { divisi: "Penjualan", slip_terbit: 5, pokok_tunjangan: 50350000, potongan: 2190000, total_diterima: 48160000 },
      { divisi: "Keuangan", slip_terbit: 3, pokok_tunjangan: 34600000, potongan: 1212000, total_diterima: 33388000 },
      { divisi: "Human Resources", slip_terbit: 2, pokok_tunjangan: 27200000, potongan: 952000, total_diterima: 26248000 },
    ],
    keterlambatan: [
      { nama: "Yoga Permana", divisi: "Penjualan", kali: 4 },
      { nama: "Rizky Ramadhan", divisi: "Operasional Gudang", kali: 3 },
      { nama: "Bayu Setiawan", divisi: "Operasional Gudang", kali: 2 },
      { nama: "Andi Wijaya", divisi: "Penjualan", kali: 1 },
      { nama: "Hendra Gunawan", divisi: "Keuangan", kali: 1 },
    ],
  },
  "2026-08": {
    tepatWaktuPersen: "92,8%",
    avgSisaCuti: "7,1",
    pengajuanMenunggu: 0,
    statusGaji: "slip terbit, khusus HRD",
    attendanceData: [
      {
        label: "21 Jul",
        range: "21 Jul – 25 Jul",
        tepatWaktu: 68,
        terlambat: 7,
        cutiIzin: 5,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "85,0%",
        heightTepat: "75%",
        heightTerlambat: "8%",
        heightCuti: "6%",
        heightAlpa: "0%",
      },
      {
        label: "28 Jul",
        range: "28 Jul – 1 Agu",
        tepatWaktu: 71,
        terlambat: 5,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "88,8%",
        heightTepat: "78%",
        heightTerlambat: "6%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "4 Agu",
        range: "4 Agu – 8 Agu",
        tepatWaktu: 67,
        terlambat: 8,
        cutiIzin: 5,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "83,8%",
        heightTepat: "74%",
        heightTerlambat: "9%",
        heightCuti: "6%",
        heightAlpa: "0%",
      },
      {
        label: "11 Agu",
        range: "11 Agu – 15 Agu",
        tepatWaktu: 73,
        terlambat: 4,
        cutiIzin: 3,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "91,3%",
        heightTepat: "80%",
        heightTerlambat: "4%",
        heightCuti: "4%",
        heightAlpa: "0%",
      },
    ],
    leaveDivisionData: [
      {
        divisi: "Operasional",
        agustus: 4,
        september: 0,
        oktober: 0,
        total: 4,
        heightAgustus: "70%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
      {
        divisi: "Penjualan",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
      {
        divisi: "Keuangan",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
      {
        divisi: "Human Resources",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
    ],
    rekapGaji: [
      { divisi: "Operasional Gudang", slip_terbit: 6, pokok_tunjangan: 56000000, potongan: 1850000, total_diterima: 54150000 },
      { divisi: "Penjualan", slip_terbit: 5, pokok_tunjangan: 50350000, potongan: 2050000, total_diterima: 48300000 },
      { divisi: "Keuangan", slip_terbit: 3, pokok_tunjangan: 34600000, potongan: 1180000, total_diterima: 33420000 },
      { divisi: "Human Resources", slip_terbit: 2, pokok_tunjangan: 27200000, potongan: 920000, total_diterima: 26280000 },
    ],
    keterlambatan: [
      { nama: "Rizky Ramadhan", divisi: "Operasional Gudang", kali: 5 },
      { nama: "Yoga Permana", divisi: "Penjualan", kali: 3 },
      { nama: "Agus Salim", divisi: "Operasional Gudang", kali: 2 },
      { nama: "Siti Nurhaliza", divisi: "Operasional Gudang", kali: 1 },
      { nama: "Maya Anggraini", divisi: "Penjualan", kali: 1 },
    ],
  },
  "2026-Q3": {
    tepatWaktuPersen: "93,8%",
    avgSisaCuti: "6,2",
    pengajuanMenunggu: 4,
    statusGaji: "akumulasi slip terbit, khusus HRD",
    attendanceData: [
      {
        label: "Juli",
        range: "21 Jun – 20 Jul",
        tepatWaktu: 280,
        terlambat: 24,
        cutiIzin: 16,
        tanpaKeterangan: 0,
        total: 320,
        persenTepat: "87,5%",
        heightTepat: "77%",
        heightTerlambat: "7%",
        heightCuti: "4%",
        heightAlpa: "0%",
        isMonth: true,
      },
      {
        label: "Agustus",
        range: "21 Jul – 20 Agu",
        tepatWaktu: 279,
        terlambat: 24,
        cutiIzin: 17,
        tanpaKeterangan: 0,
        total: 320,
        persenTepat: "87,2%",
        heightTepat: "77%",
        heightTerlambat: "7%",
        heightCuti: "5%",
        heightAlpa: "0%",
        isMonth: true,
      },
      {
        label: "September",
        range: "21 Agu – 20 Sep",
        tepatWaktu: 285,
        terlambat: 20,
        cutiIzin: 15,
        tanpaKeterangan: 0,
        total: 320,
        persenTepat: "89,1%",
        heightTepat: "78%",
        heightTerlambat: "6%",
        heightCuti: "4%",
        heightAlpa: "0%",
        isMonth: true,
      },
    ],
    leaveDivisionData: [
      {
        divisi: "Operasional",
        agustus: 4,
        september: 0,
        oktober: 0,
        total: 4,
        heightAgustus: "70%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
      {
        divisi: "Penjualan",
        agustus: 0,
        september: 2,
        oktober: 0,
        total: 2,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "0%",
      },
      {
        divisi: "Keuangan",
        agustus: 0,
        september: 2,
        oktober: 0,
        total: 2,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "0%",
      },
      {
        divisi: "Human Resources",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
    ],
    rekapGaji: [
      { divisi: "Operasional Gudang", slip_terbit: 18, pokok_tunjangan: 168000000, potongan: 5648000, total_diterima: 162352000 },
      { divisi: "Penjualan", slip_terbit: 15, pokok_tunjangan: 151050000, potongan: 6430000, total_diterima: 144620000 },
      { divisi: "Keuangan", slip_terbit: 9, pokok_tunjangan: 103800000, potongan: 3604000, total_diterima: 100196000 },
      { divisi: "Human Resources", slip_terbit: 6, pokok_tunjangan: 81600000, potongan: 2824000, total_diterima: 78776000 },
    ],
    keterlambatan: [
      { nama: "Rizky Ramadhan", divisi: "Operasional Gudang", kali: 12 },
      { nama: "Yoga Permana", divisi: "Penjualan", kali: 10 },
      { nama: "Agus Salim", divisi: "Operasional Gudang", kali: 4 },
      { nama: "Andi Wijaya", divisi: "Penjualan", kali: 3 },
      { nama: "Bayu Setiawan", divisi: "Operasional Gudang", kali: 2 },
    ],
  },
};

// Fallback data generator jika tanggal pengujian bergeser ke bulan/tahun selain 2026
function generateFallbackData(key: string, namaBulan: string, isCurrent: boolean) {
  return {
    tepatWaktuPersen: isCurrent ? "93,5%" : "94,8%",
    avgSisaCuti: "5,4",
    pengajuanMenunggu: isCurrent ? 4 : 0,
    statusGaji: isCurrent ? "0 slip terbit (16 draf belum terbit, khusus HRD)" : "slip terbit, khusus HRD",
    attendanceData: [
      {
        label: "Minggu 1",
        range: "Minggu 1",
        tepatWaktu: 68,
        terlambat: 8,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "85,0%",
        heightTepat: "75%",
        heightTerlambat: "9%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "Minggu 2",
        range: "Minggu 2",
        tepatWaktu: 72,
        terlambat: 4,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "90,0%",
        heightTepat: "79%",
        heightTerlambat: "4%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "Minggu 3",
        range: "Minggu 3",
        tepatWaktu: 70,
        terlambat: 6,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "87,5%",
        heightTepat: "77%",
        heightTerlambat: "7%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
      {
        label: "Minggu 4",
        range: "Minggu 4",
        tepatWaktu: 71,
        terlambat: 5,
        cutiIzin: 4,
        tanpaKeterangan: 0,
        total: 80,
        persenTepat: "88,8%",
        heightTepat: "78%",
        heightTerlambat: "6%",
        heightCuti: "5%",
        heightAlpa: "0%",
      },
    ],
    leaveDivisionData: [
      {
        divisi: "Operasional",
        agustus: 4,
        september: 0,
        oktober: 3,
        total: 7,
        heightAgustus: "70%",
        heightSeptember: "0%",
        heightOktober: "55%",
      },
      {
        divisi: "Penjualan",
        agustus: 0,
        september: 2,
        oktober: 3,
        total: 5,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "55%",
      },
      {
        divisi: "Keuangan",
        agustus: 0,
        september: 2,
        oktober: 1,
        total: 3,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "18%",
      },
      {
        divisi: "Human Resources",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
    ],
    rekapGaji: isCurrent ? [
      { divisi: "Operasional Gudang", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
      { divisi: "Penjualan", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
      { divisi: "Keuangan", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
      { divisi: "Human Resources", slip_terbit: 0, pokok_tunjangan: 0, potongan: 0, total_diterima: 0 },
    ] : [
      { divisi: "Operasional Gudang", slip_terbit: 6, pokok_tunjangan: 56000000, potongan: 1948000, total_diterima: 54052000 },
      { divisi: "Penjualan", slip_terbit: 5, pokok_tunjangan: 50350000, potongan: 2190000, total_diterima: 48160000 },
      { divisi: "Keuangan", slip_terbit: 3, pokok_tunjangan: 34600000, potongan: 1212000, total_diterima: 33388000 },
      { divisi: "Human Resources", slip_terbit: 2, pokok_tunjangan: 27200000, potongan: 952000, total_diterima: 26248000 },
    ],
    keterlambatan: [
      { nama: "Rizky Ramadhan", divisi: "Operasional Gudang", kali: 4 },
      { nama: "Yoga Permana", divisi: "Penjualan", kali: 3 },
      { nama: "Andi Wijaya", divisi: "Penjualan", kali: 1 },
      { nama: "Agus Salim", divisi: "Operasional Gudang", kali: 1 },
      { nama: "Siti Nurhaliza", divisi: "Operasional Gudang", kali: 1 },
    ],
  };
}

function generateFallbackQuarterData() {
  return {
    tepatWaktuPersen: "93,8%",
    avgSisaCuti: "6,2",
    pengajuanMenunggu: 4,
    statusGaji: "akumulasi slip terbit, khusus HRD",
    attendanceData: [
      {
        label: "Bulan 1",
        range: "Bulan 1",
        tepatWaktu: 280,
        terlambat: 24,
        cutiIzin: 16,
        tanpaKeterangan: 0,
        total: 320,
        persenTepat: "87,5%",
        heightTepat: "77%",
        heightTerlambat: "7%",
        heightCuti: "4%",
        heightAlpa: "0%",
        isMonth: true,
      },
      {
        label: "Bulan 2",
        range: "Bulan 2",
        tepatWaktu: 279,
        terlambat: 24,
        cutiIzin: 17,
        tanpaKeterangan: 0,
        total: 320,
        persenTepat: "87,2%",
        heightTepat: "77%",
        heightTerlambat: "7%",
        heightCuti: "5%",
        heightAlpa: "0%",
        isMonth: true,
      },
      {
        label: "Bulan 3",
        range: "Bulan 3",
        tepatWaktu: 285,
        terlambat: 20,
        cutiIzin: 15,
        tanpaKeterangan: 0,
        total: 320,
        persenTepat: "89,1%",
        heightTepat: "78%",
        heightTerlambat: "6%",
        heightCuti: "4%",
        heightAlpa: "0%",
        isMonth: true,
      },
    ],
    leaveDivisionData: [
      {
        divisi: "Operasional",
        agustus: 4,
        september: 0,
        oktober: 0,
        total: 4,
        heightAgustus: "70%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
      {
        divisi: "Penjualan",
        agustus: 0,
        september: 2,
        oktober: 0,
        total: 2,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "0%",
      },
      {
        divisi: "Keuangan",
        agustus: 0,
        september: 2,
        oktober: 0,
        total: 2,
        heightAgustus: "0%",
        heightSeptember: "35%",
        heightOktober: "0%",
      },
      {
        divisi: "Human Resources",
        agustus: 0,
        september: 0,
        oktober: 0,
        total: 0,
        heightAgustus: "0%",
        heightSeptember: "0%",
        heightOktober: "0%",
      },
    ],
    rekapGaji: [
      { divisi: "Operasional Gudang", slip_terbit: 18, pokok_tunjangan: 168000000, potongan: 5648000, total_diterima: 162352000 },
      { divisi: "Penjualan", slip_terbit: 15, pokok_tunjangan: 151050000, potongan: 6430000, total_diterima: 144620000 },
      { divisi: "Keuangan", slip_terbit: 9, pokok_tunjangan: 103800000, potongan: 3604000, total_diterima: 100196000 },
      { divisi: "Human Resources", slip_terbit: 6, pokok_tunjangan: 81600000, potongan: 2824000, total_diterima: 78776000 },
    ],
    keterlambatan: [
      { nama: "Rizky Ramadhan", divisi: "Operasional Gudang", kali: 12 },
      { nama: "Yoga Permana", divisi: "Penjualan", kali: 10 },
      { nama: "Agus Salim", divisi: "Operasional Gudang", kali: 4 },
      { nama: "Andi Wijaya", divisi: "Penjualan", kali: 3 },
      { nama: "Bayu Setiawan", divisi: "Operasional Gudang", kali: 2 },
    ],
  };
}

// Generate daftar periode secara dinamis dari tanggal acuan saat ini (current date)
function generateDynamicPeriods(currentDate: Date = new Date()): PeriodeConfig[] {
  const Y = currentDate.getFullYear();
  const M = currentDate.getMonth(); // 0..11
  const D = currentDate.getDate();

  const periods: PeriodeConfig[] = [];

  // Hitung 3 siklus bulanan:
  // i = 0: Bulan Berjalan (N)
  // i = 1: Bulan Sebelumnya (N-1)
  // i = 2: Dua Bulan Sebelumnya (N-2)
  for (let i = 0; i < 3; i++) {
    const targetDate = new Date(Y, M - i, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    const prevDate = new Date(targetYear, targetMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const startDateStr = `${prevYear}-${pad(prevMonth + 1)}-21`;
    const startLabel = `21 ${INDO_MONTHS_SHORT[prevMonth]}`;

    let endDateStr = "";
    let endLabel = "";

    if (i === 0) {
      // Bulan Berjalan: Cut-off aktif dari 21 bulan lalu hingga hari ini / 20 bulan ini
      const isOngoing = D < 20 || (targetYear === 2026 && targetMonth === 9);
      const effectiveDay = (targetYear === 2026 && targetMonth === 9) ? 15 : (D <= 20 ? D : 20);
      endDateStr = `${targetYear}-${pad(targetMonth + 1)}-${pad(effectiveDay)}`;
      endLabel = isOngoing
        ? `${effectiveDay} ${INDO_MONTHS_SHORT[targetMonth]} - Berjalan`
        : `${effectiveDay} ${INDO_MONTHS_SHORT[targetMonth]}`;
    } else {
      // Bulan Sebelumnya (N-1 & N-2): Cut-off penuh tanggal 20
      endDateStr = `${targetYear}-${pad(targetMonth + 1)}-20`;
      endLabel = `20 ${INDO_MONTHS_SHORT[targetMonth]}`;
    }

    const key = `${targetYear}-${pad(targetMonth + 1)}`;
    const label = `${INDO_MONTHS[targetMonth]} ${targetYear} (${startLabel} – ${endLabel})`;
    const namaBulan = `${INDO_MONTHS[targetMonth]} ${targetYear}`;

    const baseData = SEED_DATA_MAP[key] || generateFallbackData(key, namaBulan, i === 0);

    periods.push({
      key,
      label,
      start_date: startDateStr,
      end_date: endDateStr,
      namaBulan,
      ...baseData,
    });
  }

  // Tambahkan Kuartal Relevan Terakhir
  const q = getRelevantQuarter(Y, M);
  const qData = SEED_DATA_MAP[q.key] || generateFallbackQuarterData();
  periods.push({
    ...q,
    ...qData,
  });

  return periods;
}

// Deterministic static reference date for initial SSR render (prevents Next.js prerender dynamic date error)
const STATIC_BASE_DATE = new Date("2026-10-15T00:00:00Z");
const INITIAL_PERIODS = generateDynamicPeriods(STATIC_BASE_DATE);

export default function LaporanPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [dynamicPeriods, setDynamicPeriods] = useState<PeriodeConfig[]>(INITIAL_PERIODS);
  const [selectedPeriodeKey, setSelectedPeriodeKey] = useState("2026-10");
  const [divisiFilter, setDivisiFilter] = useState("Semua Divisi");
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  const [hoveredDivisiIdx, setHoveredDivisiIdx] = useState<number | null>(null);
  const [liveSlips, setLiveSlips] = useState<any[]>(slipGajiSeed);

  // Sinkronisasi data slip gaji dari localStorage & storage event
  useEffect(() => {
    const syncSlips = () => {
      try {
        const stored = localStorage.getItem("karsahr_slip_gaji_store");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLiveSlips(parsed);
            return;
          }
        }
      } catch {}
      setLiveSlips(slipGajiSeed);
    };

    syncSlips();
    window.addEventListener("storage", syncSlips);
    return () => window.removeEventListener("storage", syncSlips);
  }, []);

  // Guard: Hanya peran HRD yang boleh mengakses laporan & rekap gaji (PRD BR-11 & NFR-3)
  useEffect(() => {
    if (!loading && user && user.peran?.toLowerCase() !== "hrd") {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Recalculate dynamically on client-side mount (safely deferred in useEffect)
  useEffect(() => {
    try {
      const livePeriods = generateDynamicPeriods(new Date());
      setDynamicPeriods(livePeriods);
    } catch {
      // fallback to initial
    }
  }, []);

  const activePeriod = useMemo(() => {
    return dynamicPeriods.find((p) => p.key === selectedPeriodeKey) || dynamicPeriods[0];
  }, [dynamicPeriods, selectedPeriodeKey]);

  // Sinkronisasi query params ke URL browser (start_date, end_date, divisi)
  const syncQueryParams = (startDate: string, endDate: string, divisi: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("start_date", startDate);
      url.searchParams.set("end_date", endDate);
      if (divisi && divisi !== "Semua Divisi") {
        url.searchParams.set("divisi", divisi);
      } else {
        url.searchParams.delete("divisi");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Baca query parameter awal saat halaman pertama kali dibuka
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const startParam = params.get("start_date");
      const endParam = params.get("end_date");
      const divParam = params.get("divisi");

      if (startParam && endParam) {
        const found = dynamicPeriods.find(
          (p) => p.start_date === startParam && p.end_date === endParam
        );
        if (found) {
          setSelectedPeriodeKey(found.key);
        }
      } else {
        syncQueryParams(activePeriod.start_date, activePeriod.end_date, divisiFilter);
      }

      if (divParam) {
        setDivisiFilter(divParam);
      }
    }
  }, [dynamicPeriods]);

  const handlePeriodeChange = (newKey: string) => {
    setSelectedPeriodeKey(newKey);
    const target = dynamicPeriods.find((p) => p.key === newKey) || dynamicPeriods[0];
    syncQueryParams(target.start_date, target.end_date, divisiFilter);
  };

  const handleDivisiChange = (newDivisi: string) => {
    setDivisiFilter(newDivisi);
    syncQueryParams(activePeriod.start_date, activePeriod.end_date, newDivisi);
  };

  // Hitung rekap gaji dinamis per divisi HANYA untuk slip yang berstatus 'terbit' (PRD BR-11 & Bab 9 butir 4)
  const dynamicSalaryData = useMemo(() => {
    const DIVISIONS = ["Operasional Gudang", "Penjualan", "Keuangan", "Human Resources"];
    const periodKey = selectedPeriodeKey;

    // Filter slip yang masuk dalam periode terpilih
    const matchingSlips = liveSlips.filter((s) => {
      if (!s.periode) return false;
      if (periodKey.includes("Q")) {
        const [y, q] = periodKey.split("-");
        if (!s.periode.startsWith(y)) return false;
        const m = parseInt(s.periode.split("-")[1], 10);
        if (q === "Q1") return m >= 1 && m <= 3;
        if (q === "Q2") return m >= 4 && m <= 6;
        if (q === "Q3") return m >= 7 && m <= 9;
        if (q === "Q4") return m >= 10 && m <= 12;
        return false;
      }
      return s.periode.startsWith(periodKey);
    });

    // PRD BR-11: Rekap gaji HANYA menghitung slip yang berstatus 'terbit'
    const publishedSlips = matchingSlips.filter((s) => s.status === "terbit");
    const draftSlips = matchingSlips.filter((s) => s.status !== "terbit");

    const rekap = DIVISIONS.map((divName) => {
      const divSlips = publishedSlips.filter((s) => {
        const empDiv = EMPLOYEE_DIV_MAP[s.karyawan_id] || "";
        return empDiv.toLowerCase().includes(divName.toLowerCase()) || divName.toLowerCase().includes(empDiv.toLowerCase());
      });

      const slip_terbit = divSlips.length;
      const pokok_tunjangan = divSlips.reduce((acc, s) => acc + (Number(s.gaji_pokok) || 0) + (Number(s.tunjangan) || 0), 0);
      const potongan = divSlips.reduce((acc, s) => acc + (Number(s.potongan) || 0), 0);
      const total_diterima = divSlips.reduce((acc, s) => acc + (Number(s.total_diterima) || 0), 0);

      return {
        divisi: divName,
        slip_terbit,
        pokok_tunjangan,
        potongan,
        total_diterima,
      };
    });

    let statusGaji = "";
    if (publishedSlips.length === 0 && draftSlips.length > 0) {
      statusGaji = `0 slip terbit (${draftSlips.length} draf belum dihitung) - khusus HRD`;
    } else if (publishedSlips.length > 0 && draftSlips.length > 0) {
      statusGaji = `${publishedSlips.length} slip terbit (${draftSlips.length} draf belum dihitung) - khusus HRD`;
    } else if (publishedSlips.length > 0) {
      statusGaji = `${publishedSlips.length} slip terbit, khusus HRD`;
    } else {
      statusGaji = "0 slip terbit, khusus HRD";
    }

    return {
      rekap,
      statusGaji,
      publishedCount: publishedSlips.length,
      draftCount: draftSlips.length,
    };
  }, [liveSlips, selectedPeriodeKey]);

  const filteredRekapGaji = useMemo(() => {
    const baseRekap = dynamicSalaryData.rekap;
    if (divisiFilter === "Semua Divisi") return baseRekap;
    return baseRekap.filter((r) =>
      r.divisi.toLowerCase().includes(divisiFilter.toLowerCase()) ||
      (divisiFilter === "Operasional" && r.divisi.includes("Operasional")) ||
      (divisiFilter === "HRD" && r.divisi.includes("Human"))
    );
  }, [divisiFilter, dynamicSalaryData.rekap]);

  const filteredKeterlambatan = useMemo(() => {
    if (divisiFilter === "Semua Divisi") return activePeriod.keterlambatan;
    return activePeriod.keterlambatan.filter((k) =>
      k.divisi.toLowerCase().includes(divisiFilter.toLowerCase()) ||
      (divisiFilter === "Operasional" && k.divisi.includes("Operasional")) ||
      (divisiFilter === "HRD" && k.divisi.includes("Human"))
    );
  }, [divisiFilter, activePeriod]);

  // Hitung persentase kehadiran tepat waktu dinamis dari data mingguan aktif
  const dynamicTepatWaktuPersen = useMemo(() => {
    if (!activePeriod?.attendanceData || activePeriod.attendanceData.length === 0) {
      return activePeriod?.tepatWaktuPersen || "0%";
    }
    const totalTepat = activePeriod.attendanceData.reduce((s: number, w: any) => s + (w.tepatWaktu || 0), 0);
    const totalSemua = activePeriod.attendanceData.reduce((s: number, w: any) => s + (w.total || 0), 0);
    if (totalSemua === 0) return activePeriod.tepatWaktuPersen;
    return ((totalTepat / totalSemua) * 100).toFixed(1).replace(".", ",") + "%";
  }, [activePeriod]);

  const handleExportCSV = () => {
    const exportData = filteredRekapGaji.map((item) => ({
      Divisi: item.divisi,
      "Slip Terbit": item.slip_terbit,
      "Gaji Pokok & Tunjangan": item.pokok_tunjangan,
      Potongan: item.potongan,
      "Total Diterima": item.total_diterima,
    }));
    exportToCSV(
      `Laporan_Rekap_Gaji_${activePeriod.start_date}_sd_${activePeriod.end_date}_${divisiFilter.replace(/\s+/g, "_")}`,
      exportData
    );
  };

  if (loading || !user || user.peran?.toLowerCase() !== "hrd") {
    return null;
  }

  return (
    <>
      <div className="space-y-6 laporan-container">
        {/* 1. HEADER & FILTER TOOLBAR */}
        {/* 1. HEADER & FILTER TOOLBAR */}
        <div className="laporan-header-wrap">
          <div className="laporan-title-col">
            <h1 className="page-header-title text-2xl font-bold text-slate-800">Laporan Kehadiran, Cuti, dan Gaji</h1>
            <p className="page-header-sub text-sm text-slate-500">
              Analisis performa presensi, pemanfaatan cuti, dan rekapitulasi penggajian periode {activePeriod.label}.
            </p>
          </div>
          <div className="laporan-filter-toolbar">
            {/* Dropdown Periode */}
            <div className="filter-group">
              <label className="filter-label">Periode</label>
              <select
                value={selectedPeriodeKey}
                onChange={(e) => handlePeriodeChange(e.target.value)}
                className="filter-select"
              >
                {/* 3 Siklus Bulanan Dinamis: Bulan Berjalan (N), N-1, N-2 */}
                {dynamicPeriods.slice(0, 3).map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
                <hr />
                {/* Kuartal Relevan Terakhir Dinamis */}
                {dynamicPeriods.slice(3).map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown Divisi */}
            <div className="filter-group">
              <label className="filter-label">Divisi</label>
              <select
                value={divisiFilter}
                onChange={(e) => handleDivisiChange(e.target.value)}
                className="filter-select"
              >
                <option value="Semua Divisi">Semua Divisi</option>
                <option value="Penjualan">Penjualan</option>
                <option value="Operasional">Operasional</option>
                <option value="Keuangan">Keuangan</option>
                <option value="HRD">HRD</option>
              </select>
            </div>

            {/* Tombol Unduh CSV */}
            <button
              onClick={handleExportCSV}
              className="btn-export-csv"
              title="Unduh rekap data laporan ke berkas CSV"
            >
              <svg
                className="export-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* 2. KPI CARDS (WAJIB 4 KOLOM HORIZONTAL DI DESKTOP) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 kpi-grid">
          {/* Card 1: Karyawan Aktif */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm metric-card">
            <div className="metric-title">KARYAWAN AKTIF</div>
            <div className="metric-highlight-row">
              <span className="metric-big-number">15</span>
              <span className="metric-sublabel">karyawan</span>
            </div>
          </div>

          {/* Card 2: Tepat Waktu Periode */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm metric-card">
            <div className="metric-title">TEPAT WAKTU {activePeriod.namaBulan.toUpperCase()}</div>
            <div className="metric-highlight-row">
              <span className="metric-big-number">{dynamicTepatWaktuPersen}</span>
            </div>
          </div>

          {/* Card 3: Rata-Rata Sisa Cuti */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm metric-card">
            <div className="metric-title">RATA-RATA SISA CUTI</div>
            <div className="metric-highlight-row">
              <span className="metric-big-number">{activePeriod.avgSisaCuti}</span>
              <span className="metric-sublabel">hari</span>
            </div>
          </div>

          {/* Card 4: Pengajuan Menunggu */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm metric-card">
            <div className="metric-title">PENGAJUAN MENUNGGU</div>
            <div className="metric-highlight-row">
              <span className="metric-big-number">{activePeriod.pengajuanMenunggu}</span>
              <span className="metric-sublabel">pengajuan</span>
            </div>
          </div>
        </div>

        {/* 3. CHARTS / GRAFIK (WAJIB 2 KOLOM BERDAMPINGAN DENGAN TOOLTIP INTERAKTIF) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 two-col-grid">
          {/* Grafik 1: Kehadiran per minggu */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-visible">
            <div className="chart-header-block mb-3">
              <h3 className="section-title">Kehadiran per minggu (orang-hari)</h3>
              <p className="chart-sub-caption">Data presensi mingguan · Skala 0–80 orang-hari</p>
            </div>
            
            <div className="chart-body-layout">
              <div className="chart-canvas-wrapper">
                {/* Sumbu Y (Angka Skala 0-80) */}
                <div className="chart-y-axis" aria-hidden="true">
                  <span className="y-tick-label">80</span>
                  <span className="y-tick-label">60</span>
                  <span className="y-tick-label">40</span>
                  <span className="y-tick-label">20</span>
                  <span className="y-tick-label">0</span>
                </div>

                {/* Area Plot Batang */}
                <div className="chart-plot-area">
                  {/* Garis Bantu Horizontal (Gridlines) */}
                  <div className="chart-gridlines" aria-hidden="true">
                    <div className="grid-line" style={{ bottom: "100%" }} />
                    <div className="grid-line" style={{ bottom: "75%" }} />
                    <div className="grid-line" style={{ bottom: "50%" }} />
                    <div className="grid-line" style={{ bottom: "25%" }} />
                    <div className="grid-line baseline" style={{ bottom: "0%" }} />
                  </div>

                  {/* Grid Kolom Batang */}
                  <div className="chart-columns-grid">
                  {activePeriod.attendanceData.map((w, idx) => (
                    <div
                      key={idx}
                      className="bar-col"
                      onMouseEnter={() => setHoveredWeekIdx(idx)}
                      onMouseLeave={() => setHoveredWeekIdx(null)}
                    >
                      {/* Tooltip Interaktif Persis Standar Dashboard (Screenshot) */}
                      {hoveredWeekIdx === idx && (
                        <div
                          className={`chart-tooltip-popover ${
                            idx === 0 ? "col-start" : idx === activePeriod.attendanceData.length - 1 ? "col-end" : ""
                          }`}
                          role="tooltip"
                          style={{
                            left: idx === 0 ? "0" : idx === activePeriod.attendanceData.length - 1 ? "auto" : "50%",
                            right: idx === activePeriod.attendanceData.length - 1 ? "0" : "auto",
                            transform: idx === 0 || idx === activePeriod.attendanceData.length - 1 ? "none" : "translateX(-50%)",
                          }}
                        >
                          <div className="tooltip-header">
                            <span className="tooltip-title">{w.isMonth ? w.label : `Minggu ${idx + 1}`}</span>
                            <span className="tooltip-range">{w.range}</span>
                          </div>
                          <div className="tooltip-body">
                            <div className="tooltip-row">
                              <span className="tooltip-dot-wrap">
                                <span className="tooltip-dot tepat-waktu"></span>
                                Hadir Tepat Waktu:
                              </span>
                              <strong className="tooltip-val">{w.tepatWaktu}</strong>
                            </div>
                            <div className="tooltip-row">
                              <span className="tooltip-dot-wrap">
                                <span className="tooltip-dot terlambat"></span>
                                Terlambat:
                              </span>
                              <strong className="tooltip-val">{w.terlambat}</strong>
                            </div>
                            <div className="tooltip-row">
                              <span className="tooltip-dot-wrap">
                                <span className="tooltip-dot cuti-izin"></span>
                                Cuti, Sakit, Izin:
                              </span>
                              <strong className="tooltip-val">{w.cutiIzin}</strong>
                            </div>
                            {w.tanpaKeterangan > 0 && (
                              <div className="tooltip-row">
                                <span className="tooltip-dot-wrap">
                                  <span className="tooltip-dot tanpa-keterangan"></span>
                                  Tanpa Keterangan:
                                </span>
                                <strong className="tooltip-val">{w.tanpaKeterangan}</strong>
                              </div>
                            )}
                            <div className="tooltip-divider" />
                            <div className="tooltip-footer-row">
                              <span>Total: <strong>{w.total} orang-hari</strong></span>
                              <span>Tepat: <strong>{w.persenTepat}</strong></span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Batang-batang Berdampingan Satu-Satu */}
                      <div className="week-grouped-bars-laporan">
                        {/* 1. Tepat Waktu */}
                        <div className="laporan-single-col">
                          <span className="laporan-bar-val">{w.tepatWaktu}</span>
                          <div
                            className="laporan-bar-pill bar-tepat-waktu"
                            style={{ height: `${Math.min(100, Math.max(6, (w.tepatWaktu / 80) * 100))}%` }}
                            title={`Hadir Tepat Waktu: ${w.tepatWaktu}`}
                          />
                        </div>

                        {/* 2. Terlambat */}
                        <div className="laporan-single-col">
                          <span className="laporan-bar-val">{w.terlambat}</span>
                          <div
                            className="laporan-bar-pill bar-terlambat"
                            style={{ height: `${Math.min(100, Math.max(6, (w.terlambat / 80) * 100))}%` }}
                            title={`Terlambat: ${w.terlambat}`}
                          />
                        </div>

                        {/* 3. Cuti & Izin */}
                        <div className="laporan-single-col">
                          <span className="laporan-bar-val">{w.cutiIzin}</span>
                          <div
                            className="laporan-bar-pill bar-cuti-izin"
                            style={{ height: `${Math.min(100, Math.max(6, (w.cutiIzin / 80) * 100))}%` }}
                            title={`Cuti & Izin: ${w.cutiIzin}`}
                          />
                        </div>

                        {/* 4. Tanpa Keterangan (jika ada) */}
                        {w.tanpaKeterangan > 0 && (
                          <div className="laporan-single-col">
                            <span className="laporan-bar-val">{w.tanpaKeterangan}</span>
                            <div
                              className="laporan-bar-pill bar-tanpa-keterangan"
                              style={{ height: `${Math.min(100, Math.max(6, (w.tanpaKeterangan / 80) * 100))}%` }}
                              title={`Tanpa Keterangan: ${w.tanpaKeterangan}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>

              {/* Sumbu X (Label di bawah garis dasar) */}
              <div className="chart-x-axis-row">
                {activePeriod.attendanceData.map((w, idx) => (
                  <div key={idx} className="x-axis-col-label">
                    <span className="x-axis-title">{w.isMonth ? w.label : `Minggu ${idx + 1}`}</span>
                    <span className="x-axis-sub">{w.label}</span>
                  </div>
                ))}
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
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-visible">
            <div className="chart-header-block mb-3">
              <h3 className="section-title">Hari cuti, sakit, izin disetujui per divisi</h3>
              <p className="chart-sub-caption">Pemanfaatan izin per divisi · Skala 0–8 hari kerja</p>
            </div>

            <div className="chart-body-layout">
              <div className="chart-canvas-wrapper">
                {/* Sumbu Y (Angka Skala 0-8) */}
                <div className="chart-y-axis" aria-hidden="true">
                  <span className="y-tick-label">8</span>
                  <span className="y-tick-label">6</span>
                  <span className="y-tick-label">4</span>
                  <span className="y-tick-label">2</span>
                  <span className="y-tick-label">0</span>
                </div>

                {/* Area Plot Batang */}
                <div className="chart-plot-area">
                  {/* Garis Bantu Horizontal (Gridlines) */}
                  <div className="chart-gridlines" aria-hidden="true">
                    <div className="grid-line" style={{ bottom: "100%" }} />
                    <div className="grid-line" style={{ bottom: "75%" }} />
                    <div className="grid-line" style={{ bottom: "50%" }} />
                    <div className="grid-line" style={{ bottom: "25%" }} />
                    <div className="grid-line baseline" style={{ bottom: "0%" }} />
                  </div>

                  {/* Grid Kolom Batang */}
                  <div className="chart-columns-grid">
                  {activePeriod.leaveDivisionData.map((d, idx) => (
                    <div
                      key={idx}
                      className="bar-col divisi-col"
                      onMouseEnter={() => setHoveredDivisiIdx(idx)}
                      onMouseLeave={() => setHoveredDivisiIdx(null)}
                    >
                      {/* Tooltip Interaktif Persis Standar Dashboard (Screenshot) */}
                      {hoveredDivisiIdx === idx && (
                        <div
                          className={`chart-tooltip-popover ${
                            idx === 0 ? "col-start" : idx === activePeriod.leaveDivisionData.length - 1 ? "col-end" : ""
                          }`}
                          role="tooltip"
                          style={{
                            left: idx === 0 ? "0" : idx === activePeriod.leaveDivisionData.length - 1 ? "auto" : "50%",
                            right: idx === activePeriod.leaveDivisionData.length - 1 ? "0" : "auto",
                            transform: idx === 0 || idx === activePeriod.leaveDivisionData.length - 1 ? "none" : "translateX(-50%)",
                          }}
                        >
                          <div className="tooltip-header">
                            <span className="tooltip-title">{d.divisi}</span>
                            <span className="tooltip-range">Hari Disetujui</span>
                          </div>
                          <div className="tooltip-body">
                            <div className="tooltip-row">
                              <span className="tooltip-dot-wrap">
                                <span className="tooltip-dot agustus"></span>
                                Agustus:
                              </span>
                              <strong className="tooltip-val">{d.agustus}</strong>
                            </div>
                            <div className="tooltip-row">
                              <span className="tooltip-dot-wrap">
                                <span className="tooltip-dot september"></span>
                                September:
                              </span>
                              <strong className="tooltip-val">{d.september}</strong>
                            </div>
                            <div className="tooltip-row">
                              <span className="tooltip-dot-wrap">
                                <span className="tooltip-dot oktober"></span>
                                Oktober:
                              </span>
                              <strong className="tooltip-val">{d.oktober}</strong>
                            </div>
                            <div className="tooltip-divider" />
                            <div className="tooltip-footer-row">
                              <span>Total Disetujui:</span>
                              <strong>{d.total} hari</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Batang-batang Berdampingan Selaras dengan Chart Kehadiran */}
                      <div className="week-grouped-bars-laporan">
                        {/* 1. Agustus */}
                        <div className="laporan-single-col">
                          <span className="laporan-bar-val">{d.agustus}</span>
                          <div
                            className="laporan-bar-pill bar-agustus"
                            style={{ height: `${Math.min(100, Math.max(6, (d.agustus / 8) * 100))}%` }}
                            title={`Agustus: ${d.agustus} hari`}
                          />
                        </div>

                        {/* 2. September */}
                        <div className="laporan-single-col">
                          <span className="laporan-bar-val">{d.september}</span>
                          <div
                            className="laporan-bar-pill bar-september"
                            style={{ height: `${Math.min(100, Math.max(6, (d.september / 8) * 100))}%` }}
                            title={`September: ${d.september} hari`}
                          />
                        </div>

                        {/* 3. Oktober */}
                        <div className="laporan-single-col">
                          <span className="laporan-bar-val">{d.oktober}</span>
                          <div
                            className="laporan-bar-pill bar-oktober"
                            style={{ height: `${Math.min(100, Math.max(6, (d.oktober / 8) * 100))}%` }}
                            title={`Oktober: ${d.oktober} hari`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>

              {/* Sumbu X (Label di bawah garis dasar) */}
              <div className="chart-x-axis-row">
                {activePeriod.leaveDivisionData.map((d, idx) => (
                  <div key={idx} className="x-axis-col-label">
                    <span className="x-axis-title">{d.divisi}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-box agustus"></span> Agustus</span>
                <span className="legend-item"><span className="legend-box september"></span> September</span>
                <span className="legend-item"><span className="legend-box oktober"></span> Oktober</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. TABLES (WAJIB 2 KOLOM BERDAMPINGAN) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 two-col-grid">
          {/* Tabel Paling sering terlambat */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="section-title">Paling sering terlambat ({activePeriod.namaBulan})</h3>
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
                  {filteredKeterlambatan.length > 0 ? (
                    filteredKeterlambatan.map((k, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold">{k.nama}</td>
                        <td>{k.divisi}</td>
                        <td className="font-semibold">{k.kali}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "1rem", color: "#94a3b8" }}>
                        Tidak ada data keterlambatan untuk filter divisi ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel Rekap gaji */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="section-title">Rekap gaji {activePeriod.namaBulan} ({dynamicSalaryData.statusGaji || activePeriod.statusGaji})</h3>
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
                  {filteredRekapGaji.length > 0 ? (
                    filteredRekapGaji.map((r, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold">{r.divisi}</td>
                        <td>{r.slip_terbit}</td>
                        <td>{formatRupiah(r.pokok_tunjangan)}</td>
                        <td>{formatRupiah(r.potongan)}</td>
                        <td className="font-semibold">{formatRupiah(r.total_diterima)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "#94a3b8" }}>
                        Tidak ada data gaji untuk filter divisi ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {dynamicSalaryData.draftCount > 0 && (
              <div
                style={{
                  marginTop: "0.875rem",
                  padding: "0.75rem 0.875rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px dashed #cbd5e1",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.625rem",
                  fontSize: "0.75rem",
                  color: "#64748b",
                  lineHeight: 1.45,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: "2px" }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <strong style={{ color: "#334155" }}>Kebijakan Penggajian:</strong> Rekap gaji hanya menghitung slip yang berstatus <strong>Terbit</strong>. Sebanyak {dynamicSalaryData.draftCount} slip pada periode {activePeriod.namaBulan} masih berstatus draf sehingga tidak dihitung ke dalam rekapitulasi penggajian per divisi.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* --- Container --- */
        .laporan-container {
          width: 100%;
          box-sizing: border-box;
        }

        /* --- Grid System --- */
        .grid {
          display: grid !important;
        }

        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
        }

        .gap-3 {
          gap: 0.75rem !important;
        }

        .gap-4 {
          gap: 1rem !important;
        }

        .gap-6 {
          gap: 1.5rem !important;
        }

        .space-y-6 > * + * {
          margin-top: 1.5rem !important;
        }

        .p-6 {
          padding: 1.5rem !important;
        }

        .p-5 {
          padding: 1.25rem !important;
        }

        @media (min-width: 640px) {
          .sm\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (min-width: 1024px) {
          .lg\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .lg\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }

        /* KPI Grid 4 Kolom di Desktop */
        .kpi-grid {
          display: grid !important;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 1rem;
        }
        @media (min-width: 640px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (min-width: 1024px) {
          .kpi-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }

        /* Dua Kolom Grid di Desktop */
        .two-col-grid {
          display: grid !important;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 1.5rem;
        }
        @media (min-width: 1024px) {
          .two-col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        /* --- Flexbox Utilities --- */
        .flex {
          display: flex !important;
        }

        .flex-col {
          flex-direction: column !important;
        }

        .flex-wrap {
          flex-wrap: wrap !important;
        }

        .items-center {
          align-items: center !important;
        }

        .justify-between {
          justify-content: space-between !important;
        }

        @media (min-width: 768px) {
          .md\\:flex-row {
            flex-direction: row !important;
          }
          .md\\:items-center {
            align-items: center !important;
          }
          .md\\:justify-between {
            justify-content: space-between !important;
          }
        }

        /* --- Typography & Header --- */
        .page-header-title {
          font-size: 1.3125rem !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          letter-spacing: -0.02em !important;
          line-height: 1.25 !important;
          margin: 0;
        }

        .page-header-sub {
          font-size: 0.8125rem !important;
          color: #64748b !important;
          margin-top: 0.25rem !important;
          line-height: 1.4 !important;
        }

        .text-2xl {
          font-size: 1.3125rem;
          line-height: 1.25;
          letter-spacing: -0.02em;
        }

        .font-bold {
          font-weight: 700;
        }

        .text-slate-800 {
          color: #1e293b;
        }

        .text-sm {
          font-size: 0.8125rem;
          line-height: 1.4;
        }

        .text-slate-500 {
          color: #64748b;
        }

        /* --- Metric Cards & General Cards --- */
        .metric-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          box-sizing: border-box;
        }

        .rounded-xl {
          border-radius: 0.75rem;
        }

        .border {
          border-width: 1px;
          border-style: solid;
        }

        .border-slate-200 {
          border-color: #e2e8f0;
        }

        .bg-white {
          background-color: #ffffff;
        }

        .shadow-sm {
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .metric-title {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .metric-highlight-row {
          display: flex;
          align-items: baseline;
          gap: 0.375rem;
          margin-top: 0.35rem;
        }

        .metric-big-number {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
        }

        .metric-sublabel {
          font-size: 0.8125rem;
          color: #64748b;
          font-weight: 500;
        }

        /* --- Filter Toolbar & Export Button --- */
        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .filter-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
        }

        .filter-select {
          height: 38px;
          padding: 0 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          background-color: #ffffff;
          color: #1e293b;
          outline: none;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 0.15s ease;
        }

        .filter-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 1px #2563eb;
        }

        .filter-select hr {
          border: 0;
          border-top: 1px solid #cbd5e1;
          margin: 4px 0;
        }

        .btn-export-csv {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          gap: 0.5rem;
          height: 38px;
          padding: 0 1rem;
          border: 1.5px solid #2563eb;
          background-color: #ffffff;
          color: #2563eb;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease-in-out;
        }

        .btn-export-csv span {
          white-space: nowrap !important;
          display: inline-block !important;
          line-height: 1 !important;
        }

        .btn-export-csv:hover {
          background-color: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .btn-export-csv:active {
          background-color: #1d4ed8;
          border-color: #1d4ed8;
          color: #ffffff;
        }

        .export-icon {
          display: inline-block !important;
          flex-shrink: 0 !important;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .chart-sub-caption {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0.2rem 0 0 0;
        }

        .chart-body-layout {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          position: relative;
          overflow: visible;
        }

        .chart-canvas-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 0.85rem;
          padding: 1.25rem 0.5rem 0 0;
          position: relative;
          overflow: visible;
        }

        /* Sumbu Y (Kiri) */
        .chart-y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-end;
          height: 160px;
          width: 24px;
          flex-shrink: 0;
          padding-bottom: 2px;
          user-select: none;
        }

        .y-tick-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #94a3b8;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        /* Area Plot Batang */
        .chart-plot-area {
          flex: 1;
          position: relative;
          height: 160px;
          overflow: visible;
        }

        /* Gridlines Horizontal */
        .chart-gridlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .grid-line {
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px dashed #e2e8f0;
        }

        .grid-line.baseline {
          bottom: 0 !important;
          border-top: none;
          border-bottom: 2px solid #cbd5e1;
        }

        /* Grid 4 Kolom Batang */
        .chart-columns-grid {
          position: relative;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          z-index: 2;
        }

        .bar-col,
        .divisi-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          position: relative;
          cursor: pointer;
          border-radius: 6px;
          padding: 0.25rem 0.25rem 0;
          transition: background-color 0.2s ease;
        }

        .bar-col:hover,
        .divisi-col:hover {
          background-color: rgba(241, 245, 249, 0.65);
        }

        /* Sumbu X (Label di bawah garis dasar) */
        .chart-x-axis-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-left: calc(24px + 0.85rem);
          padding-top: 0.65rem;
          border-top: 1px solid #f1f5f9;
        }

        .x-axis-col-label {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .x-axis-title {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.25;
        }

        .x-axis-sub {
          font-size: 0.625rem;
          color: #64748b;
        }

        .bar-col .week-grouped-bars-laporan,
        .bar-col .stacked-bar,
        .divisi-col .group-bars {
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .bar-col:hover .week-grouped-bars-laporan,
        .bar-col:hover .stacked-bar,
        .divisi-col:hover .group-bars {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        /* Tooltip Persis Standar Dashboard (Screenshot) */
        .chart-tooltip-popover {
          position: absolute;
          bottom: calc(100% + 14px);
          background-color: #0f172a;
          color: #ffffff;
          border-radius: 8px;
          padding: 0.65rem 0.85rem;
          box-shadow: 0 10px 20px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
          z-index: 100;
          min-width: 195px;
          pointer-events: none;
          animation: fadeIn 0.15s ease;
          box-sizing: border-box;
          white-space: nowrap;
        }

        .chart-tooltip-popover::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }

        .chart-tooltip-popover.col-start::after {
          left: 24px;
          transform: none;
        }

        .chart-tooltip-popover.col-end::after {
          left: auto;
          right: 24px;
          transform: none;
        }

        .tooltip-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          padding-bottom: 0.35rem;
          margin-bottom: 0.45rem;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .tooltip-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #ffffff;
        }

        .tooltip-range {
          font-size: 0.625rem;
          color: #94a3b8;
        }

        .tooltip-body {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .tooltip-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.6875rem;
        }

        .tooltip-dot-wrap {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: #cbd5e1;
        }

        .tooltip-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          display: inline-block;
        }

        .tooltip-dot.tepat-waktu { background-color: #2563eb; }
        .tooltip-dot.terlambat { background-color: #f59e0b; }
        .tooltip-dot.cuti-izin { background-color: #60a5fa; }
        .tooltip-dot.tanpa-keterangan { background-color: #f43f5e; }

        .tooltip-dot.agustus { background-color: #cbd5e1; }
        .tooltip-dot.september { background-color: #93c5fd; }
        .tooltip-dot.oktober { background-color: #2563eb; }

        .tooltip-val {
          font-weight: 700;
          color: #ffffff;
          font-variant-numeric: tabular-nums;
        }

        .tooltip-divider {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          margin: 0.25rem 0;
        }

        .tooltip-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.6875rem;
          color: #94a3b8;
        }

        .tooltip-footer-row strong {
          color: #ffffff;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .week-grouped-bars-laporan {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 0.35rem;
          width: 100%;
          height: 130px;
        }

        .laporan-single-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          flex: 1;
          max-width: 24px;
          position: relative;
        }

        .laporan-bar-val {
          font-size: 0.625rem;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 0.25rem;
          font-variant-numeric: tabular-nums;
          user-select: none;
          transition: color 0.15s ease, transform 0.15s ease;
        }

        .bar-col:hover .laporan-bar-val {
          color: #0f172a;
          transform: translateY(-1px);
        }

        .laporan-bar-pill {
          width: 100%;
          border-radius: 4px 4px 0 0;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s ease, box-shadow 0.2s ease;
          min-height: 4px;
        }

        .laporan-bar-pill:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .laporan-bar-pill.bar-tepat-waktu {
          background: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 45%, #0284c7 100%);
          box-shadow: 0 2px 4px rgba(14, 165, 233, 0.2);
        }

        .laporan-bar-pill.bar-terlambat {
          background: linear-gradient(180deg, #fb923c 0%, #f97316 45%, #ea580c 100%);
          box-shadow: 0 2px 4px rgba(249, 115, 22, 0.2);
        }

        .laporan-bar-pill.bar-cuti-izin {
          background: linear-gradient(180deg, #c084fc 0%, #a855f7 45%, #7e22ce 100%);
          box-shadow: 0 2px 4px rgba(168, 85, 247, 0.2);
        }

        .laporan-bar-pill.bar-tanpa-keterangan {
          background: linear-gradient(180deg, #fb7185 0%, #f43f5e 45%, #e11d48 100%);
          box-shadow: 0 2px 4px rgba(244, 63, 94, 0.2);
        }

        .laporan-bar-pill.bar-agustus {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 45%, #475569 100%);
          box-shadow: 0 2px 4px rgba(100, 116, 139, 0.2);
        }

        .laporan-bar-pill.bar-september {
          background: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 45%, #0284c7 100%);
          box-shadow: 0 2px 4px rgba(14, 165, 233, 0.2);
        }

        .laporan-bar-pill.bar-oktober {
          background: linear-gradient(180deg, #3b82f6 0%, #2563eb 45%, #1d4ed8 100%);
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
        }

        .tooltip-dot.agustus { background-color: #64748b; }
        .tooltip-dot.september { background-color: #0284c7; }
        .tooltip-dot.oktober { background-color: #1d4ed8; }

        .bar-lbl {
          font-size: 0.6875rem;
          color: #6b7280;
          text-align: center;
          line-height: 1.25;
          max-width: 100px;
        }

        .group-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 130px;
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
          background: linear-gradient(135deg, #38bdf8, #0284c7);
        }

        .legend-box.terlambat {
          background: linear-gradient(135deg, #fb923c, #ea580c);
        }

        .legend-box.cuti {
          background: linear-gradient(135deg, #c084fc, #7e22ce);
        }

        .legend-box.alpa {
          background: linear-gradient(135deg, #fb7185, #e11d48);
        }

        .legend-box.agustus {
          background: linear-gradient(135deg, #94a3b8, #475569);
        }

        .legend-box.september {
          background: linear-gradient(135deg, #38bdf8, #0284c7);
        }

        .legend-box.oktober {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .font-semibold {
          font-weight: 600;
        }

        /* --- Header & Filter Toolbar Layout --- */
        .laporan-header-wrap {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        @media (min-width: 1024px) {
          .laporan-header-wrap {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }

        .laporan-title-col {
          min-width: 280px;
          flex: 1;
        }

        .laporan-filter-toolbar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: nowrap;
          flex-shrink: 0;
        }

        .chart-scroll-wrap {
          width: 100%;
          overflow: visible;
          position: relative;
        }

        @media (max-width: 768px) {
          .chart-scroll-wrap {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
          }
          .laporan-filter-toolbar {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .laporan-filter-toolbar .filter-group {
            width: 100%;
            justify-content: space-between;
          }

          .laporan-filter-toolbar .filter-select {
            flex: 1;
            min-width: 0;
            max-width: calc(100% - 60px);
          }

          .btn-export-csv {
            width: 100%;
            justify-content: center;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.75rem;
          }

          .metric-card {
            padding: 0.85rem !important;
          }

          .metric-big-number {
            font-size: 1.35rem !important;
          }

          .chart-body-layout {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
          }

          .chart-canvas-wrapper,
          .chart-x-axis-row {
            min-width: 320px;
          }

          .two-col-grid {
            gap: 1rem;
          }
        }

        @media (max-width: 480px) {
          .kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `,
        }}
      />
    </>
  );
}
