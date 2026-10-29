/* =========================================================================
   DATA CONTOH — HANYA untuk mode demo (?demo=1).
   Transaksi, setoran immersion, sertifikat, dan absensi di bawah ini fiktif,
   dibuat agar grafik & rekap bisa dicoba. Tidak pernah dikirim ke Supabase
   dan tidak ikut di supabase/data-awal.
   ========================================================================= */
let s = 7;
const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const id = (p) => `${p}_demo${Math.floor(rnd() * 1e9).toString(36)}`;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const DEMO = 'Data contoh (mode demo)';

export function demoExtras(seed) {
  s = 7;
  const studs = seed.students;
  const byBatch = (b) => studs.filter(x => x.batch_id === b);
  const angk = { B1: 2023, B2: 2024, B3: 2025, B4: 2026 };

  // Perolehan mahasiswa: satu baris per mahasiswa (DU, DPP, UKT per semester), nominal fiktif
  const incomes = studs.map(st => ({
    id: id('inc'), batch_id: st.batch_id, nim: st.nim || '', nama_mahasiswa: st.nama,
    du: pick([700000, 1100000, 1700000, 2750000, 5000000]), dpp: pick([0, 6500000, 9000000, 12250000]), ukt_per_semester: pick([4900000, 5900000, 6900000, 7750000, 9900000]),
  }));

  // Pengeluaran divisi
  const E = (tanggal, kategori, uraian, jumlah, status = 'Lunas', batch_id = '') => ({ id: id('exp'), tanggal, kategori, uraian, jumlah, status, batch_id, penerima: '', metode: 'Transfer Bank', catatan: DEMO });
  const expenses = [
    E('2026-01-15', 'Honor Dosen & Praktisi', 'Honor Dosen External Genap 2025/2026 — termin 1', 8400000),
    E('2026-02-20', 'Kegiatan & Event', 'IBM Gathering & Company Visit', 5250000, 'Lunas', 'B3'),
    E('2026-03-12', 'Promosi & Marketing', 'Konten & iklan PMB IBM', 3000000),
    E('2026-04-08', 'Sertifikasi & Pelatihan', 'English Score Test batch 2', 6600000, 'Lunas', 'B2'),
    E('2026-05-22', 'Konsumsi & Rapat', 'Rapat koordinasi Dosen External', 950000),
    E('2026-06-30', 'Honor Dosen & Praktisi', 'Honor Dosen External Genap 2025/2026 — termin 2', 9100000),
    E('2026-08-18', 'ATK & Perlengkapan', 'Perlengkapan kelas Lounge & EXE', 1750000),
    E('2026-09-05', 'Kegiatan & Event', 'Orientasi mahasiswa Batch 4', 4300000, 'Lunas', 'B4'),
    E('2026-10-02', 'Langganan & Software', 'Langganan Canva & Zoom', 1200000),
    E('2026-10-20', 'Honor Dosen & Praktisi', 'Honor Dosen External Ganjil 2026/2027 — termin 1', 9800000, 'Menunggu Pembayaran'),
    E('2026-10-25', 'Transportasi & Akomodasi', 'Transport praktisi tamu dari Surabaya', 650000, 'Diajukan (Reimburse)'),
  ];

  // Immersion: target per batch + setoran
  const immersionTargets = [
    { id: id('imt'), batch_id: 'B2', program: 'Immersion Malaysia–Singapura 2027', destinasi: 'Kuala Lumpur & Singapura', target_per_mahasiswa: 12000000, tenggat: '2027-05-31', status: 'Aktif', catatan: DEMO },
    { id: id('imt'), batch_id: 'B3', program: 'Immersion Osaka 2028', destinasi: 'Osaka, Jepang', target_per_mahasiswa: 18000000, tenggat: '2028-03-31', status: 'Aktif', catatan: DEMO },
  ];
  const immersionSavings = [];
  for (const b of ['B2', 'B3']) {
    for (const st of byBatch(b)) {
      const n = Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) {
        const m = 1 + ((k + (b === 'B2' ? 2 : 4)) % 10);
        const last = k === n - 1;
        immersionSavings.push({ id: id('ims'), tanggal: iso(2026, Math.min(10, m), 1 + Math.floor(rnd() * 27)), batch_id: b, student_id: st.id, nim: st.nim || '', nama_mahasiswa: st.nama,
          jumlah: pick([500000, 750000, 1000000, 1500000, 2000000]), metode: 'Transfer Bank', status: last && rnd() > .6 ? 'Menunggu verifikasi' : 'Terverifikasi',
          bukti: rnd() > .15 ? { label: 'Bukti transfer', link: 'https://drive.google.com/' } : null, catatan: DEMO });
      }
    }
  }
  const immersionExpenses = [
    { id: id('ime'), tanggal: '2026-09-14', batch_id: 'B2', kategori: 'Tiket Pesawat', uraian: 'DP tiket rombongan (uang muka 30%)', jumlah: 21000000, student_id: '', nim: '', nama_mahasiswa: '', catatan: DEMO },
    { id: id('ime'), tanggal: '2026-10-03', batch_id: 'B2', kategori: 'Visa & Dokumen', uraian: 'Pengurusan paspor kolektif', jumlah: 3500000, student_id: '', nim: '', nama_mahasiswa: '', catatan: DEMO },
  ];

  // Sertifikat
  const certificates = [];
  for (const st of byBatch('B1')) {
    certificates.push({ id: id('cert'), batch_id: 'B1', student_id: st.id, nim: st.nim || '', nama_mahasiswa: st.nama, jenis: 'English Score Test', nama_sertifikat: 'English Score Test 1', penerbit: 'British Council', status: rnd() > .2 ? 'Sudah Terbit' : 'Proses', skor: String(110 + Math.floor(rnd() * 60)), catatan: DEMO });
    certificates.push({ id: id('cert'), batch_id: 'B1', student_id: st.id, nim: st.nim || '', nama_mahasiswa: st.nama, jenis: 'Public Speaking (Carabicara)', nama_sertifikat: 'Public Speaking Carabicara', penerbit: 'Carabicara', status: rnd() > .4 ? 'Sudah Terbit' : 'Belum', catatan: DEMO });
  }
  return { incomes, expenses, immersionTargets, immersionSavings, immersionExpenses, certificates };
}
