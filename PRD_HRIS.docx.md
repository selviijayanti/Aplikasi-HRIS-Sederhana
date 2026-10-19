**Bootcamp AI Web Programming · Capstone Project**

PRD Aplikasi HRIS Sederhana

**PT Karsa Lintas Nusantara**

## **1\. Latar Belakang**

PT Karsa Lintas Nusantara adalah perusahaan distribusi dan pergudangan di Bekasi dengan 16 karyawan yang terbagi dalam empat divisi: Human Resources, Operasional Gudang, Penjualan, dan Keuangan. Selama ini urusan kepegawaian dicatat di *spreadsheet* dan grup WhatsApp. Akibatnya sering terjadi:

* karyawan tidak tahu sisa cuti tahunannya dan HRD harus menghitung manual;

* pengajuan cuti lewat chat terlewat dibaca atasan, lalu karyawan tetap libur tanpa persetujuan;

* jam masuk dicatat di kertas sehingga keterlambatan sulit direkap;

* slip gaji dikirim sebagai file PDF lewat WhatsApp, sehingga berisiko terkirim ke orang yang salah.

Aplikasi HRIS (*Human Resource Information System*) ini menyatukan data karyawan, absensi harian, pengajuan cuti dan izin, serta slip gaji dalam satu aplikasi web internal.

## **2\. Tujuan**

1. Karyawan melakukan *check-in* dan *check-out* sendiri dengan jam yang tercatat otomatis dari server.

2. Karyawan mengajukan cuti, sakit, atau izin dan melihat sisa kuota cuti secara langsung.

3. Pengajuan disetujui berjenjang oleh atasan divisi lalu HRD, dan setiap keputusan tercatat.

4. Sisa kuota cuti selalu benar dan tidak pernah minus, termasuk saat ada dua pengajuan bersamaan.

5. Slip gaji hanya bisa dilihat HRD dan karyawan pemiliknya.

6. HRD melihat rekap kehadiran, keterlambatan, dan cuti per divisi dalam bentuk grafik.

## **3\. Pengguna dan Peran**

| Peran | Siapa | Yang bisa dilakukan |
| :---- | :---- | :---- |
| Karyawan | Semua pegawai tetap dan kontrak | *Check-in* dan *check-out*, melihat riwayat absensi sendiri, mengajukan dan membatalkan cuti, sakit, atau izin, melihat sisa kuota, melihat slip gaji sendiri yang sudah terbit |
| Atasan | Manajer divisi (Operasional Gudang, Penjualan, Keuangan) | Semua yang bisa dilakukan Karyawan untuk dirinya sendiri, ditambah melihat data dan absensi anggota divisinya, serta menyetujui atau menolak pengajuan anggota divisinya pada tahap pertama. Atasan tidak bisa melihat gaji anggota divisinya |
| HRD | Staf Human Resources | Semua yang bisa dilakukan Karyawan untuk dirinya sendiri, ditambah mengelola data karyawan, akun, divisi, hari libur, dan kuota cuti; memberi keputusan akhir pengajuan; mengoreksi absensi; membuat dan menerbitkan slip gaji; melihat laporan dan *audit log* |

Setiap akun memiliki tepat satu peran. Tidak ada pendaftaran mandiri: akun hanya dibuat oleh HRD. Pengunjung yang belum masuk hanya melihat halaman Masuk.

## **4\. Aturan Bisnis**

