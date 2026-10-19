export type Peran = "karyawan" | "atasan" | "hrd";
export type StatusKerja = "tetap" | "kontrak";
export type JenisLibur = "nasional" | "cuti_bersama" | "perusahaan";
export type JenisPengajuan = "cuti_tahunan" | "sakit" | "izin";
export type StatusPengajuan =
  | "diajukan"
  | "disetujui_atasan"
  | "disetujui"
  | "ditolak"
  | "dibatalkan";
export type StatusAbsensi = "hadir" | "terlambat";
export type StatusSlipGaji = "draf" | "terbit";

export interface Profile {
  id: string; // Auth UID
  nik_karyawan: string; // e.g. KLN-0001
  nama_lengkap: string;
  email: string;
  nomor_hp?: string | number | null;
  peran: Peran;
  divisi_id: string;
  jabatan: string;
  status_kerja: StatusKerja;
  tanggal_masuk: string; // YYYY-MM-DD
  aktif: boolean;
  dibuat_pada?: string;
}

export interface Divisi {
  id: string;
  nama: string;
  manajer_id?: string | null;
  dibuat_pada?: string;
}

export interface HariLibur {
  tanggal: string; // YYYY-MM-DD (PK)
  keterangan: string;
  jenis: JenisLibur;
}

export interface KuotaCuti {
  id: string;
  karyawan_id: string;
  tahun: number; // e.g. 2026
  jatah_hari: number; // 0..12
  terpakai_hari: number; // hari yang sudah dipakai atau sedang diajukan
}

export interface PengajuanCuti {
  id: string;
  karyawan_id: string;
  jenis: JenisPengajuan;
  tanggal_mulai: string; // YYYY-MM-DD
  tanggal_selesai: string; // YYYY-MM-DD
  jumlah_hari: number;
  alasan: string;
  lampiran_path?: string | null;
  status: StatusPengajuan;
  perlu_atasan: boolean;
  disetujui_atasan_oleh?: string | null;
  disetujui_atasan_pada?: string | null;
  diputuskan_hrd_oleh?: string | null;
  diputuskan_hrd_pada?: string | null;
  alasan_penolakan?: string | null;
  dibatalkan_oleh?: string | null;
  dibatalkan_pada?: string | null;
  dibuat_pada: string;
}

export interface Absensi {
  id: string;
  karyawan_id: string;
  tanggal: string; // YYYY-MM-DD
  jam_masuk?: string | null; // HH:mm:ss
  jam_pulang?: string | null; // HH:mm:ss
  status?: StatusAbsensi | null;
  dikoreksi_oleh?: string | null;
  alasan_koreksi?: string | null;
}

export interface SlipGaji {
  id: string;
  nomor_slip: string; // SG-TTTTBB-NNN (dibuat saat terbit)
  karyawan_id: string;
  periode: string; // YYYY-MM
  gaji_pokok: number;
  tunjangan: number;
  potongan: number;
  total_diterima: number;
  catatan?: string | null;
  status: StatusSlipGaji;
  dibuat_oleh: string;
  diterbitkan_oleh?: string | null;
  diterbitkan_pada?: string | null;
  dibuat_pada: string;
}

export interface AuditLog {
  id: string;
  pelaku_id: string;
  aksi: string;
  nama_tabel: string;
  data_id: string;
  nilai_sebelum?: Record<string, unknown> | string | null;
  nilai_sesudah?: Record<string, unknown> | string | null;
  dibuat_pada: string;
}
