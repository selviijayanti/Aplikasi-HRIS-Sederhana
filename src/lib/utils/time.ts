/**
 * Utilitas Waktu dan Aturan Bisnis Zona Waktu WIB (UTC+7)
 * Sesuai Aturan Bisnis PRD: BR-02, BR-03, BR-05
 */

export function getWIBDate(date: Date = new Date()): Date {
  // Buat objek Date bergeser ke UTC+7
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
}

export function formatWIBDateString(date: Date = new Date()): string {
  const wib = getWIBDate(date);
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, "0");
  const dd = String(wib.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatWIBTimeString(date: Date = new Date()): string {
  const wib = getWIBDate(date);
  const hh = String(wib.getHours()).padStart(2, "0");
  const mm = String(wib.getMinutes()).padStart(2, "0");
  const ss = String(wib.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Menentukan status absensi berdasarkan jam masuk:
 * BR-03: Tepat 08:15:00 masih "hadir". Lewat dari 08:15:00 berstatus "terlambat".
 */
export function determineAttendanceStatus(timeStr: string): "hadir" | "terlambat" {
  // Format timeStr: "HH:mm:ss" atau "HH:mm"
  const parts = timeStr.split(":").map(Number);
  const hour = parts[0] || 0;
  const minute = parts[1] || 0;
  const second = parts[2] || 0;

  const totalSeconds = hour * 3600 + minute * 60 + second;
  const cutoffSeconds = 8 * 3600 + 15 * 60; // 08:15:00

  return totalSeconds <= cutoffSeconds ? "hadir" : "terlambat";
}

/**
 * Validasi jam check-in:
 * BR-02: Check-in hanya bisa dilakukan antara pukul 06.00 dan 12.00 WIB.
 */
export function isCheckInWindowValid(timeOrDate: string | Date = new Date()): {
  valid: boolean;
  message?: string;
  reason?: "too_early" | "too_late";
} {
  let timeStr = "";
  if (timeOrDate instanceof Date) {
    timeStr = formatWIBTimeString(timeOrDate);
  } else {
    timeStr = timeOrDate;
  }

  const normalized = timeStr.replace(/\./g, ":");
  const parts = normalized.split(":").map(Number);
  const hour = isNaN(parts[0]) ? 0 : parts[0];
  const minute = isNaN(parts[1]) ? 0 : parts[1];
  const second = isNaN(parts[2]) ? 0 : parts[2];
  const totalSeconds = hour * 3600 + minute * 60 + second;

  const startSeconds = 6 * 3600; // 06:00:00
  const endSeconds = 12 * 3600; // 12:00:00

  if (totalSeconds < startSeconds) {
    return {
      valid: false,
      reason: "too_early",
      message: "Check-in ditolak: Check-in hanya dapat dilakukan mulai pukul 06.00 WIB. Batas waktu check-in adalah 06.00–12.00 WIB.",
    };
  }
  if (totalSeconds > endSeconds) {
    return {
      valid: false,
      reason: "too_late",
      message: "Check-in ditolak: Batas waktu check-in telah berakhir pada pukul 12.00 WIB. Batas waktu check-in adalah 06.00–12.00 WIB.",
    };
  }
  return { valid: true };
}

/**
 * Menghitung jumlah hari kerja dalam rentang tanggal
 * BR-05: Lama pengajuan dihitung dalam hari kerja; Sabtu, Minggu, dan hari libur tidak dihitung.
 */
export function calculateWorkingDays(
  startDateStr: string,
  endDateStr: string,
  holidayDatesSet: Set<string>
): number {
  const start = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T00:00:00Z");

  if (end < start) return 0;

  let count = 0;
  const cur = new Date(start);

  while (cur <= end) {
    const dayOfWeek = cur.getUTCDay(); // 0 is Sunday, 6 is Saturday
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(cur.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDatesSet.has(dateStr);

    if (!isWeekend && !isHoliday) {
      count++;
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return count;
}

/**
 * Format angka mata uang Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format tanggal Indonesia: contoh "Kamis, 15 Okt 2026"
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
