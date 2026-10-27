import { NextRequest, NextResponse } from "next/server";
import { fetchAttendanceRecords, executeAttendanceCorrection } from "@/lib/firebase/attendance-service";
import profilesData from "../../../../data/seeds/profiles.json";
import { isCheckInWindowValid, formatWIBTimeString } from "@/lib/utils/time";

/**
 * Backend API Route Handler untuk Memvalidasi RBAC Absensi
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const scope = (searchParams.get("scope") || "personal") as "personal" | "team" | "company";
    const date = searchParams.get("date") || undefined;
    const month = searchParams.get("month") || undefined;
    const divisionId = searchParams.get("divisionId") || undefined;
    const status = searchParams.get("status") || undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing userId" }, { status: 401 });
    }

    const userProfile = (profilesData as Array<any>).find(
      (p) => p.id === userId || p.nik_karyawan === userId
    );

    if (!userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Eksekusi query dengan proteksi RBAC di backend
    const records = await fetchAttendanceRecords(userProfile, {
      viewScope: scope,
      date,
      month,
      divisionId,
      status,
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, recordId, payload, action } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing userId" }, { status: 401 });
    }

    const userProfile = (profilesData as Array<any>).find(
      (p) => p.id === userId || p.nik_karyawan === userId
    );

    if (!userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Aksi Check-in via API (PRD BR-02: Batas waktu 06.00 - 12.00 WIB)
    if (action === "check-in" || action === "check_in") {
      const now = new Date();
      const timeStr = body.jam_masuk || formatWIBTimeString(now);
      const windowValidation = isCheckInWindowValid(timeStr);
      if (!windowValidation.valid) {
        return NextResponse.json(
          { error: windowValidation.message || "Check-in ditolak: Batas waktu check-in adalah 06.00–12.00 WIB." },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: "Check-in valid." });
    }

    // Validasi RBAC ketat: Hanya HRD yang dapat mengoreksi
    if (userProfile.peran !== "hrd") {
      return NextResponse.json(
        { error: "Forbidden: Hanya HRD yang berwenang mengoreksi absensi." },
        { status: 403 }
      );
    }

    const updated = await executeAttendanceCorrection(userProfile, recordId, payload);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengoreksi absensi" }, { status: 400 });
  }
}