| Kode | Aturan |
| :---- | :---- |
| BR-01 | Hanya HRD yang dapat membuat akun, mengubah peran, memindahkan divisi, dan menonaktifkan karyawan. HRD tidak boleh mengubah peran atau menonaktifkan akunnya sendiri. Akun nonaktif tidak bisa masuk dan tidak bisa melakukan aksi apa pun. Setiap divisi dipimpin paling banyak satu Atasan, dan satu Atasan hanya memimpin satu divisi. |
| BR-02 | *Check-in* hanya bisa dilakukan satu kali per hari kerja (Senin sampai Jumat, bukan hari libur di daftar hari libur) antara pukul 06.00 dan 12.00 WIB. *Check-out* hanya bisa dilakukan setelah *check-in* pada hari yang sama. Jam dicatat dari server, bukan dari perangkat karyawan. *Check-in* ditolak pada hari karyawan sedang cuti, sakit, atau izin yang sudah disetujui. |
| BR-03 | *Check-in* lewat dari pukul 08.15.00 WIB berstatus "terlambat"; tepat 08.15.00 masih "hadir". Karyawan dan Atasan tidak bisa mengubah data absensi. Hanya HRD yang dapat mengoreksi absensi, dengan alasan wajib minimal 10 karakter. |
| BR-04 | Setiap karyawan mendapat jatah cuti tahunan paling banyak 12 hari kerja per tahun kalender, ditetapkan HRD per karyawan. Sisa jatah tidak dibawa ke tahun berikutnya. Cuti tahunan baru boleh dimulai setelah masa kerja karyawan genap 12 bulan sejak tanggal masuk. |
| BR-05 | Lama pengajuan dihitung dalam hari kerja; Sabtu, Minggu, dan hari libur tidak dihitung. Rentang yang tidak berisi hari kerja ditolak. Satu pengajuan tidak boleh melewati pergantian tahun. Batas waktu pengajuan: cuti tahunan paling lambat 3 hari kalender sebelum tanggal mulai (H-3), izin paling lambat H-1, sakit pada hari mulai sakit sampai paling lambat 3 hari kalender setelahnya. |
| BR-06 | Cuti tahunan langsung mengurangi sisa kuota saat diajukan. Bila pengajuan ditolak atau dibatalkan, harinya dikembalikan ke kuota. Pengajuan ditolak bila jumlah hari melebihi sisa kuota. Sisa kuota tidak boleh minus, termasuk ketika dua pengajuan dikirim pada saat yang sama. Sakit dan izin tidak mengurangi kuota. |
| BR-07 | Tanggal pengajuan tidak boleh beririsan dengan pengajuan lain milik karyawan yang sama yang masih berjalan (diajukan, disetujui atasan, atau disetujui). Pengajuan juga ditolak bila pada rentang tanggalnya sudah ada data absensi karyawan tersebut. |
| BR-08 | Sakit lebih dari 1 hari kerja wajib melampirkan surat dokter (PDF, JPG, atau PNG, paling besar 2 MB). Izin paling banyak 2 hari kerja per pengajuan. Lampiran hanya bisa dibuka oleh pemohon, Atasan divisinya, dan HRD. |
| BR-09 | Pengajuan Karyawan disetujui dua tahap: tahap pertama oleh Atasan divisi pemohon, tahap kedua (keputusan akhir) oleh HRD. Bila pemohon adalah Atasan atau HRD, atau divisinya tidak memiliki Atasan, tahap pertama dilewati dan pengajuan langsung diputuskan HRD. Tidak ada yang boleh memutuskan pengajuannya sendiri. HRD tidak boleh melompati tahap Atasan. Penolakan wajib disertai alasan minimal 10 karakter. |
| BR-10 | Pemohon dapat membatalkan pengajuannya selama status masih "diajukan" atau "disetujui atasan". Pengajuan yang sudah "disetujui" hanya dapat dibatalkan oleh HRD, dan hanya sebelum tanggal mulai. Pengajuan yang ditolak atau dibatalkan tidak bisa diaktifkan lagi; karyawan membuat pengajuan baru. |
| BR-11 | Gaji bersifat rahasia. Slip gaji hanya bisa dilihat oleh HRD dan karyawan pemiliknya. Karyawan hanya melihat slip yang sudah terbit. Atasan tidak bisa melihat gaji anggota divisinya. Rekap gaji di laporan hanya untuk HRD. Notifikasi apa pun tidak boleh memuat nominal gaji. |
| BR-12 | Satu karyawan hanya memiliki satu slip per periode bulan. Total diterima \= gaji pokok \+ tunjangan \- potongan; semua nilai tidak boleh negatif dan total tidak boleh di bawah nol. Slip dibuat sebagai draf, lalu diterbitkan oleh HRD. Nomor slip dibuat saat terbit dengan format SG-TTTTBB-NNN, berurutan per periode dan tidak boleh kembar. Slip yang sudah terbit tidak bisa diubah atau dihapus. Aksi berikut wajib tercatat di *audit log*: perubahan data kepegawaian dan peran, perubahan jatah cuti, setiap perubahan status pengajuan, koreksi absensi, serta pembuatan, perubahan, dan penerbitan slip. *Audit log* tidak bisa diubah atau dihapus oleh siapa pun lewat aplikasi. |

## **5\. User Story**

