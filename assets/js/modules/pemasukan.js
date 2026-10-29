/* =========================================================================
   2. KEUANGAN — PEROLEHAN DARI MAHASISWA
   Jenis pemasukan: Daftar Ulang, DPP, UKT/SPP (bisa diubah di Pengaturan).
   Tab Transaksi (input & daftar) + tab Rekapitulasi (grafik per batch).
   ========================================================================= */
import { h, icon, clear, fmtIDR, fmtDate, sum, uniq, badge, docLink, batchName, batchOptions, batches, studentOf, today, parseDate, tabs, pref } from '../ui.js';
import { crudView, kpiRow } from '../crud.js';
import { groupedBars } from '../charts.js';
import { dataTable } from '../table.js';
import { exportWorkbook } from '../io.js';
import { store } from '../store.js';

const JENIS = () => store.list('jenis_pemasukan');
const METODE = () => store.list('metode_bayar');
const STATUS = ['Lunas', 'Cicilan', 'Belum Lunas', 'Dibatalkan'];
const yearOf = (d) => { const x = parseDate(d); return x ? x.getFullYear() : ''; };
/** Yang dihitung sebagai perolehan: Lunas & Cicilan */
const valid = (rows) => rows.filter(r => r.status !== 'Dibatalkan' && r.status !== 'Belum Lunas');
const studentKey = (r) => r.student_id || r.nim || r.nama_mahasiswa || '';

