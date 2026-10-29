-- =========================================================================
-- DASHBOARD IBM — skema Supabase (dibuat otomatis oleh tools/build-supabase.mjs)
-- Aman dijalankan ulang. Jalankan di Supabase → SQL Editor → New query → Run.
-- =========================================================================

-- 1) SUPERADMIN ---------------------------------------------------------------
-- Hanya email yang terdaftar di tabel ini yang bisa membaca/menulis data.
create table if not exists public.admin_pengguna (
  email      text primary key,
  nama       text not null,
  sapaan     text,
  peran      text not null default 'superadmin',
  created_at timestamptz not null default now()
);
alter table public.admin_pengguna enable row level security;

-- Fungsi pengecek berada di schema "private" (tidak terekspos ke API).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_pengguna a
    where lower(a.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "admin_pengguna_baca" on public.admin_pengguna;
create policy "admin_pengguna_baca" on public.admin_pengguna
  for select to authenticated using ((select private.is_admin()));

insert into public.admin_pengguna (email, nama, sapaan) values
  ('ibm@asia.ac.id',   'Admin IBM',               'Admin IBM'),
  ('danar@asia.ac.id', 'Karolus Danar Kurniawan', 'Pak Karolus')
on conflict (email) do nothing;

-- 2) FUNGSI BANTU ---------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.jwt() ->> 'email'), new.updated_by);
  return new;
end $$;

-- 3) TABEL PER MENU ---------------------------------------------------------------