| Kode | User story | Aturan terkait |
| :---- | :---- | :---- |
| US-01 | Sebagai karyawan, saya ingin *check-in* dan *check-out* dari aplikasi agar kehadiran saya tercatat tanpa kertas. | BR-02, BR-03 |
| US-02 | Sebagai karyawan, saya ingin mengajukan cuti tahunan dan melihat sisa kuota sebelum mengirim agar tahu apakah pengajuan bisa diproses. | BR-04, BR-05, BR-06, BR-07 |
| US-03 | Sebagai karyawan, saya ingin mengajukan sakit atau izin dan melampirkan surat dokter bila perlu. | BR-05, BR-07, BR-08 |
| US-04 | Sebagai karyawan, saya ingin membatalkan pengajuan yang belum disetujui HRD agar kuota saya kembali. | BR-06, BR-10 |
| US-05 | Sebagai atasan, saya ingin melihat daftar pengajuan anggota divisi saya lalu menyetujui atau menolaknya dengan alasan. | BR-09 |
| US-06 | Sebagai atasan, saya ingin melihat siapa saja anggota divisi yang sudah hadir, terlambat, atau cuti hari ini. | BR-02, BR-03, BR-11 |
| US-07 | Sebagai HRD, saya ingin memberi keputusan akhir pengajuan dan membatalkan cuti yang sudah disetujui bila ada keadaan mendesak. | BR-06, BR-09, BR-10 |
| US-08 | Sebagai HRD, saya ingin mengelola data karyawan, jatah cuti, hari libur, dan mengoreksi absensi yang salah. | BR-01, BR-03, BR-04, BR-12 |
| US-09 | Sebagai HRD, saya ingin membuat slip gaji bulanan lalu menerbitkannya; sebagai karyawan, saya ingin membaca dan mengunduh slip gaji saya sendiri. | BR-11, BR-12 |
| US-10 | Sebagai HRD, saya ingin melihat laporan kehadiran dan cuti per divisi serta *audit log* untuk evaluasi bulanan. | BR-03, BR-11, BR-12 |

## **6\. Alur Status**

### **6.1 Pengajuan cuti, sakit, dan izin**

| Status | Arti |
| :---- | :---- |
| diajukan | Pengajuan baru dikirim, menunggu keputusan tahap pertama (atau langsung HRD bila tahap Atasan dilewati) |
| disetujui\_atasan | Disetujui Atasan divisi, menunggu keputusan akhir HRD |
| disetujui | Disetujui HRD, berlaku |
| ditolak | Ditolak Atasan atau HRD, kuota cuti tahunan dikembalikan |
| dibatalkan | Dibatalkan pemohon atau HRD, kuota cuti tahunan dikembalikan |

| Dari | Ke | Siapa yang boleh | Syarat |
| :---- | :---- | :---- | :---- |
| (baru) | diajukan | Pemohon (semua peran) | Lolos BR-04 sampai BR-08 |
| diajukan | disetujui\_atasan | Atasan divisi pemohon | Pengajuan membutuhkan tahap Atasan; bukan pengajuan sendiri |
| diajukan | disetujui | HRD | Hanya bila tahap Atasan dilewati (BR-09); bukan pengajuan sendiri |
| diajukan | ditolak | Atasan divisi pemohon, atau HRD bila tahap Atasan dilewati | Alasan minimal 10 karakter |
| disetujui\_atasan | disetujui | HRD | Bukan pengajuan sendiri |
| disetujui\_atasan | ditolak | HRD | Alasan minimal 10 karakter |
| diajukan, disetujui\_atasan | dibatalkan | Pemohon | Kapan saja selama belum disetujui HRD |
| disetujui | dibatalkan | HRD | Sebelum tanggal mulai |

Status ditolak dan dibatalkan adalah status akhir. Perpindahan lain di luar tabel ini harus ditolak.

### **6.2 Slip gaji**

| Dari | Ke | Siapa yang boleh | Syarat |
| :---- | :---- | :---- | :---- |
| (baru) | draf | HRD | Belum ada slip karyawan itu pada periode yang sama |
| draf | terbit | HRD | Nomor slip dibuat otomatis; setelah terbit slip terkunci |

## **7\. Halaman**