const sections = [
  { title: 'Pembayaran', fields: [
    { key: 'tanggal', label: 'Tanggal diterima', type: 'date', required: true, col: 'half', default: () => today() },
    { key: 'batch_id', label: 'Batch', type: 'batch', required: true, col: 'half' },
    { key: 'student_id', label: 'Mahasiswa', type: 'student', batchKey: 'batch_id', placeholder: '— Pilih mahasiswa (kosongkan bila pembayaran kolektif) —', help: 'Daftar mengikuti batch yang dipilih. Tambah mahasiswa baru di menu Biodata Mahasiswa.' },
    { key: 'jenis', label: 'Jenis pemasukan', type: 'select', options: JENIS, required: true, col: 'half' },
    { key: 'semester', label: 'Semester', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7', '8'], col: 'half', placeholder: '— Tidak spesifik —' },
    { key: 'jumlah', label: 'Jumlah', type: 'money', required: true, col: 'half' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS, col: 'half', default: 'Lunas' },
    { key: 'metode', label: 'Metode', type: 'select', options: METODE, col: 'half', default: 'Transfer Bank' },
    { key: 'no_bukti', label: 'No. kwitansi / referensi', type: 'text', col: 'half' },
  ] },
  { title: 'Bukti & catatan', fields: [
    { key: 'bukti', label: 'Bukti pembayaran', type: 'attachment', accept: 'image/*,.pdf' },
    { key: 'catatan', label: 'Catatan', type: 'textarea' },
  ] },
];

const columns = [
  { key: 'tanggal', label: 'Tanggal', render: r => fmtDate(r.tanggal), nowrap: true },
  { key: 'mahasiswa', label: 'Mahasiswa', main: true, value: r => studentKey(r) ? studentOf(r) : '(kolektif)', render: r => h('div', {}, h('span', { class: 'primary' }, studentKey(r) ? studentOf(r) : 'Pembayaran kolektif'), h('span', { class: 'secondary' }, [batchName(r.batch_id), r.nim].filter(Boolean).join(' · '))) },
  { key: 'jenis', label: 'Jenis', render: r => h('div', {}, r.jenis || '–', r.semester ? h('span', { class: 'secondary' }, `Semester ${r.semester}`) : null) },
  { key: 'metode', label: 'Metode', nowrap: true },
  { key: 'status', label: 'Status', render: r => badge(r.status) },
  { key: 'jumlah', label: 'Jumlah', align: 'right', money: true, value: r => Number(r.jumlah) || 0, render: r => h('span', { class: 'num' }, fmtIDR(r.jumlah)), nowrap: true },
  { key: 'bukti', label: 'Bukti', sortable: false, render: r => docLink(r.bukti, '–') },
];
const exportCols = [
  { key: 'tanggal', label: 'Tanggal' }, { key: 'batch_id', label: 'Batch', value: r => batchName(r.batch_id) },
  { key: 'mahasiswa', label: 'Mahasiswa', value: r => studentKey(r) ? studentOf(r) : '(kolektif)' }, { key: 'nim', label: 'NIM' },
  { key: 'jenis', label: 'Jenis' }, { key: 'semester', label: 'Semester' }, { key: 'jumlah', label: 'Jumlah (Rp)', money: true, value: r => Number(r.jumlah) || 0 },
  { key: 'status', label: 'Status' }, { key: 'metode', label: 'Metode' }, { key: 'no_bukti', label: 'No. Bukti' }, { key: 'bukti', label: 'Bukti' }, { key: 'catatan', label: 'Catatan' },
];

/* ---------- Agregasi ---------- */
function recap(rows) {
  const jenis = JENIS();
  return batches().map(b => {
    const rs = valid(rows.filter(r => r.batch_id === b.id));
    const mhs = store.all('students').filter(s => s.batch_id === b.id && !/non-aktif|mengundurkan|drop/i.test(s.status_mhs || '')).length;
    const per = Object.fromEntries(jenis.map(j => { const x = rs.filter(r => r.jenis === j); return [j, { total: sum(x, 'jumlah'), payers: uniq(x.map(studentKey)).length }]; }));
    const lain = rs.filter(r => !jenis.includes(r.jenis));
    return { batch: b, mhs, per, lain: sum(lain, 'jumlah'), total: sum(rs, 'jumlah'), n: rs.length, payers: uniq(rs.map(studentKey)).length };
  });
}

function rekapExcel(rows, label) {
  const T = (v) => ({ v, bold: true }); const jenis = JENIS(); const rc = recap(rows);
  const money = (from, n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [from + i, 'money']));
  exportWorkbook(`Rekap_Perolehan_Mahasiswa_${label.replace(/\s+/g, '_')}`, [
    { name: 'Batch x Jenis', numFmt: money(2, jenis.length + 2), rows: [['Batch', 'Mahasiswa aktif', ...jenis.map(j => `${j} (Rp)`), 'Lainnya (Rp)', 'Total (Rp)'],
      ...rc.map(x => [x.batch.nama, x.mhs, ...jenis.map(j => x.per[j].total), x.lain, x.total]),
      [T('TOTAL'), T(sum(rc, 'mhs')), ...jenis.map(j => T(sum(rc, x => x.per[j].total))), T(sum(rc, 'lain')), T(sum(rc, 'total'))]] },
    { name: 'Cakupan Pembayar', rows: [['Batch', 'Mahasiswa aktif', ...jenis.map(j => `Sudah bayar ${j}`)], ...rc.map(x => [x.batch.nama, x.mhs, ...jenis.map(j => x.per[j].payers)])] },
    { name: 'Per Mahasiswa', numFmt: money(3, jenis.length + 1), rows: [['Batch', 'Mahasiswa', 'NIM', ...jenis.map(j => `${j} (Rp)`), 'Total (Rp)'],
      ...store.all('students').slice().sort((a, b) => (a.batch_id + a.nama).localeCompare(b.batch_id + b.nama)).map(s => {
        const rs = valid(rows.filter(r => r.student_id === s.id || (r.nim && r.nim === s.nim)));
        const vals = jenis.map(j => sum(rs.filter(r => r.jenis === j), 'jumlah'));
        return [batchName(s.batch_id), s.nama, s.nim || '', ...vals, sum(rs, 'jumlah')];
      })] },
  ]);
}

