# Dashboard IBM — Institut Asia Malang

Dashboard internal **Divisi International Business Management (IBM)**.

- Alamat: **https://dashboard.ibmasia.ac.id** (subdomain dari ibmasia.ac.id, hosting Jagoan Hosting).
- Database & login: **Supabase**, project *dashboard* (`vhecgwfuoapzdwvephhz`), terpisah dari project website.
- Hanya **2 superadmin** yang bisa masuk: Karolus Danar (`danar@asia.ac.id`) dan Admin IBM (`ibm@asia.ac.id`). Sapaan di beranda mengikuti akun yang login.
- Tampilan memakai design token website IBM: biru `#173671`, emas `#EBB213`, Plus Jakarta Sans + Inter. Ada mode terang dan gelap (kunci `ibm_theme`, sama dengan website).
- Bahasa Indonesia sebagai bahasa utama, dengan tombol **ID / EN** di kanan atas.
- Responsif untuk Windows, macOS, iOS, dan Android. Di HP, tabel otomatis berubah menjadi kartu, jadi tidak perlu geser ke samping. Popup input muncul di tengah layar.

Dibuat dengan HTML, CSS, dan JavaScript murni (ES modules), tanpa `npm install` dan tanpa proses build.

---

## 1. Menjalankan di VS Code

1. Buka folder `ibm-dashboard` di VS Code.
2. Pasang ekstensi **Live Server** (VS Code akan menawarkannya otomatis).
3. Klik kanan `index.html`, lalu pilih **Open with Live Server**.

Ada dua cara membuka dashboard:

| Alamat | Mode |
|---|---|
| `http://127.0.0.1:5500/` | **Supabase**: login superadmin, data asli |
| `http://127.0.0.1:5500/?demo=1` | **Demo**: tanpa login, berisi data contoh di browser. Cocok untuk mencoba fitur tanpa menyentuh data asli |

> Jangan buka `index.html` dengan klik dua kali (`file://`), karena browser memblokir ES modules dari `file://`.
>
> Agar login juga bisa dipakai di Live Server, tambahkan `http://127.0.0.1:5500/**` di Redirect URLs Supabase (lihat panduan Supabase).

---

## 2. Panduan lain

| Dokumen | Isi |
|---|---|
| [`docs/PANDUAN-SUPABASE.md`](docs/PANDUAN-SUPABASE.md) | Membuat akun superadmin, pengaturan Auth, impor CSV per menu, urutan impor, dan menambah atau mencabut akses |
| [`docs/PANDUAN-DEPLOY.md`](docs/PANDUAN-DEPLOY.md) | Membuat subdomain `dashboard.ibmasia.ac.id` di Jagoan Hosting, mengunggah file, SSL, dan `.htaccess` |
| [`CLAUDE.md`](CLAUDE.md) | Peta kode untuk revisi lewat ekstensi Claude di VS Code |

---

## 3. Menu