| Halaman | Akses | Isi |
| :---- | :---- | :---- |
| Masuk | Publik | Email dan kata sandi; pesan jelas bila akun nonaktif |
| Dashboard | Semua peran | Karyawan: tombol *check-in* atau *check-out*, sisa kuota, status pengajuan terakhir. Atasan: ditambah ringkasan tim hari ini dan jumlah pengajuan menunggu. HRD: ringkasan seluruh perusahaan, antrean keputusan akhir, grafik kehadiran 4 minggu |
| Absensi | Semua peran (isi sesuai peran) | Riwayat absensi sendiri per bulan. Atasan: tab tim divisi. HRD: semua karyawan, filter tanggal dan divisi, tombol Koreksi dengan alasan |
| Cuti dan Izin | Semua peran | Formulir pengajuan (jenis, tanggal, alasan, lampiran) dengan hitungan hari kerja dan sisa kuota sebelum kirim; daftar pengajuan sendiri dengan tombol Batalkan |
| Persetujuan | Atasan, HRD | Antrean pengajuan yang menunggu keputusan pengguna; detail pengajuan dengan riwayat status, lampiran, sisa kuota pemohon, tombol Setujui, Tolak, dan (HRD) Batalkan |
| Data Karyawan | Atasan (baca, divisi sendiri), HRD (kelola) | Daftar karyawan dengan pencarian dan filter divisi; detail karyawan berisi data kepegawaian, kuota, dan riwayat. HRD: tambah karyawan, ubah peran dan divisi, nonaktifkan. Tidak ada kolom gaji |
| Slip Gaji | Semua peran (isi sesuai peran) | Karyawan dan Atasan: daftar slip sendiri yang terbit dan tampilan cetak. HRD: daftar slip per periode, formulir draf, salin dari periode sebelumnya, tombol Terbitkan |
| Laporan | HRD | Grafik kehadiran dan keterlambatan per minggu, cuti per divisi per bulan, daftar karyawan paling sering terlambat, rekap total gaji per divisi per periode, ekspor CSV |
| Pengaturan | HRD | Divisi dan Atasannya, daftar hari libur, jatah cuti per karyawan per tahun, *audit log* dengan filter aksi dan tanggal |

## **8\. Data Utama**

Rincian tabel, kolom, dan relasi ada di file **ERD\_HRIS.pdf**. Ringkasnya:

| Data | Isi penting |
| :---- | :---- |
| Profil karyawan | NIK karyawan, nama, email, nomor HP, peran, divisi, jabatan, status kerja (tetap atau kontrak), tanggal masuk, status aktif |
| Divisi | nama divisi, Atasan (manajer) |
| Hari libur | tanggal, keterangan, jenis (nasional, cuti bersama, perusahaan) |
| Kuota cuti | karyawan, tahun, jatah hari, hari terpakai |
| Pengajuan cuti | pemohon, jenis (cuti tahunan, sakit, izin), tanggal mulai dan selesai, jumlah hari kerja, alasan, lampiran, status, siapa dan kapan memutuskan tiap tahap, alasan penolakan |
| Absensi | karyawan, tanggal, jam masuk, jam pulang, status (hadir atau terlambat), dikoreksi oleh, alasan koreksi |
| Slip gaji | nomor slip, karyawan, periode, gaji pokok, tunjangan, potongan, total diterima, status, diterbitkan oleh dan kapan |
| *Audit log* | pelaku, aksi, tabel, data, nilai sebelum, nilai sesudah, waktu |

Karyawan yang tidak punya data absensi pada hari kerja dan tidak sedang cuti, sakit, atau izin yang disetujui dihitung "tidak hadir tanpa keterangan" di laporan. Status ini dihitung saat laporan dibuat, tidak disimpan.

## **9\. Dashboard dan Laporan**

Halaman Laporan (HRD) memuat:

1. Grafik batang bertumpuk kehadiran per minggu selama 4 minggu terakhir: hadir tepat waktu, terlambat, cuti atau izin, dan tidak hadir tanpa keterangan.

2. Grafik batang jumlah hari cuti, sakit, dan izin yang disetujui per divisi per bulan.

3. Tabel 5 karyawan dengan keterlambatan terbanyak bulan berjalan.

4. Rekap total gaji (gaji pokok, tunjangan, potongan, total diterima) per divisi untuk periode yang dipilih, hanya untuk slip yang sudah terbit.

5. Kartu angka: persentase kehadiran tepat waktu bulan ini, jumlah pengajuan menunggu, dan rata-rata sisa kuota cuti.

Semua angka laporan dapat difilter per divisi dan rentang tanggal, dan bisa diunduh sebagai CSV.

## **10\. Kebutuhan Non-Fungsional**

1. Dashboard tampil dalam 2 detik untuk 20 karyawan yang membuka aplikasi bersamaan pada pukul 07.45 sampai 08.15.

2. Aplikasi bersifat internal: semua halaman diberi tanda *noindex* dan tidak boleh muncul di mesin pencari.

3. Hak akses diperiksa di database, bukan hanya disembunyikan di tampilan. Pengguna yang mengubah alamat URL atau memanggil API langsung tetap tidak bisa melihat data di luar haknya.