/* ---------- Tab Transaksi ---------- */
const transaksi = crudView({
  id: 'incomes', collection: 'incomes', noun: 'pemasukan', title: 'Perolehan dari Mahasiswa', eyebrow: 'Keuangan',
  description: 'Pembayaran Daftar Ulang, DPP, dan UKT/SPP mahasiswa IBM per batch. Status “Belum Lunas” & “Dibatalkan” tidak dihitung sebagai perolehan.',
  sections, columns, exportColumns: exportCols, exportName: 'Perolehan_Mahasiswa_IBM', sort: { key: 'tanggal', dir: 'desc' },
  searchPlaceholder: 'Cari mahasiswa, NIM, no. bukti…',
  search: r => [studentOf(r), r.nim, r.jenis, r.no_bukti, r.catatan, batchName(r.batch_id)].join(' '),
  filters: [
    { key: 'batch_id', label: 'Batch', options: () => batchOptions() },
    { key: 'jenis', label: 'Jenis', options: () => uniq([...JENIS(), ...store.all('incomes').map(r => r.jenis)]) },
    { key: 'status', label: 'Status', options: STATUS },
    { key: 'tahun', label: 'Tahun', options: () => uniq(store.all('incomes').map(r => String(yearOf(r.tanggal)))).sort().reverse(), match: (r, v) => String(yearOf(r.tanggal)) === v },
  ],
  kpis: (rows) => {
    const v = valid(rows); const pending = rows.filter(r => r.status === 'Belum Lunas' || r.status === 'Cicilan');
    return [
      { label: 'Total diterima', value: fmtIDR(sum(v, 'jumlah')), sub: `${v.length} pembayaran`, icon: 'income', accent: true },
      ...JENIS().slice(0, 3).map(j => ({ label: j, value: fmtIDR(sum(v.filter(r => r.jenis === j), 'jumlah')), sub: `${uniq(v.filter(r => r.jenis === j).map(studentKey)).length} mahasiswa`, icon: 'wallet' })),
      pending.length ? { label: 'Belum lunas / cicilan', value: fmtIDR(sum(pending, 'jumlah')), sub: `${pending.length} catatan`, icon: 'alert' } : null,
    ];
  },
  footer: (rows) => ['Total', '', '', '', '', h('span', { class: 'num' }, fmtIDR(sum(valid(rows), 'jumlah'))), ''],
  aliases: { student_id: ['Nama', 'Nama Mahasiswa', 'Student Name', 'Mahasiswa'], batch_id: ['Angkatan'], jumlah: ['Nominal', 'Amount'], jenis: ['Jenis Pembayaran', 'Keterangan'] },
  importNote: 'Kolom yang dikenali: Tanggal, Batch, Nama/NIM mahasiswa, Jenis (Daftar Ulang / DPP / UKT/SPP), Semester, Jumlah, Status, Metode, No. Bukti. Mahasiswa dicocokkan otomatis dengan Biodata Mahasiswa lewat NIM atau nama.',
  emptyTitle: 'Belum ada pemasukan tercatat', emptyText: 'Catat pembayaran mahasiswa per batch, atau impor dari rekap Excel keuangan.',
});