| Menu | Isi |
|---|---|
| **Beranda** | Sapaan sesuai akun yang login, jam dan tanggal real-time WIB (Malang), kalender bulanan berisi kegiatan akademik (UTS/UAS/libur) dengan agenda kelas per tanggal, **pengingat data yang belum lengkap** (lengkap dengan tombol ke menunya), dan rekap setiap menu |
| **Pengeluaran Divisi** | Transaksi beserta bukti. Tab **Laporan** merekap pengeluaran per kategori, per batch, dan per bulan, termasuk pembayaran Trent yang sudah lunas. Bisa diekspor ke Excel/CSV dan dicetak/PDF |
| **Perolehan Mahasiswa** | Jenis pembayaran: **Daftar Ulang, DPP, UKT/SPP**. Tab **Rekapitulasi** berisi grafik per batch × jenis dan tabel rekap (jumlah mahasiswa yang sudah membayar dibanding mahasiswa aktif), serta ekspor Excel |
| **RPS & OBE** | Tab **Template RPS & OBE** menampilkan semua mata kuliah kurikulum beserta link draft/template RPS dan OBE masing-masing. Tab **Penilaian OBE** berisi daftar per periode dan batch (diambil dari jadwal). Tim IBM mengisi mata kuliah **Dosen External**, sedangkan dosen internal mengisi sendiri; statusnya tetap bisa dicatat |
| **Materi & PPT Dosen** | Link folder PPT, progres pertemuan, status, dan daftar dosen yang perlu ditagih |
| **Jadwal Kuliah** | Urutan tab: **Jadwal Full** (seluruh pertemuan satu semester, dikelompokkan per minggu), **Weekly** (grid jam × Senin–Sabtu dengan navigasi minggu dan tanda UTS/UAS/libur), **Daily** (kelas per tanggal dan absensi cepat Dosen External). Ada juga bagian kelas **tanpa hari/jam tetap**, tab **Slot jadwal**, dan tab **Kalender akademik** (format PDF akademik: Semester, Tahun Ajaran, Jenis Kegiatan, tanggal "… s.d. …") |
| **Absensi Dosen External** | Khusus kelas Dosen External. Berisi rekap kehadiran per kelas atau per dosen, **lembar absensi** (status, *dosen mengajar* dipilih dari dropdown Biodata Dosen, jam masuk–keluar, catatan), dan log absensi |
| **Trent Global College** | Pembayaran per batch per mata kuliah, matriks progres mahasiswa, dan silabus |
| **Immersion** | **Target tabungan per batch** (bisa berbeda tiap batch), **log setoran** (tanggal, jumlah, bukti TF, verifikasi), pengeluaran dana immersion, dan **rekap progres per mahasiswa**: terkumpul, kurang (Rp), dan persentase. Ada juga saldo dana dan perbandingan semua batch |
| **Sertifikat Mahasiswa** | Matriks per batch dan daftar sertifikat |
| **Biodata Mahasiswa** | Mengikuti Formulir Pendataan Mahasiswa. Bisa mencetak formulir yang sudah terisi maupun formulir kosong |
| **Biodata Dosen** | Dosen Internal dan Dosen External. Bisa diimpor dari Google Form Data Dosen |
| **Pengaturan** | **Umum** (profil divisi, penandatangan formulir, jumlah pertemuan, tarif & GST Trent), **Daftar pilihan** (kategori pengeluaran, jenis pemasukan, metode bayar, jenis sertifikat, kategori immersion, ruang), **Batch**, **Kurikulum**, **Akun superadmin** (daftar akses dan ganti kata sandi), serta **Data & impor** (template CSV per tabel Supabase, unduh data CSV, cadangan JSON, semua data ke Excel) |

Semua tabel mendukung pencarian, filter, urut kolom, ekspor Excel/CSV, dan impor Excel/CSV. Saat impor, kolom dicocokkan otomatis: nama kolom Google Sheets maupun nama kolom database Supabase dikenali.

---

## 4. Struktur folder

```
ibm-dashboard/
├── index.html                  ← halaman utama
├── .htaccess                   ← HTTPS, header keamanan, cache (untuk hosting)
├── assets/
│   ├── css/tokens.css          ← design token (sama dengan website)
│   ├── css/app.css             ← tata letak & komponen
│   ├── img/logo.svg
│   └── js/
│       ├── boot.js             ← pasang tema & bahasa sebelum halaman tampil
│       ├── app.js              ← kerangka, menu, login, router
│       ├── config.js           ← URL Supabase, alamat situs, nilai awal pengaturan
│       ├── schema.js           ← SKEMA DATABASE (satu sumber untuk tabel & CSV)
│       ├── store.js            ← akses data (Supabase / demo)
│       ├── i18n.js, i18n-en.js ← penerjemah ID → EN
│       ├── ui.js, form.js, table.js, crud.js, io.js, charts.js, jadwal-lib.js
│       ├── lib/sheet.js        ← baca/tulis Excel & CSV tanpa library
│       ├── data/               ← data awal (seed) & data contoh mode demo
│       └── modules/            ← satu file per menu
├── supabase/
│   ├── schema.sql              ← skema lengkap (sudah diterapkan ke project)
│   ├── template-csv/           ← header CSV kosong per tabel, untuk impor
│   └── data-awal/              ← data hasil konversi Google Sheets (opsional diimpor)
├── tools/build-supabase.mjs    ← membuat ulang schema.sql & CSV dari schema.js
└── docs/                       ← panduan Supabase & deploy
```

Jika menambah atau mengubah kolom: ubah `assets/js/schema.js`, jalankan `node tools/build-supabase.mjs`, lalu terapkan perubahan kolom di Supabase (SQL Editor) dan tambahkan field-nya di formulir modul terkait.

---

## 5. Keamanan

- `config.js` hanya berisi **publishable key**, yang aman berada di frontend. Seluruh tabel dikunci Row Level Security: hanya email yang terdaftar di tabel `admin_pengguna` yang bisa membaca atau menulis.
- Berkas unggahan disimpan di bucket privat `dashboard-files` dan dibuka lewat link sementara (30 menit).
- Jangan pernah menyimpan kata sandi (misalnya SIMAKA) di dashboard. Kolom tersebut sengaja diabaikan saat impor data dosen.
- Cadangan JSON berisi data pribadi, jadi simpan di tempat aman dan jangan diunggah ke repositori publik.