-- Master Data: Daftar angkatan. Isi kolom id dengan kode singkat: B1, B2, B3, …
create table if not exists public.batch (
  id text primary key default gen_random_uuid()::text,
  nama text,
  angkatan integer,
  periode text,
  status text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.batch is 'Master Data — Daftar angkatan. Isi kolom id dengan kode singkat: B1, B2, B3, …';
alter table public.batch enable row level security;
drop policy if exists "batch_superadmin" on public.batch;
create policy "batch_superadmin" on public.batch
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists batch_updated on public.batch;
create trigger batch_updated before insert or update on public.batch
  for each row execute function public.set_updated_at();
create index if not exists batch_periode_idx on public.batch (periode);
comment on column public.batch.nama is 'Batch 1';
comment on column public.batch.angkatan is '2023';
comment on column public.batch.periode is '2023 – 2027';
comment on column public.batch.status is 'Aktif / Lulus / Belum mulai';

-- Master Data: Kurikulum / CSPP: satu baris per mata kuliah.
create table if not exists public.kurikulum (
  id text primary key default gen_random_uuid()::text,
  semester integer,
  kode text,
  nama_en text,
  nama_id text,
  sks integer,
  rumpun text,
  jenis_pengampu text,
  pengampu text,
  mitra text,
  mode text,
  trent_code text,
  obe boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.kurikulum is 'Master Data — Kurikulum / CSPP: satu baris per mata kuliah.';
alter table public.kurikulum enable row level security;
drop policy if exists "kurikulum_superadmin" on public.kurikulum;
create policy "kurikulum_superadmin" on public.kurikulum
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists kurikulum_updated on public.kurikulum;
create trigger kurikulum_updated before insert or update on public.kurikulum
  for each row execute function public.set_updated_at();
comment on column public.kurikulum.semester is '1–8';
comment on column public.kurikulum.kode is 'MJF231002';
comment on column public.kurikulum.nama_en is 'Micro Economy';
comment on column public.kurikulum.nama_id is 'Ekonomi Mikro';
comment on column public.kurikulum.rumpun is 'MKD/MKF/MKI/MKP/MKPil/MKL/MKK/IBM Activity';
comment on column public.kurikulum.jenis_pengampu is 'Dosen Internal / Dosen External / Ikut Fakultas';
comment on column public.kurikulum.mode is 'Onsite / Hybrid / Online / Konversi Magang / Immersion';
comment on column public.kurikulum.trent_code is 'DTG-04, ITH-01 … (kosong bila bukan Trent)';
comment on column public.kurikulum.obe is 'true / false';

-- Pengeluaran Divisi: Transaksi pengeluaran divisi IBM.
create table if not exists public.pengeluaran (
  id text primary key default gen_random_uuid()::text,
  tanggal date,
  kategori text,
  uraian text,
  jumlah numeric,
  status text,
  penerima text,
  metode text,
  batch_id text,
  no_bukti text,
  bukti_label text,
  bukti_link text,
  bukti_file jsonb,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.pengeluaran is 'Pengeluaran Divisi — Transaksi pengeluaran divisi IBM.';
alter table public.pengeluaran enable row level security;
drop policy if exists "pengeluaran_superadmin" on public.pengeluaran;
create policy "pengeluaran_superadmin" on public.pengeluaran
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists pengeluaran_updated on public.pengeluaran;
create trigger pengeluaran_updated before insert or update on public.pengeluaran
  for each row execute function public.set_updated_at();
create index if not exists pengeluaran_tanggal_idx on public.pengeluaran (tanggal);
create index if not exists pengeluaran_batch_id_idx on public.pengeluaran (batch_id);
comment on column public.pengeluaran.tanggal is 'YYYY-MM-DD';
comment on column public.pengeluaran.jumlah is 'angka tanpa titik, mis. 1750000';
comment on column public.pengeluaran.status is 'Lunas / Menunggu Pembayaran / Diajukan (Reimburse) / Dibatalkan';
comment on column public.pengeluaran.batch_id is 'B1, B2 … (kosong = umum)';

-- Perolehan Mahasiswa: Pembayaran mahasiswa: Daftar Ulang, DPP, UKT/SPP.
create table if not exists public.pemasukan (
  id text primary key default gen_random_uuid()::text,
  tanggal date,
  batch_id text,
  student_id text,
  nim text,
  nama_mahasiswa text,
  jenis text,
  semester integer,
  jumlah numeric,
  status text,
  metode text,
  no_bukti text,
  bukti_label text,
  bukti_link text,
  bukti_file jsonb,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.pemasukan is 'Perolehan Mahasiswa — Pembayaran mahasiswa: Daftar Ulang, DPP, UKT/SPP.';
alter table public.pemasukan enable row level security;
drop policy if exists "pemasukan_superadmin" on public.pemasukan;
create policy "pemasukan_superadmin" on public.pemasukan
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists pemasukan_updated on public.pemasukan;
create trigger pemasukan_updated before insert or update on public.pemasukan
  for each row execute function public.set_updated_at();
create index if not exists pemasukan_tanggal_idx on public.pemasukan (tanggal);
create index if not exists pemasukan_batch_id_idx on public.pemasukan (batch_id);
create index if not exists pemasukan_student_id_idx on public.pemasukan (student_id);
create index if not exists pemasukan_nim_idx on public.pemasukan (nim);
comment on column public.pemasukan.batch_id is 'B1, B2 …';
comment on column public.pemasukan.student_id is 'id mahasiswa (opsional bila nim/nama diisi)';
comment on column public.pemasukan.jenis is 'Daftar Ulang / DPP / UKT/SPP';
comment on column public.pemasukan.status is 'Lunas / Cicilan / Belum Lunas / Dibatalkan';

-- RPS & OBE: Draft/template RPS dan OBE untuk setiap mata kuliah.
create table if not exists public.rps_obe_template (
  id text primary key default gen_random_uuid()::text,
  course_id text,
  kode_mk text,
  mata_kuliah text,
  semester integer,
  versi text,
  dosen_penyusun text,
  template_rps_label text,
  template_rps_link text,
  template_rps_file jsonb,
  template_obe_label text,
  template_obe_link text,
  template_obe_file jsonb,
  status text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.rps_obe_template is 'RPS & OBE — Draft/template RPS dan OBE untuk setiap mata kuliah.';
alter table public.rps_obe_template enable row level security;
drop policy if exists "rps_obe_template_superadmin" on public.rps_obe_template;
create policy "rps_obe_template_superadmin" on public.rps_obe_template
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists rps_obe_template_updated on public.rps_obe_template;
create trigger rps_obe_template_updated before insert or update on public.rps_obe_template
  for each row execute function public.set_updated_at();
create index if not exists rps_obe_template_course_id_idx on public.rps_obe_template (course_id);
comment on column public.rps_obe_template.course_id is 'id kurikulum (opsional bila kode_mk/mata_kuliah diisi)';
comment on column public.rps_obe_template.versi is 'mis. OBE 2024';
comment on column public.rps_obe_template.status is 'Draft / Revisi / Final';

-- RPS & OBE: Penilaian OBE per mata kuliah, batch, dan periode (wajib diisi tim untuk Dosen External).
create table if not exists public.penilaian_obe (
  id text primary key default gen_random_uuid()::text,
  periode text,
  batch_id text,
  course_id text,
  kode_mk text,
  mata_kuliah text,
  semester integer,
  dosen text,
  jenis_dosen text,
  berkas_label text,
  berkas_link text,
  berkas_file jsonb,
  status text,
  tanggal_selesai date,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.penilaian_obe is 'RPS & OBE — Penilaian OBE per mata kuliah, batch, dan periode (wajib diisi tim untuk Dosen External).';
alter table public.penilaian_obe enable row level security;
drop policy if exists "penilaian_obe_superadmin" on public.penilaian_obe;
create policy "penilaian_obe_superadmin" on public.penilaian_obe
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists penilaian_obe_updated on public.penilaian_obe;
create trigger penilaian_obe_updated before insert or update on public.penilaian_obe
  for each row execute function public.set_updated_at();
create index if not exists penilaian_obe_periode_idx on public.penilaian_obe (periode);
create index if not exists penilaian_obe_batch_id_idx on public.penilaian_obe (batch_id);
create index if not exists penilaian_obe_course_id_idx on public.penilaian_obe (course_id);
comment on column public.penilaian_obe.periode is 'Ganjil 2026/2027';
comment on column public.penilaian_obe.jenis_dosen is 'Dosen External / Dosen Internal';
comment on column public.penilaian_obe.status is 'Belum / Proses / Selesai';

-- Materi & PPT Dosen: Link materi/PPT tiap mata kuliah.
create table if not exists public.materi_ppt (
  id text primary key default gen_random_uuid()::text,
  mata_kuliah text,
  dosen text,
  prodi text,
  periode text,
  batch_id text,
  materi_label text,
  materi_link text,
  materi_file jsonb,
  pertemuan_tersedia integer,
  target_pertemuan integer,
  status text,
  cakupan text,
  gclassroom text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.materi_ppt is 'Materi & PPT Dosen — Link materi/PPT tiap mata kuliah.';
alter table public.materi_ppt enable row level security;
drop policy if exists "materi_ppt_superadmin" on public.materi_ppt;
create policy "materi_ppt_superadmin" on public.materi_ppt
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists materi_ppt_updated on public.materi_ppt;
create trigger materi_ppt_updated before insert or update on public.materi_ppt
  for each row execute function public.set_updated_at();
create index if not exists materi_ppt_periode_idx on public.materi_ppt (periode);
create index if not exists materi_ppt_batch_id_idx on public.materi_ppt (batch_id);
comment on column public.materi_ppt.prodi is 'IBM / Manajemen / Akuntansi / Lainnya';
comment on column public.materi_ppt.periode is 'Ganjil 2025/2026';
comment on column public.materi_ppt.status is 'Lengkap / Belum Lengkap';
comment on column public.materi_ppt.cakupan is 'Pertemuan 1-14';

-- Jadwal Kuliah: Kalender akademik dari bagian akademik (sesuai PDF).
create table if not exists public.kalender_akademik (
  id text primary key default gen_random_uuid()::text,
  semester text,
  tahun_ajaran text,
  kegiatan text,
  mulai date,
  selesai date,
  kategori text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.kalender_akademik is 'Jadwal Kuliah — Kalender akademik dari bagian akademik (sesuai PDF).';
alter table public.kalender_akademik enable row level security;
drop policy if exists "kalender_akademik_superadmin" on public.kalender_akademik;
create policy "kalender_akademik_superadmin" on public.kalender_akademik
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists kalender_akademik_updated on public.kalender_akademik;
create trigger kalender_akademik_updated before insert or update on public.kalender_akademik
  for each row execute function public.set_updated_at();
comment on column public.kalender_akademik.semester is 'Ganjil / Genap';
comment on column public.kalender_akademik.tahun_ajaran is '2026/2027';
comment on column public.kalender_akademik.kegiatan is 'mis. Perkuliahan, UTS, UAS, Libur Natal';
comment on column public.kalender_akademik.mulai is 'YYYY-MM-DD';
comment on column public.kalender_akademik.selesai is 'YYYY-MM-DD';
comment on column public.kalender_akademik.kategori is 'Perkuliahan / UTS / UAS / Libur / Lainnya (kosong = dideteksi otomatis)';

-- Jadwal Kuliah: Slot kuliah mingguan per batch per periode.
create table if not exists public.jadwal_kuliah (
  id text primary key default gen_random_uuid()::text,
  periode text,
  batch_id text,
  semester integer,
  tipe text,
  course_id text,
  kode text,
  mata_kuliah text,
  nama_id text,
  dosen text,
  jenis_dosen text,
  hari text,
  jam_mulai text,
  jam_selesai text,
  ruang text,
  sks integer,
  mode text,
  jumlah_pertemuan integer,
  status text,
  classroom text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.jadwal_kuliah is 'Jadwal Kuliah — Slot kuliah mingguan per batch per periode.';
alter table public.jadwal_kuliah enable row level security;
drop policy if exists "jadwal_kuliah_superadmin" on public.jadwal_kuliah;
create policy "jadwal_kuliah_superadmin" on public.jadwal_kuliah
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists jadwal_kuliah_updated on public.jadwal_kuliah;
create trigger jadwal_kuliah_updated before insert or update on public.jadwal_kuliah
  for each row execute function public.set_updated_at();
create index if not exists jadwal_kuliah_periode_idx on public.jadwal_kuliah (periode);
create index if not exists jadwal_kuliah_batch_id_idx on public.jadwal_kuliah (batch_id);
create index if not exists jadwal_kuliah_course_id_idx on public.jadwal_kuliah (course_id);
comment on column public.jadwal_kuliah.periode is 'Ganjil 2026/2027';
comment on column public.jadwal_kuliah.tipe is 'Kuliah / Trent / IBM Activity';
comment on column public.jadwal_kuliah.jenis_dosen is 'Dosen External / Dosen Internal / Ikut Fakultas (kosong = otomatis)';
comment on column public.jadwal_kuliah.hari is 'Senin … Sabtu (kosong = tanpa hari tetap)';
comment on column public.jadwal_kuliah.jam_mulai is '09:30';
comment on column public.jadwal_kuliah.jam_selesai is '12:00';
comment on column public.jadwal_kuliah.jumlah_pertemuan is '16';
comment on column public.jadwal_kuliah.status is 'Confirmed / TBC';

-- Absensi Dosen: Absensi Dosen External per pertemuan (diisi tim IBM).
create table if not exists public.absensi_dosen (
  id text primary key default gen_random_uuid()::text,
  schedule_id text,
  periode text,
  batch_id text,
  mata_kuliah text,
  pertemuan integer,
  jenis text,
  tanggal date,
  status text,
  dosen_jadwal text,
  dosen_hadir text,
  jam_masuk text,
  jam_keluar text,
  catatan text,
  dicatat_oleh text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.absensi_dosen is 'Absensi Dosen — Absensi Dosen External per pertemuan (diisi tim IBM).';
alter table public.absensi_dosen enable row level security;
drop policy if exists "absensi_dosen_superadmin" on public.absensi_dosen;
create policy "absensi_dosen_superadmin" on public.absensi_dosen
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists absensi_dosen_updated on public.absensi_dosen;
create trigger absensi_dosen_updated before insert or update on public.absensi_dosen
  for each row execute function public.set_updated_at();
create index if not exists absensi_dosen_schedule_id_idx on public.absensi_dosen (schedule_id);
create index if not exists absensi_dosen_periode_idx on public.absensi_dosen (periode);
create index if not exists absensi_dosen_batch_id_idx on public.absensi_dosen (batch_id);
create index if not exists absensi_dosen_tanggal_idx on public.absensi_dosen (tanggal);
comment on column public.absensi_dosen.jenis is 'Kuliah / UTS / UAS';
comment on column public.absensi_dosen.status is 'Hadir / Terlambat / Online (daring) / Diganti dosen lain / Tugas mandiri / Tidak hadir / Dijadwal ulang / Libur';

-- Trent Global College: Mata kuliah Trent & silabus (satu pertemuan per baris).
create table if not exists public.trent_mata_kuliah (
  id text primary key default gen_random_uuid()::text,
  kode text,
  asia_code text,
  nama text,
  semester integer,
  link_mdd text,
  link_rps text,
  silabus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.trent_mata_kuliah is 'Trent Global College — Mata kuliah Trent & silabus (satu pertemuan per baris).';
alter table public.trent_mata_kuliah enable row level security;
drop policy if exists "trent_mata_kuliah_superadmin" on public.trent_mata_kuliah;
create policy "trent_mata_kuliah_superadmin" on public.trent_mata_kuliah
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists trent_mata_kuliah_updated on public.trent_mata_kuliah;
create trigger trent_mata_kuliah_updated before insert or update on public.trent_mata_kuliah
  for each row execute function public.set_updated_at();
comment on column public.trent_mata_kuliah.kode is 'DTG-04';

-- Trent Global College: Tagihan & pembayaran Trent per batch per mata kuliah.
create table if not exists public.trent_pembayaran (
  id text primary key default gen_random_uuid()::text,
  batch_id text,
  trent_code text,
  asia_code text,
  subjek text,
  semester integer,
  progres text,
  jumlah_mahasiswa integer,
  mahasiswa_aktif integer,
  tuition_sgd numeric,
  total_sgd numeric,
  gst_sgd numeric,
  kurs numeric,
  total_idr numeric,
  status_bayar text,
  tanggal_bayar date,
  invoice_no text,
  bukti_label text,
  bukti_link text,
  bukti_file jsonb,
  marksheet_label text,
  marksheet_link text,
  marksheet_file jsonb,
  marksheet_status text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.trent_pembayaran is 'Trent Global College — Tagihan & pembayaran Trent per batch per mata kuliah.';
alter table public.trent_pembayaran enable row level security;
drop policy if exists "trent_pembayaran_superadmin" on public.trent_pembayaran;
create policy "trent_pembayaran_superadmin" on public.trent_pembayaran
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists trent_pembayaran_updated on public.trent_pembayaran;
create trigger trent_pembayaran_updated before insert or update on public.trent_pembayaran
  for each row execute function public.set_updated_at();
create index if not exists trent_pembayaran_batch_id_idx on public.trent_pembayaran (batch_id);
comment on column public.trent_pembayaran.progres is 'Upcoming / On Progress / Done';
comment on column public.trent_pembayaran.status_bayar is 'Lunas / Belum Dibayar / Belum Ditagih';

-- Trent Global College: Centang mata kuliah Trent yang sudah diselesaikan tiap mahasiswa.
create table if not exists public.trent_progres_mahasiswa (
  id text primary key default gen_random_uuid()::text,
  student_id text,
  nim text,
  nama_mahasiswa text,
  batch_id text,
  dtg_04 boolean,
  dtg_03 boolean,
  ith_01 boolean,
  ith_02 boolean,
  ith_03 boolean,
  ith_04 boolean,
  remarks text,
  status_bayar text,
  tanggal_bayar text,
  bukti_nama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.trent_progres_mahasiswa is 'Trent Global College — Centang mata kuliah Trent yang sudah diselesaikan tiap mahasiswa.';
alter table public.trent_progres_mahasiswa enable row level security;
drop policy if exists "trent_progres_mahasiswa_superadmin" on public.trent_progres_mahasiswa;
create policy "trent_progres_mahasiswa_superadmin" on public.trent_progres_mahasiswa
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists trent_progres_mahasiswa_updated on public.trent_progres_mahasiswa;
create trigger trent_progres_mahasiswa_updated before insert or update on public.trent_progres_mahasiswa
  for each row execute function public.set_updated_at();
create index if not exists trent_progres_mahasiswa_student_id_idx on public.trent_progres_mahasiswa (student_id);
create index if not exists trent_progres_mahasiswa_nim_idx on public.trent_progres_mahasiswa (nim);
create index if not exists trent_progres_mahasiswa_batch_id_idx on public.trent_progres_mahasiswa (batch_id);

-- Sertifikat Mahasiswa: Sertifikat tiap mahasiswa per batch.
create table if not exists public.sertifikat (
  id text primary key default gen_random_uuid()::text,
  batch_id text,
  student_id text,
  nim text,
  nama_mahasiswa text,
  jenis text,
  nama_sertifikat text,
  penerbit text,
  nomor text,
  tanggal_terbit date,
  berlaku_sampai date,
  skor text,
  status text,
  berkas_label text,
  berkas_link text,
  berkas_file jsonb,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.sertifikat is 'Sertifikat Mahasiswa — Sertifikat tiap mahasiswa per batch.';
alter table public.sertifikat enable row level security;
drop policy if exists "sertifikat_superadmin" on public.sertifikat;
create policy "sertifikat_superadmin" on public.sertifikat
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists sertifikat_updated on public.sertifikat;
create trigger sertifikat_updated before insert or update on public.sertifikat
  for each row execute function public.set_updated_at();
create index if not exists sertifikat_batch_id_idx on public.sertifikat (batch_id);
create index if not exists sertifikat_student_id_idx on public.sertifikat (student_id);
create index if not exists sertifikat_nim_idx on public.sertifikat (nim);
comment on column public.sertifikat.status is 'Sudah Terbit / Proses / Belum';

-- Biodata Mahasiswa: Biodata sesuai Formulir Pendataan Mahasiswa IBM.
create table if not exists public.mahasiswa (
  id text primary key default gen_random_uuid()::text,
  nama text,
  nim text,
  nik text,
  tempat_lahir text,
  tanggal_lahir date,
  jk text,
  agama text,
  kewarganegaraan text,
  telp text,
  email text,
  alamat_ktp text,
  kota text,
  kode_pos text,
  nama_ayah text,
  nama_ibu text,
  telp_ayah text,
  telp_ibu text,
  pekerjaan_ayah text,
  pekerjaan_ibu text,
  penghasilan_ayah text,
  penghasilan_ibu text,
  wali_nama text,
  wali_telp text,
  wali_hubungan text,
  prodi text,
  fakultas text,
  batch_id text,
  angkatan integer,
  status_mhs text,
  hardskill_1 text,
  hardskill_2 text,
  hardskill_3 text,
  softskill text,
  magang_instansi text,
  magang_alamat text,
  magang_posisi text,
  magang_mulai date,
  magang_selesai date,
  pembimbing_lapangan text,
  pembimbing_akademik text,
  dokumen_magang text,
  berkas_magang_label text,
  berkas_magang_link text,
  berkas_magang_file jsonb,
  pernyataan boolean,
  tempat_ttd text,
  tanggal_ttd date,
  formulir_label text,
  formulir_link text,
  formulir_file jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.mahasiswa is 'Biodata Mahasiswa — Biodata sesuai Formulir Pendataan Mahasiswa IBM.';
alter table public.mahasiswa enable row level security;
drop policy if exists "mahasiswa_superadmin" on public.mahasiswa;
create policy "mahasiswa_superadmin" on public.mahasiswa
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists mahasiswa_updated on public.mahasiswa;
create trigger mahasiswa_updated before insert or update on public.mahasiswa
  for each row execute function public.set_updated_at();
create index if not exists mahasiswa_nim_idx on public.mahasiswa (nim);
create index if not exists mahasiswa_batch_id_idx on public.mahasiswa (batch_id);
comment on column public.mahasiswa.jk is 'L / P';
comment on column public.mahasiswa.status_mhs is 'Mahasiswa Aktif / Cuti / Lulus / Non-aktif / Mengundurkan Diri';
comment on column public.mahasiswa.dokumen_magang is 'CV, Surat Permohonan, Transkrip Nilai, Lainnya';

-- Biodata Dosen: Biodata dosen internal & Dosen External (format Google Form Data Dosen).
create table if not exists public.dosen (
  id text primary key default gen_random_uuid()::text,
  nama text,
  tipe text,
  status text,
  nidn text,
  instansi text,
  jabatan text,
  email text,
  telp text,
  tanggal_lahir date,
  alamat text,
  s1 text,
  s2 text,
  s3 text,
  lainnya text,
  mata_kuliah text,
  pengalaman_kerja text,
  pengalaman_organisasi text,
  rekening text,
  npwp text,
  honor_per_sks numeric,
  foto_link text,
  cv_link text,
  dokumen_label text,
  dokumen_link text,
  dokumen_file jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.dosen is 'Biodata Dosen — Biodata dosen internal & Dosen External (format Google Form Data Dosen).';
alter table public.dosen enable row level security;
drop policy if exists "dosen_superadmin" on public.dosen;
create policy "dosen_superadmin" on public.dosen
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists dosen_updated on public.dosen;
create trigger dosen_updated before insert or update on public.dosen
  for each row execute function public.set_updated_at();
comment on column public.dosen.tipe is 'Dosen Internal / Dosen External';
comment on column public.dosen.status is 'Aktif / Tidak aktif';

-- Immersion: Target tabungan immersion per batch.
create table if not exists public.immersion_target (
  id text primary key default gen_random_uuid()::text,
  batch_id text,
  program text,
  destinasi text,
  target_per_mahasiswa numeric,
  tenggat date,
  status text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.immersion_target is 'Immersion — Target tabungan immersion per batch.';
alter table public.immersion_target enable row level security;
drop policy if exists "immersion_target_superadmin" on public.immersion_target;
create policy "immersion_target_superadmin" on public.immersion_target
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists immersion_target_updated on public.immersion_target;
create trigger immersion_target_updated before insert or update on public.immersion_target
  for each row execute function public.set_updated_at();
create index if not exists immersion_target_batch_id_idx on public.immersion_target (batch_id);
comment on column public.immersion_target.program is 'Immersion Osaka 2027';
comment on column public.immersion_target.status is 'Aktif / Selesai';

-- Immersion: Log setoran tabungan immersion per mahasiswa.
create table if not exists public.immersion_tabungan (
  id text primary key default gen_random_uuid()::text,
  tanggal date,
  batch_id text,
  student_id text,
  nim text,
  nama_mahasiswa text,
  jumlah numeric,
  metode text,
  status text,
  bukti_label text,
  bukti_link text,
  bukti_file jsonb,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.immersion_tabungan is 'Immersion — Log setoran tabungan immersion per mahasiswa.';
alter table public.immersion_tabungan enable row level security;
drop policy if exists "immersion_tabungan_superadmin" on public.immersion_tabungan;
create policy "immersion_tabungan_superadmin" on public.immersion_tabungan
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists immersion_tabungan_updated on public.immersion_tabungan;
create trigger immersion_tabungan_updated before insert or update on public.immersion_tabungan
  for each row execute function public.set_updated_at();
create index if not exists immersion_tabungan_tanggal_idx on public.immersion_tabungan (tanggal);
create index if not exists immersion_tabungan_batch_id_idx on public.immersion_tabungan (batch_id);
create index if not exists immersion_tabungan_student_id_idx on public.immersion_tabungan (student_id);
create index if not exists immersion_tabungan_nim_idx on public.immersion_tabungan (nim);
comment on column public.immersion_tabungan.status is 'Terverifikasi / Menunggu verifikasi / Ditolak';

-- Immersion: Pengeluaran dana immersion (kolektif batch atau atas nama mahasiswa).
create table if not exists public.immersion_pengeluaran (
  id text primary key default gen_random_uuid()::text,
  tanggal date,
  batch_id text,
  kategori text,
  uraian text,
  jumlah numeric,
  student_id text,
  nim text,
  nama_mahasiswa text,
  bukti_label text,
  bukti_link text,
  bukti_file jsonb,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.immersion_pengeluaran is 'Immersion — Pengeluaran dana immersion (kolektif batch atau atas nama mahasiswa).';
alter table public.immersion_pengeluaran enable row level security;
drop policy if exists "immersion_pengeluaran_superadmin" on public.immersion_pengeluaran;
create policy "immersion_pengeluaran_superadmin" on public.immersion_pengeluaran
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists immersion_pengeluaran_updated on public.immersion_pengeluaran;
create trigger immersion_pengeluaran_updated before insert or update on public.immersion_pengeluaran
  for each row execute function public.set_updated_at();
create index if not exists immersion_pengeluaran_tanggal_idx on public.immersion_pengeluaran (tanggal);
create index if not exists immersion_pengeluaran_batch_id_idx on public.immersion_pengeluaran (batch_id);
create index if not exists immersion_pengeluaran_student_id_idx on public.immersion_pengeluaran (student_id);
create index if not exists immersion_pengeluaran_nim_idx on public.immersion_pengeluaran (nim);
comment on column public.immersion_pengeluaran.student_id is 'kosong = kolektif';

-- Pengaturan: Pengaturan aplikasi (dikelola dari menu Pengaturan).
create table if not exists public.pengaturan (
  id text primary key default gen_random_uuid()::text,
  nilai jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.pengaturan is 'Pengaturan — Pengaturan aplikasi (dikelola dari menu Pengaturan).';
alter table public.pengaturan enable row level security;
drop policy if exists "pengaturan_superadmin" on public.pengaturan;
create policy "pengaturan_superadmin" on public.pengaturan
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop trigger if exists pengaturan_updated on public.pengaturan;
create trigger pengaturan_updated before insert or update on public.pengaturan
  for each row execute function public.set_updated_at();

-- 4) PENYIMPANAN BERKAS (bukti transfer, RPS, OBE, sertifikat, dll.) ---------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('dashboard-files', 'dashboard-files', false, 15728640)
on conflict (id) do nothing;

drop policy if exists "dashboard_files_baca"  on storage.objects;
drop policy if exists "dashboard_files_tulis" on storage.objects;
drop policy if exists "dashboard_files_ubah"  on storage.objects;
drop policy if exists "dashboard_files_hapus" on storage.objects;
create policy "dashboard_files_baca"  on storage.objects for select to authenticated using (bucket_id = 'dashboard-files' and (select private.is_admin()));
create policy "dashboard_files_tulis" on storage.objects for insert to authenticated with check (bucket_id = 'dashboard-files' and (select private.is_admin()));
create policy "dashboard_files_ubah"  on storage.objects for update to authenticated using (bucket_id = 'dashboard-files' and (select private.is_admin()));
create policy "dashboard_files_hapus" on storage.objects for delete to authenticated using (bucket_id = 'dashboard-files' and (select private.is_admin()));