/* ---------- Tab Rekapitulasi ---------- */
function rekap(root) {
  const p = pref.get('rekap_inc', { tahun: 'all' });
  const box = h('div');
  function render() {
    clear(box);
    const all = store.all('incomes');
    const rows = all.filter(r => p.tahun === 'all' || String(yearOf(r.tanggal)) === p.tahun);
    const jenis = JENIS(); const rc = recap(rows); const v = valid(rows);
    const label = p.tahun === 'all' ? 'Semua tahun' : `Tahun ${p.tahun}`;
    const yearSel = h('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Tahun' }, h('option', { value: 'all' }, 'Semua tahun'),
      uniq(all.map(r => String(yearOf(r.tanggal)))).sort().reverse().map(y => h('option', { value: y }, `Tahun ${y}`)));
    yearSel.value = p.tahun; yearSel.addEventListener('change', () => { p.tahun = yearSel.value; pref.set('rekap_inc', p); render(); });

    // maksimal 3 seri berwarna (palet tervalidasi); jenis lain digabung ke "Lainnya"
    const main = jenis.slice(0, 3);
    const series = main.map((j, i) => ({ name: j, cls: `bar-${i + 1}`, color: `var(--chart-${i + 1})`, values: rc.map(x => x.per[j].total) }));
    const extra = rc.map(x => x.total - sum(main, j => x.per[j].total));
    if (extra.some(Boolean)) series.push({ name: 'Lainnya', cls: 'bar-4', color: 'var(--muted)', values: extra });

    const tableCols = [
      { key: 'batch', label: 'Batch', main: true, value: x => x.batch.angkatan, render: x => h('div', {}, h('span', { class: 'primary' }, x.batch.nama), h('span', { class: 'secondary' }, `Angkatan ${x.batch.angkatan} · ${x.mhs} mahasiswa aktif`)) },
      ...jenis.map(j => ({ key: j, label: j, align: 'right', value: x => x.per[j].total, render: x => h('div', {}, h('span', { class: 'num' }, fmtIDR(x.per[j].total)), h('span', { class: 'secondary' }, `${x.per[j].payers} / ${x.mhs} mhs`)) })),
      { key: 'total', label: 'Total', align: 'right', value: x => x.total, render: x => h('b', { class: 'num' }, fmtIDR(x.total)) },
    ];
    box.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('span', { class: 'eyebrow' }, 'Keuangan · Rekapitulasi'), h('h1', {}, 'Rekap Perolehan per Batch'), h('p', {}, `${label}. Dihitung dari pembayaran berstatus Lunas dan Cicilan.`)),
        h('div', { class: 'actions no-print' }, yearSel,
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => window.print() }, icon('print'), 'Cetak / PDF'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => rekapExcel(rows, label) }, icon('sheet'), 'Ekspor rekap Excel'))),
      kpiRow([
        { label: 'Total perolehan', value: fmtIDR(sum(v, 'jumlah')), sub: `${v.length} pembayaran · ${label}`, icon: 'income', accent: true },
        ...main.map(j => ({ label: j, value: fmtIDR(sum(v.filter(r => r.jenis === j), 'jumlah')), sub: `${uniq(v.filter(r => r.jenis === j).map(studentKey)).length} mahasiswa membayar`, icon: 'wallet' })),
      ]),
      !v.length ? h('div', { class: 'card' }, h('div', { class: 'empty' }, icon('report'), h('h3', {}, 'Belum ada perolehan untuk periode ini'), h('p', {}, 'Tambahkan transaksi di tab Transaksi atau impor dari Excel keuangan.'))) :
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, 'Perolehan per batch & jenis'), h('p', {}, 'Arahkan kursor ke batang untuk melihat nilai lengkap'))),
            h('div', { class: 'card-body' }, groupedBars({ categories: rc.map(x => x.batch.nama), series, height: 300, width: 1000 }))),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, 'Tabel rekap'), h('p', {}, 'Angka kecil = jumlah mahasiswa yang sudah membayar / mahasiswa aktif'))),
            dataTable({ columns: tableCols, rows: rc, pageSize: Infinity, sort: { key: 'batch', dir: 'asc' },
              footer: () => ['Total', ...jenis.map(j => h('span', { class: 'num' }, fmtIDR(sum(rc, x => x.per[j].total)))), h('b', { class: 'num' }, fmtIDR(sum(rc, 'total')))] }).el)),
    );
  }
  render(); root.appendChild(box);
  return { destroy: store.subscribe(render) };
}

export default {
  mount(root) {
    let tab = pref.get('tab_inc', 'transaksi'); let inner = null; const body = h('div');
    const draw = () => {
      inner && inner.destroy && inner.destroy(); clear(root);
      root.appendChild(tabs([{ id: 'transaksi', label: 'Transaksi' }, { id: 'rekap', label: 'Rekapitulasi' }], tab, (t) => { tab = t; pref.set('tab_inc', t); draw(); }));
      clear(body); root.appendChild(body);
      inner = tab === 'rekap' ? rekap(body) : transaksi(body);
    };
    draw();
    return { destroy: () => inner && inner.destroy && inner.destroy() };
  },
};
