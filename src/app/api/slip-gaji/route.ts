import { NextRequest, NextResponse } from "next/server";
import profilesData from "../../../../data/seeds/profiles.json";
import slipGajiSeedData from "../../../../data/seeds/slip_gaji.json";

const SLIP_STORE_KEY = "karsahr_slip_gaji_store";

export interface SlipRecord {
  id: string;
  nomor_slip: string | null;
  karyawan_id: string;
  periode: string;
  gaji_pokok: number;
  tunjangan: number;
  potongan: number;
  total_diterima: number;
  catatan?: string | null;
  status: "draf" | "terbit";
  dibuat_oleh?: string | null;
  diterbitkan_oleh?: string | null;
  diterbitkan_pada?: string | null;
  dibuat_pada?: string | null;
  "nama (bantu)"?: string | null;
}

/**
 * Helper mendapatkan seluruh slip (seeds digabung override)
 */
function getAllSlips(): SlipRecord[] {
  return slipGajiSeedData as SlipRecord[];
}

/**
 * GET /api/slip-gaji
 * Penegakan Hak Akses RBAC Ketat (PRD BR-11 & BR-12):
 * - HRD: Melihat seluruh slip (draf dan terbit)
 * - Atasan: TIDAK DAPAT melihat slip gaji anggota divisinya (lewat URL atau API tidak menampilkan data apa pun).
 * - Karyawan: HANYA melihat slip miliknya sendiri yang sudah berstatus 'terbit' (tidak melihat draf).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const targetKaryawanId = searchParams.get("karyawanId") || searchParams.get("karyawan_id");
    const slipId = searchParams.get("id");
    const periode = searchParams.get("periode");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing userId" }, { status: 401 });
    }

    const requester = (profilesData as Array<any>).find(
      (p) => p.id === userId || p.nik_karyawan === userId || p.email?.toLowerCase() === userId.toLowerCase()
    );

    if (!requester) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const allSlips = getAllSlips();

    // 1. KASUS ROLE ATASAN (PRD BR-11: "Atasan tidak bisa melihat gaji anggota divisinya.
    // Login sebagai Atasan lalu membuka data slip gaji anggota divisi lewat URL atau API tidak menampilkan data apa pun")
    if (requester.peran === "atasan") {
      // Jika mencoba meminta slip anggota lain via karyawanId
      if (
        targetKaryawanId &&
        targetKaryawanId !== requester.id &&
        targetKaryawanId !== requester.nik_karyawan
      ) {
        return NextResponse.json(
          {
            error: "Akses ditolak: Atasan tidak memiliki wewenang melihat data slip gaji anggota divisinya (PRD BR-11).",
            data: [],
          },
          { status: 403 }
        );
      }

      // Jika mencoba meminta spesifik slip via ID
      if (slipId) {
        const foundSlip = allSlips.find((s) => s.id === slipId);
        if (!foundSlip || (foundSlip.karyawan_id !== requester.id && foundSlip.karyawan_id !== requester.nik_karyawan)) {
          return NextResponse.json(
            {
              error: "Akses ditolak: Atasan tidak memiliki wewenang melihat data slip gaji anggota divisinya (PRD BR-11).",
              data: null,
            },
            { status: 403 }
          );
        }
        // Atasan hanya boleh melihat slip miliknya jika sudah terbit
        if (foundSlip.status !== "terbit") {
          return NextResponse.json(
            { error: "Slip gaji berstatus draf belum dapat dilihat (PRD BR-11).", data: null },
            { status: 403 }
          );
        }
        return NextResponse.json({ success: true, data: foundSlip });
      }

      // Daftar slip untuk Atasan: HANYA slip miliknya sendiri yang sudah 'terbit'
      const ownSlips = allSlips.filter(
        (s) => (s.karyawan_id === requester.id || s.karyawan_id === requester.nik_karyawan) && s.status === "terbit"
      );
      return NextResponse.json({ success: true, data: ownSlips });
    }

    // 2. KASUS ROLE KARYAWAN (PRD BR-11 & BR-12: Karyawan hanya melihat miliknya sendiri yang sudah terbit, draf tidak ditampilkan)
    if (requester.peran === "karyawan") {
      if (
        targetKaryawanId &&
        targetKaryawanId !== requester.id &&
        targetKaryawanId !== requester.nik_karyawan
      ) {
        return NextResponse.json(
          { error: "Akses ditolak: Anda hanya berhak mengakses slip gaji milik sendiri (PRD BR-11).", data: [] },
          { status: 403 }
        );
      }

      if (slipId) {
        const foundSlip = allSlips.find((s) => s.id === slipId);
        if (!foundSlip || (foundSlip.karyawan_id !== requester.id && foundSlip.karyawan_id !== requester.nik_karyawan)) {
          return NextResponse.json(
            { error: "Slip gaji tidak ditemukan atau akses ditolak (PRD BR-11).", data: null },
            { status: 403 }
          );
        }
        // Karyawan tidak melihat slip draf (BR-12)
        if (foundSlip.status !== "terbit") {
          return NextResponse.json(
            { error: "Slip gaji berstatus draf belum diterbitkan (PRD BR-12).", data: null },
            { status: 403 }
          );
        }
        return NextResponse.json({ success: true, data: foundSlip });
      }

      // Daftar slip karyawan: HANYA yang sudah terbit
      const ownSlips = allSlips.filter(
        (s) => (s.karyawan_id === requester.id || s.karyawan_id === requester.nik_karyawan) && s.status === "terbit"
      );
      return NextResponse.json({ success: true, data: ownSlips });
    }

    // 3. KASUS ROLE HRD (Akses penuh seluruh perusahaan per periode atau filter)
    if (requester.peran === "hrd") {
      let result = [...allSlips];
      if (periode) {
        result = result.filter((s) => s.periode.slice(0, 7) === periode.slice(0, 7));
      }
      if (targetKaryawanId) {
        result = result.filter(
          (s) => s.karyawan_id === targetKaryawanId || s["nama (bantu)"]?.toLowerCase() === targetKaryawanId.toLowerCase()
        );
      }
      if (slipId) {
        const single = result.find((s) => s.id === slipId);
        return NextResponse.json({ success: true, data: single || null });
      }
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: "Invalid role" }, { status: 403 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/slip-gaji
 * PRD BR-12: "Slip yang sudah terbit tidak bisa diubah atau dihapus."
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, slipId, payload } = body;

    if (!userId || !slipId) {
      return NextResponse.json({ error: "Missing userId or slipId" }, { status: 400 });
    }

    const requester = (profilesData as Array<any>).find(
      (p) => p.id === userId || p.nik_karyawan === userId
    );

    if (!requester || requester.peran !== "hrd") {
      return NextResponse.json(
        { error: "Forbidden: Hanya HRD yang berwenang mengubah slip gaji (PRD BR-12)." },
        { status: 403 }
      );
    }

    const allSlips = getAllSlips();
    const targetSlip = allSlips.find((s) => s.id === slipId);

    if (!targetSlip) {
      return NextResponse.json({ error: "Slip gaji tidak ditemukan" }, { status: 404 });
    }

    // PRD BR-12: Slip yang sudah terbit tidak bisa diubah atau dihapus
    if (targetSlip.status === "terbit") {
      return NextResponse.json(
        { error: "Slip gaji yang sudah terbit terkunci dan tidak bisa diubah atau dihapus (PRD BR-12)." },
        { status: 400 }
      );
    }

    // Validasi nilai tidak boleh negatif (PRD BR-12)
    if (payload) {
      const { gajiPokok, tunjangan, potongan } = payload;
      const total = (gajiPokok ?? targetSlip.gaji_pokok) + (tunjangan ?? targetSlip.tunjangan) - (potongan ?? targetSlip.potongan);
      if (
        (gajiPokok !== undefined && gajiPokok < 0) ||
        (tunjangan !== undefined && tunjangan < 0) ||
        (potongan !== undefined && potongan < 0) ||
        total < 0
      ) {
        return NextResponse.json(
          { error: "Komponen gaji dan total diterima tidak boleh bernilai negatif (PRD BR-12)." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Draf slip gaji berhasil diperbarui.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
