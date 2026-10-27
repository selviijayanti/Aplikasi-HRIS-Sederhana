import { NextRequest, NextResponse } from "next/server";
import profilesData from "../../../../data/seeds/profiles.json";
import pengajuanCutiSeedData from "../../../../data/seeds/pengajuan_cuti.json";
import kuotaCutiData from "../../../../data/seeds/kuota_cuti.json";
import { getSubmittedLeaves, getLeaveStatusOverrides, calculateAccurateLeaveQuota } from "@/lib/utils/leave-store";
import { getRawAttendanceStore } from "@/lib/firebase/attendance-service";
import { submitLeaveRequestToFirestore, cancelLeaveRequestInFirestore } from "@/lib/firebase/leave-service";

/**
 * GET /api/cuti
 * Mengambil daftar pengajuan cuti milik pengguna terautentikasi (dibuat_pada DESC)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing userId" }, { status: 401 });
    }

    const userProfile = (profilesData as Array<any>).find(
      (p) => p.id === userId || p.nik_karyawan === userId
    );

    const overrides = getLeaveStatusOverrides();
    const submitted = getSubmittedLeaves();

    // Gabungkan data pengajuan tersimpan & seed
    const allLeaves = [
      ...submitted,
      ...(pengajuanCutiSeedData as Array<any>).map((p) => ({
        id: p.id,
        karyawan_id: p.karyawan_id,
        nama_karyawan: p["pemohon (bantu)"] || "",
        nik_karyawan: p.nik_karyawan || "",
        divisi_id: p.divisi_id || "",
        divisi_nama: p["divisi (bantu)"] || "",
        jenis: p.jenis,
        tanggal_mulai: p.tanggal_mulai,
        tanggal_selesai: p.tanggal_selesai || p.tanggal_mulai,
        jumlah_hari: p.jumlah_hari,
        alasan: p.alasan,
        status: overrides[p.id]?.status || p.status,
        created_at: p.dibuat_pada || p.created_at,
        dibuat_pada: p.dibuat_pada || p.created_at,
        lampiran_path: p.lampiran_path,
      })),
    ];

    // Filter milik user
    const userLeaves = allLeaves.filter((l) => {
      if (l.karyawan_id === userId) return true;
      if (userProfile && l.nik_karyawan === userProfile.nik_karyawan) return true;
      if (userProfile && l.nama_karyawan?.toLowerCase() === userProfile.nama_lengkap.toLowerCase()) return true;
      return false;
    });

    // Urutkan dibuat_pada DESC (terbaru paling atas)
    userLeaves.sort((a, b) => {
      const timeA = new Date((a as any).dibuat_pada || (a as any).created_at || 0).getTime();
      const timeB = new Date((b as any).dibuat_pada || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, data: userLeaves });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/cuti
 * Backend validation handler untuk permohonan Cuti, Sakit, dan Izin (BR-05, BR-07, BR-08)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, payload } = body;

    if (!userId || !payload) {
      return NextResponse.json({ error: "Missing required fields: userId and payload" }, { status: 400 });
    }

    const userProfile = (profilesData as Array<any>).find(
      (p) => p.id === userId || p.nik_karyawan === userId
    );

    const effectiveName = userProfile?.nama_lengkap || payload.namaKaryawan || "Karyawan";
    const effectiveNik = userProfile?.nik_karyawan || payload.nikKaryawan || "";
    const effectiveDivisiId = userProfile?.divisi_id || payload.divisiId || "";
    const effectiveDivisiNama = userProfile?.["divisi (bantu)"] || payload.divisiNama || "";

    const { jenis, tanggalMulai, tanggalSelesai, jumlahHari, alasan, hasAttachment } = payload;

    // 1. Validasi PRD BR-05: Rentang tanggal valid & minimal 1 hari kerja
    if (!tanggalMulai || !tanggalSelesai || tanggalMulai > tanggalSelesai) {
      return NextResponse.json(
        { error: "Format rentang tanggal tidak valid. Tanggal mulai tidak boleh melebihi tanggal selesai." },
        { status: 400 }
      );
    }
    if (jumlahHari < 1) {
      return NextResponse.json(
        { error: "Rentang pengajuan tidak berisi hari kerja." },
        { status: 400 }
      );
    }

    // 1b. Validasi PRD BR-05: Tidak boleh melewati pergantian tahun
    if (tanggalMulai.slice(0, 4) !== tanggalSelesai.slice(0, 4)) {
      return NextResponse.json(
        { error: "Satu pengajuan tidak boleh melewati pergantian tahun. Periode yang melintasi 31 Desember ke 1 Januari harus dipecah menjadi dua pengajuan terpisah (PRD BR-05)." },
        { status: 400 }
      );
    }

    // 1c. Validasi PRD BR-04: Cuti tahunan baru boleh dimulai setelah masa kerja genap 12 bulan
    if (jenis === "cuti_tahunan" && userProfile?.tanggal_masuk) {
      const joinDate = new Date(userProfile.tanggal_masuk + "T00:00:00Z");
      const minDate = new Date(joinDate);
      minDate.setUTCFullYear(minDate.getUTCFullYear() + 1);

      const startDate = new Date(tanggalMulai + "T00:00:00Z");
      if (startDate < minDate) {
        return NextResponse.json(
          { error: `Cuti tahunan baru boleh dimulai setelah masa kerja genap 12 bulan sejak tanggal masuk (${userProfile.tanggal_masuk}) (PRD BR-04).` },
          { status: 400 }
        );
      }
    }

    // 2. Validasi Batasan pengajuan Izin maks 2 hari kerja
    if (jenis === "izin" && jumlahHari > 2) {
      return NextResponse.json(
        { error: "Pengajuan izin paling banyak 2 hari kerja per pengajuan." },
        { status: 400 }
      );
    }

    // 3. Validasi Sakit > 1 hari kerja wajib melampirkan surat dokter
    if (jenis === "sakit" && jumlahHari > 1 && !hasAttachment) {
      return NextResponse.json(
        { error: "Lampiran surat dokter (PDF/JPG/PNG maks 2 MB) wajib diunggah untuk pengajuan sakit lebih dari 1 hari kerja." },
        { status: 400 }
      );
    }

    // 4. Validasi PRD BR-06: Sisa kuota cuti tahunan tidak boleh minus
    const clientOverrides = payload.statusOverrides || undefined;
    const clientSubmitted = payload.submittedLeaves || undefined;

    // 4. Validasi PRD BR-06: Sisa kuota cuti tahunan tidak boleh minus
    if (jenis === "cuti_tahunan") {
      const quota = calculateAccurateLeaveQuota(
        {
          id: userId,
          seed_id: userProfile?.id,
          nik_karyawan: effectiveNik,
          nama_lengkap: effectiveName,
        },
        2026,
        clientOverrides,
        clientSubmitted
      );

      if (jumlahHari > quota.sisa) {
        return NextResponse.json(
          {
            error: `Pengajuan cuti tahunan (${jumlahHari} hari kerja) melebihi sisa kuota yang tersedia (${quota.sisa} hari kerja). Sesuai kebijakan perusahaan, pengajuan dibatasi agar saldo kuota tidak bernilai negatif.`,
          },
          { status: 400 }
        );
      }
    }

    // 5. Validasi PRD BR-07: Irisan tanggal dengan pengajuan aktif lainnya
    const overrides = clientOverrides || getLeaveStatusOverrides();
    const allLeaves = [
      ...(clientSubmitted || getSubmittedLeaves()).map((l: any) => {
        const aliasId = l.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : l.id === "cuti-01" ? "feaf39cf-e72b-5830-bb52-efe413bc1c55" : undefined;
        return {
          ...l,
          status: overrides[l.id]?.status || (aliasId && overrides[aliasId]?.status) || l.status,
        };
      }),
      ...(pengajuanCutiSeedData as Array<any>).map((p) => {
        const aliasId = p.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : p.id === "cuti-01" ? "feaf39cf-e72b-5830-bb52-efe413bc1c55" : undefined;
        return {
          id: p.id,
          karyawan_id: p.karyawan_id,
          nama_karyawan: p["pemohon (bantu)"] || "",
          nik_karyawan: p.nik_karyawan || "",
          tanggal_mulai: p.tanggal_mulai,
          tanggal_selesai: p.tanggal_selesai || p.tanggal_mulai,
          status: overrides[p.id]?.status || (aliasId && overrides[aliasId]?.status) || p.status,
        };
      }),
    ];

    const userActiveLeaves = allLeaves.filter((l) => {
      const isOwner =
        l.karyawan_id === userId ||
        (effectiveNik && l.nik_karyawan === effectiveNik) ||
        (effectiveName && l.nama_karyawan?.toLowerCase() === effectiveName.toLowerCase());
      if (!isOwner) return false;

      const aliasId = l.id === "feaf39cf-e72b-5830-bb52-efe413bc1c55" ? "cuti-01" : l.id === "cuti-01" ? "feaf39cf-e72b-5830-bb52-efe413bc1c55" : undefined;
      const st = (overrides[l.id]?.status || (aliasId && overrides[aliasId]?.status) || l.status || "").toLowerCase().trim();
      // PRD BR-07: Pengajuan dibatalkan atau ditolak TIDAK BOLEH memblokir pengajuan baru
      if (st === "dibatalkan" || st === "ditolak") return false;
      return st === "diajukan" || st === "disetujui_atasan" || st === "disetujui";
    });

    for (const ex of userActiveLeaves) {
      const exStart = ex.tanggal_mulai?.includes("T") ? ex.tanggal_mulai.split("T")[0] : ex.tanggal_mulai;
      const exEnd = ex.tanggal_selesai?.includes("T") ? ex.tanggal_selesai.split("T")[0] : (ex.tanggal_selesai || exStart);
      if (!exStart || !exEnd) continue;

      // Irisan: tanggalMulai <= exEnd && tanggalSelesai >= exStart
      if (tanggalMulai <= exEnd && tanggalSelesai >= exStart) {
        return NextResponse.json(
          { error: "Tanggal yang dipilih beririsan dengan pengajuan aktif lainnya." },
          { status: 409 }
        );
      }
    }

    // 6. Validasi PRD BR-07: Irisan tanggal dengan catatan absensi karyawan
    const attendanceRecords = getRawAttendanceStore();
    const userAttendance = attendanceRecords.filter((a) => {
      return (
        a.karyawan_id === userId ||
        (effectiveNik && a.nik_karyawan === effectiveNik) ||
        (effectiveName && a["nama (bantu)"]?.toLowerCase() === effectiveName.toLowerCase())
      );
    });

    for (const att of userAttendance) {
      const attDate = att.tanggal;
      if (attDate && attDate >= tanggalMulai && attDate <= tanggalSelesai) {
        const hasCheckIn = Boolean(att.jam_masuk) || att.status === "hadir" || att.status === "terlambat";
        if (hasCheckIn) {
          return NextResponse.json(
            { error: `Pengajuan ditolak karena pada rentang tanggal tersebut (${attDate}) sudah ada data absensi karyawan.` },
            { status: 409 }
          );
        }
      }
    }

    // Eksekusi penyimpanan ke backend
    const result = await submitLeaveRequestToFirestore({
      karyawanId: userId,
      namaKaryawan: effectiveName,
      nikKaryawan: effectiveNik,
      divisiId: effectiveDivisiId,
      divisiNama: effectiveDivisiNama,
      jenis,
      tanggalMulai,
      tanggalSelesai,
      jumlahHari,
      alasan,
      fileSurat: null, // Berkas diproses via multipart atau metadata
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Gagal memproses pengajuan cuti" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.id || result.fallbackId,
      message: "Pengajuan berhasil dikirim dan diverifikasi.",
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memproses pengajuan cuti" }, { status: 500 });
  }
}

/**
 * PATCH /api/cuti
 * Membatalkan pengajuan cuti (Hanya status 'diajukan' atau 'disetujui_atasan')
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, pengajuanId, currentStatus, jumlahHari, jenis } = body;

    if (!userId || !pengajuanId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const st = currentStatus?.toLowerCase();
    // Karyawan hanya boleh membatalkan 'diajukan' atau 'disetujui_atasan'
    if (st !== "diajukan" && st !== "disetujui_atasan") {
      return NextResponse.json(
        { error: "Hanya pengajuan berstatus 'diajukan' atau 'disetujui_atasan' yang dapat dibatalkan oleh pemohon." },
        { status: 403 }
      );
    }

    const result = await cancelLeaveRequestInFirestore(
      pengajuanId,
      userId,
      jumlahHari || 1,
      jenis || "cuti_tahunan"
    );

    return NextResponse.json({
      success: result.success,
      message: "Pengajuan berhasil dibatalkan. Kuota telah dikembalikan bila berupa cuti tahunan.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membatalkan pengajuan" }, { status: 500 });
  }
}