4. Waktu absensi dan batas tanggal pengajuan memakai zona waktu WIB (Asia/Jakarta) dari server.

5. Lampiran surat dokter disimpan di penyimpanan privat dan dibuka lewat tautan sementara.

6. Database dicadangkan setiap hari dan bisa dipulihkan ke kondisi 7 hari terakhir.

## **11\. Fitur Nilai Tambah (opsional)**

Notifikasi email, misalnya dengan layanan pengirim email transaksional:

* email ke Atasan saat ada pengajuan baru dari anggota divisinya;

* email ke HRD saat pengajuan menunggu keputusan akhir;

* email ke pemohon saat pengajuan disetujui, ditolak, atau dibatalkan HRD;

* email ke karyawan saat slip gaji terbit, berisi tautan ke aplikasi saja tanpa nominal gaji (BR-11).

Kegagalan pengiriman email tidak boleh membatalkan aksi utama. Aplikasi ini tidak membutuhkan *payment gateway*.

## **12\. Akun Uji dan Data Contoh**

Data contoh dan akun uji ada di file **Data\_Contoh\_HRIS.xlsx**. Semua akun memakai kata sandi latihan yang sama (lihat sheet "Akun Uji"). Akun utama untuk uji:

| Peran | Nama | Email |
| :---- | :---- | :---- |
| Karyawan | Andi Wijaya (Penjualan) | andi.wijaya@karsalintas.test |
| Karyawan | Siti Nurhaliza (Operasional Gudang, sisa kuota 1 hari) | siti.nurhaliza@karsalintas.test |
| Atasan | Maya Anggraini (Manajer Penjualan) | maya.anggraini@karsalintas.test |
| Atasan | Bayu Setiawan (Manajer Operasional) | bayu.setiawan@karsalintas.test |
| HRD | Rina Kusumawardani (Kepala HRD) | rina.kusumawardani@karsalintas.test |
| HRD | Dimas Pratama (Staf HR dan Payroll) | dimas.pratama@karsalintas.test |

Data contoh mencakup absensi 21 September sampai 15 Oktober 2026, pengajuan sepanjang 2026, dan slip gaji Agustus sampai Oktober 2026\. Tanggal "hari ini" pada data contoh adalah Kamis, 15 Oktober 2026\.

## **13\. Kriteria Selesai**

* ☐ Ketiga peran bisa masuk, dan menu yang tampil sesuai peran. Akun nonaktif ditolak saat masuk.

* ☐ *Check-in* kedua di hari yang sama ditolak; *check-in* pukul 08.15.00 berstatus hadir dan 08.15.01 berstatus terlambat (BR-02, BR-03).

* ☐ Siti (sisa kuota 1\) gagal mengajukan cuti 2 hari dan berhasil mengajukan 1 hari (BR-06).

* ☐ Dua pengajuan yang dikirim bersamaan oleh akun dengan sisa kuota 1 hanya menghasilkan satu pengajuan berhasil (BR-06).

* ☐ Atasan divisi lain dan HRD tidak bisa memutuskan tahap pertama; tidak ada akun yang bisa memutuskan pengajuannya sendiri (BR-09).

* ☐ Penolakan dan pembatalan mengembalikan kuota cuti tahunan (BR-06, BR-10).

* ☐ Login sebagai Atasan lalu membuka data slip gaji anggota divisi lewat URL atau API tidak menampilkan data apa pun (BR-11).

* ☐ Karyawan tidak melihat slip draf; slip terbit tidak bisa diubah; nomor slip berurutan dan tidak kembar (BR-12).

* ☐ Hitungan hari kerja melewati Sabtu, Minggu, dan hari libur, misalnya 22 sampai 23 Oktober 2026 dihitung 1 hari (BR-05).

* ☐ Setiap keputusan pengajuan, koreksi absensi, dan penerbitan slip muncul di *audit log* (BR-12).

* ☐ Halaman Laporan menampilkan minimal dua grafik dari data contoh.

* ☐ Aplikasi tayang di Netlify, semua halaman *noindex*, dan minimal 10 *test case* dari aturan bisnis dijalankan dan didokumentasikan hasilnya.

## **14\. Di Luar Lingkup**

Lembur dan perhitungannya, perhitungan PPh 21 dan BPJS otomatis, absensi dengan GPS, foto wajah, atau mesin sidik jari, *shift* kerja dan jadwal piket, rekrutmen, penilaian kinerja, pinjaman karyawan, aplikasi ponsel *native*, serta pengiriman gaji ke rekening bank.