/* =========================================================================
   10. IMMERSION — tabungan & pengeluaran program immersion mahasiswa IBM
   • Rekap & progres : target per batch, terkumpul, kurang Rp & %, per mahasiswa
   • Log setoran     : kapan, berapa, bukti transfer, verifikasi
   • Pengeluaran     : dana immersion yang dipakai (kolektif / atas nama mahasiswa)
   • Target          : goal tabungan per batch (bisa berbeda tiap batch)
   ========================================================================= */
import { h, icon, clear, fmtIDR, fmtDate, fmtDateLong, sum, uniq, pct, badge, docLink, batchName, batchOptions, batches, studentOf, today, parseDate, tabs, pref, toast, openModal } from '../ui.js';
import { crudView, kpiRow } from '../crud.js';
import { dataTable } from '../table.js';
import { hbars } from '../charts.js';
import { exportWorkbook } from '../io.js';
import { store } from '../store.js';

const STATUS_SETOR = ['Terverifikasi', 'Menunggu verifikasi', 'Ditolak'];
const METODE = () => store.list('metode_bayar');
const KATEGORI = () => store.list('kategori_immersion');
const verified = (rows) => rows.filter(r => (r.status || 'Terverifikasi') === 'Terverifikasi');
const aktif = (s) => !/non-aktif|mengundurkan|drop|lulus/i.test(s.status_mhs || '');
const own = (r, s) => r.student_id === s.id || (!!r.nim && !!s.nim && String(r.nim) === String(s.nim)) || (!r.student_id && !!r.nama_mahasiswa && r.nama_mahasiswa.toLowerCase().trim() === s.nama.toLowerCase().trim());
const toneSetor = (s) => ({ Terverifikasi: 'ok', 'Menunggu verifikasi': 'warn', Ditolak: 'bad' }[s] || '');

/** Target aktif sebuah batch */
export function targetOf(batchId) {
  const ts = store.all('immersionTargets').filter(t => t.batch_id === batchId);
  return ts.find(t => (t.status || 'Aktif') === 'Aktif') || ts.sort((a, b) => String(b.tenggat).localeCompare(String(a.tenggat)))[0] || null;
}
/** Progres tabungan semua mahasiswa satu batch */
export function batchProgress(batchId) {
  const t = targetOf(batchId); const goal = Number(t && t.target_per_mahasiswa) || 0;
  const sav = store.all('immersionSavings').filter(r => r.batch_id === batchId);
  const studs = store.all('students').filter(s => s.batch_id === batchId && aktif(s)).sort((a, b) => a.nama.localeCompare(b.nama));
  const rows = studs.map(s => {
    const mine = sav.filter(r => own(r, s)); const ok = verified(mine);
    const terkumpul = sum(ok, 'jumlah'); const kurang = Math.max(0, goal - terkumpul);
    const last = mine.map(r => r.tanggal).filter(Boolean).sort().pop() || '';
    return { s, mine, n: ok.length, pending: mine.filter(r => r.status === 'Menunggu verifikasi'), terkumpul, kurang, persen: goal ? Math.min(100, Math.round(terkumpul / goal * 100)) : null, last };
  });
  const exp = store.all('immersionExpenses').filter(r => r.batch_id === batchId);
  const total = sum(rows, 'terkumpul');
  return { target: t, goal, rows, total, targetTotal: goal * rows.length, kurang: sum(rows, 'kurang'), terpakai: sum(exp, 'jumlah'), pending: sav.filter(r => r.status === 'Menunggu verifikasi'), exp };
}
const statusMhs = (x, goal) => !goal ? 'Target belum diatur' : x.terkumpul >= goal ? 'Tercapai' : x.terkumpul > 0 ? 'Belum tercapai' : 'Belum menabung';
const progressCell = (p) => p === null ? h('span', { class: 'muted' }, '–') : h('div', { class: 'progress-cell' }, h('small', {}, `${p}%`), h('div', { class: `meter ${p >= 100 ? 'ok' : p >= 50 ? '' : 'warn'}` }, h('i', { style: { width: `${p}%` } })));

/* =================== Rekap & progres =================== */
function rekap(root, go) {
  let bid = pref.get('imm_batch', ''); const box = h('div');
  if (!store.get('batches', bid)) bid = (batches().find(b => targetOf(b.id)) || batches()[0] || {}).id || '';
  function studentLog(x, P) {
    const list = [...x.mine].sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
    const body = h('div', { class: 'stack' },
      kpiRow([
        { label: 'Terkumpul', value: fmtIDR(x.terkumpul), sub: `${x.n} setoran terverifikasi`, icon: 'piggy', accent: true },
        { label: 'Kurang', value: fmtIDR(x.kurang), sub: P.goal ? `dari target ${fmtIDR(P.goal)}` : 'target belum diatur', icon: 'alert', meter: x.persen ?? 0, meterTone: 'ok' },
      ]),
      list.length ? dataTable({ rows: list, pageSize: Infinity, compact: true, columns: [
        { key: 'tanggal', label: 'Tanggal', main: true, render: r => h('b', {}, fmtDate(r.tanggal)) },
        { key: 'jumlah', label: 'Jumlah', align: 'right', render: r => h('span', { class: 'num' }, fmtIDR(r.jumlah)) },
        { key: 'metode', label: 'Metode' },
        { key: 'status', label: 'Status', render: r => badge(r.status || 'Terverifikasi', toneSetor(r.status || 'Terverifikasi')) },
        { key: 'bukti', label: 'Bukti TF', sortable: false, render: r => docLink(r.bukti, '–') },
      ] }).el : h('div', { class: 'empty' }, icon('piggy'), h('h3', {}, 'Belum ada setoran'), h('p', {}, 'Catat setoran pertama mahasiswa ini.')));
    const add = h('button', { class: 'btn btn-primary', type: 'button' }, icon('plus'), 'Catat setoran');
    const { close } = openModal({ title: x.s.nama, subtitle: `${batchName(x.s.batch_id)}${x.s.nim ? ' · ' + x.s.nim : ''} · Tabungan immersion`, body, size: 'lg', footer: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => close() }, 'Tutup'), add] });
    add.addEventListener('click', () => { close(); go('setoran', { batch_id: x.s.batch_id, student_id: x.s.id }); });
  }
  function render() {
    pref.set('imm_batch', bid); clear(box);
    const P = bid ? batchProgress(bid) : null; const t = P && P.target;
    const sel = h('select', { class: 'select', 'aria-label': 'Batch' }, batchOptions().map(o => h('option', { value: o.value }, o.label)));
    sel.value = bid; sel.addEventListener('change', () => { bid = sel.value; render(); });
    const all = batches().map(b => ({ b, P: batchProgress(b.id) })).filter(x => x.P.target || x.P.total);
    const sisaHari = t && t.tenggat ? Math.ceil((parseDate(t.tenggat) - parseDate(today())) / 864e5) : null;
    const xls = () => exportWorkbook(`Rekap_Tabungan_Immersion_${batchName(bid)}`.replace(/\W+/g, '_'), [
      { name: 'Per Mahasiswa', numFmt: { 3: 'money', 4: 'money', 5: 'money' }, rows: [['No', 'Nama Mahasiswa', 'NIM', 'Target (Rp)', 'Terkumpul (Rp)', 'Kurang (Rp)', 'Progres (%)', 'Jumlah Setoran', 'Setoran Terakhir', 'Status'],
        ...P.rows.map((x, i) => [i + 1, x.s.nama, x.s.nim || '', P.goal, x.terkumpul, x.kurang, x.persen ?? '', x.n, x.last, statusMhs(x, P.goal)])] },
      { name: 'Log Setoran', numFmt: { 3: 'money' }, rows: [['Tanggal', 'Mahasiswa', 'NIM', 'Jumlah (Rp)', 'Metode', 'Status', 'Bukti', 'Catatan'],
        ...store.all('immersionSavings').filter(r => r.batch_id === bid).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).map(r => [r.tanggal, studentOf(r), r.nim || '', Number(r.jumlah) || 0, r.metode || '', r.status || '', r.bukti ? (r.bukti.link || (r.bukti.file && r.bukti.file.name) || '') : '', r.catatan || ''])] },
      { name: 'Pengeluaran', numFmt: { 3: 'money' }, rows: [['Tanggal', 'Kategori', 'Uraian', 'Jumlah (Rp)', 'Atas nama', 'Catatan'], ...P.exp.map(r => [r.tanggal, r.kategori, r.uraian, Number(r.jumlah) || 0, r.student_id || r.nama_mahasiswa ? studentOf(r) : 'Kolektif', r.catatan || ''])] },
    ]);

    box.append(...[
      h('div', { class: 'page-head' },
        h('div', {}, h('span', { class: 'eyebrow' }, 'Program · Immersion'), h('h1', {}, 'Tabungan Immersion'),
          h('p', {}, t ? `${t.program || 'Program immersion'}${t.destinasi ? ' · ' + t.destinasi : ''} · target ${fmtIDR(P.goal)} per mahasiswa${t.tenggat ? ` · tenggat ${fmtDateLong(t.tenggat)}${sisaHari !== null ? (sisaHari >= 0 ? ` (${sisaHari} hari lagi)` : ' (lewat tenggat)') : ''}` : ''}.` : 'Target tabungan batch ini belum diatur — tambahkan di tab Target per batch.')),
        h('div', { class: 'actions no-print' }, sel,
          bid ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: xls }, icon('sheet'), 'Ekspor rekap') : null,
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => go('setoran', { batch_id: bid }) }, icon('plus'), 'Catat setoran'))),
      !t && bid ? h('div', { class: 'note warn' }, icon('alert'), h('div', {}, 'Batch ini belum memiliki target tabungan. ', h('button', { class: 'doc-link', type: 'button', onclick: () => go('target', { batch_id: bid }) }, 'Atur target sekarang'))) : null,
      P ? kpiRow([
        { label: 'Terkumpul (terverifikasi)', value: fmtIDR(P.total), sub: P.targetTotal ? `dari target ${fmtIDR(P.targetTotal)}` : `${P.rows.length} mahasiswa`, meter: P.targetTotal ? pct(P.total, P.targetTotal) : undefined, meterTone: 'ok', icon: 'piggy', accent: true },
        { label: 'Kekurangan total', value: fmtIDR(P.kurang), sub: P.targetTotal ? `${100 - Math.min(100, pct(P.total, P.targetTotal))}% lagi` : '–', icon: 'alert' },
        { label: 'Target tercapai', value: `${P.rows.filter(x => P.goal && x.terkumpul >= P.goal).length} / ${P.rows.length}`, sub: 'mahasiswa', icon: 'check' },
        { label: 'Saldo dana', value: fmtIDR(P.total - P.terpakai), sub: `terpakai ${fmtIDR(P.terpakai)}`, icon: 'wallet' },
        P.pending.length ? { label: 'Menunggu verifikasi', value: P.pending.length, sub: fmtIDR(sum(P.pending, 'jumlah')), icon: 'clock' } : null,
      ]) : null,
      P ? h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, `Progres per mahasiswa · ${batchName(bid)}`), h('p', {}, 'Klik nama untuk melihat riwayat setoran. Hanya setoran terverifikasi yang dihitung.'))),
        dataTable({ rows: P.rows, pageSize: Infinity, sort: { key: 'persen', dir: 'asc' }, onRowClick: x => studentLog(x, P),
          emptyNode: h('div', { class: 'empty' }, icon('users'), h('h3', {}, 'Belum ada mahasiswa aktif di batch ini')),
          columns: [
            { key: 'nama', label: 'Mahasiswa', main: true, value: x => x.s.nama, render: x => h('div', {}, h('span', { class: 'primary' }, x.s.nama), h('span', { class: 'secondary' }, [x.s.nim, x.last ? `setoran terakhir ${fmtDate(x.last)}` : 'belum ada setoran'].filter(Boolean).join(' · '))) },
            { key: 'n', label: 'Setoran', align: 'right', value: x => x.n, render: x => h('span', { class: 'num' }, `${x.n}×${x.pending.length ? ` (+${x.pending.length} menunggu)` : ''}`) },
            { key: 'terkumpul', label: 'Terkumpul', align: 'right', value: x => x.terkumpul, render: x => h('span', { class: 'num' }, fmtIDR(x.terkumpul)) },
            { key: 'kurang', label: 'Kurang', align: 'right', value: x => x.kurang, render: x => x.kurang ? h('b', { class: 'num', style: { color: 'var(--warn)' } }, fmtIDR(x.kurang)) : h('span', { class: 'num' }, P.goal ? 'Lunas' : '–') },
            { key: 'persen', label: 'Progres', value: x => x.persen ?? -1, render: x => progressCell(x.persen) },
            { key: 'status', label: 'Status', value: x => statusMhs(x, P.goal), render: x => badge(statusMhs(x, P.goal), { Tercapai: 'ok', 'Belum tercapai': 'warn', 'Belum menabung': 'bad' }[statusMhs(x, P.goal)] || '') },
          ],
          footer: (rows) => ['Total', h('span', { class: 'num' }, sum(rows, 'n')), h('span', { class: 'num' }, fmtIDR(sum(rows, 'terkumpul'))), h('span', { class: 'num' }, fmtIDR(sum(rows, 'kurang'))), P.targetTotal ? `${pct(P.total, P.targetTotal)}%` : '', ''],
        }).el) : null,
      all.length > 1 ? h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, 'Semua batch'), h('p', {}, 'Persentase terkumpul terhadap target total tiap batch'))),
        h('div', { class: 'card-body' }, hbars(all.map(x => ({ label: x.b.nama, value: x.P.targetTotal ? pct(x.P.total, x.P.targetTotal) : 0, display: `${fmtIDR(x.P.total)} / ${x.P.targetTotal ? fmtIDR(x.P.targetTotal) : 'target –'} · ${x.P.targetTotal ? pct(x.P.total, x.P.targetTotal) : 0}%` })), { max: 100 }))) : null,
    ].filter(Boolean));
  }
  render(); root.appendChild(box);
  return { destroy: store.subscribe(render) };
}

/* =================== Log setoran =================== */
const setoranCfg = {
  id: 'immersionSavings', collection: 'immersionSavings', noun: 'setoran', title: 'Log Setoran Tabungan', eyebrow: 'Program · Immersion',
  description: 'Setiap setoran tabungan immersion: tanggal, jumlah, dan bukti transfer. Setoran baru berstatus “Menunggu verifikasi” sampai dicek tim IBM; hanya yang terverifikasi masuk rekap.',
  sections: [
    { title: 'Setoran', fields: [
      { key: 'tanggal', label: 'Tanggal setor', type: 'date', required: true, col: 'half', default: () => today() },
      { key: 'batch_id', label: 'Batch', type: 'batch', required: true, col: 'half' },
      { key: 'student_id', label: 'Mahasiswa', type: 'student', batchKey: 'batch_id', required: true },
      { key: 'jumlah', label: 'Jumlah setoran', type: 'money', required: true, col: 'half' },
      { key: 'metode', label: 'Metode', type: 'select', options: METODE, col: 'half', default: 'Transfer Bank' },
      { key: 'status', label: 'Status verifikasi', type: 'select', options: STATUS_SETOR, col: 'half', default: 'Menunggu verifikasi' },
    ] },
    { title: 'Bukti transfer', fields: [
      { key: 'bukti', label: 'Bukti transfer', type: 'attachment', accept: 'image/*,.pdf', help: 'Unggah foto/PDF bukti transfer, atau tempel link Google Drive.' },
      { key: 'catatan', label: 'Catatan', type: 'textarea', rows: 2 },
    ] },
  ],
  columns: [
    { key: 'tanggal', label: 'Tanggal', render: r => fmtDate(r.tanggal), nowrap: true },
    { key: 'mhs', label: 'Mahasiswa', main: true, value: r => studentOf(r), render: r => h('div', {}, h('span', { class: 'primary' }, studentOf(r)), h('span', { class: 'secondary' }, [batchName(r.batch_id), r.nim].filter(Boolean).join(' · '))) },
    { key: 'jumlah', label: 'Jumlah', align: 'right', money: true, value: r => Number(r.jumlah) || 0, render: r => h('span', { class: 'num' }, fmtIDR(r.jumlah)), nowrap: true },
    { key: 'metode', label: 'Metode' },
    { key: 'status', label: 'Status', render: r => badge(r.status || 'Terverifikasi', toneSetor(r.status || 'Terverifikasi')) },
    { key: 'bukti', label: 'Bukti TF', sortable: false, render: r => docLink(r.bukti, 'Belum ada') },
  ],
  exportColumns: [
    { key: 'tanggal', label: 'Tanggal' }, { key: 'batch_id', label: 'Batch', value: r => batchName(r.batch_id) }, { key: 'mhs', label: 'Mahasiswa', value: r => studentOf(r) }, { key: 'nim', label: 'NIM' },
    { key: 'jumlah', label: 'Jumlah (Rp)', money: true, value: r => Number(r.jumlah) || 0 }, { key: 'metode', label: 'Metode' }, { key: 'status', label: 'Status' }, { key: 'bukti', label: 'Bukti' }, { key: 'catatan', label: 'Catatan' },
  ],
  exportName: 'Setoran_Immersion', sort: { key: 'tanggal', dir: 'desc' },
  searchPlaceholder: 'Cari mahasiswa, NIM, catatan…', search: r => [studentOf(r), r.nim, r.catatan, r.metode].join(' '),
  filters: [
    { key: 'batch_id', label: 'Batch', options: () => batchOptions() },
    { key: 'status', label: 'Status', options: STATUS_SETOR, match: (r, v) => (r.status || 'Terverifikasi') === v },
    { key: 'bulan', label: 'Bulan', options: () => uniq(store.all('immersionSavings').map(r => String(r.tanggal || '').slice(0, 7))).sort().reverse(), match: (r, v) => String(r.tanggal || '').startsWith(v) },
  ],
  defaults: () => ({ status: 'Menunggu verifikasi', metode: 'Transfer Bank', tanggal: today() }),
  rowExtra: (r) => r.status === 'Menunggu verifikasi' ? [h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Tandai terverifikasi', onclick: async () => { await store.save('immersionSavings', { ...r, status: 'Terverifikasi' }); toast('Setoran diverifikasi.', 'ok'); } }, icon('check', 'sm'), 'Verifikasi')] : [],
  kpis: (rows) => {
    const ok = verified(rows); const ym = today().slice(0, 7); const pend = rows.filter(r => r.status === 'Menunggu verifikasi');
    return [
      { label: 'Total terverifikasi', value: fmtIDR(sum(ok, 'jumlah')), sub: `${ok.length} setoran`, icon: 'piggy', accent: true },
      { label: 'Menunggu verifikasi', value: pend.length, sub: fmtIDR(sum(pend, 'jumlah')), icon: 'clock' },
      { label: 'Setoran bulan ini', value: fmtIDR(sum(ok.filter(r => String(r.tanggal || '').startsWith(ym)), 'jumlah')), icon: 'calendar' },
      { label: 'Tanpa bukti TF', value: rows.filter(r => !r.bukti || !(r.bukti.link || r.bukti.file)).length, sub: 'perlu dilengkapi', icon: 'alert' },
    ];
  },
  footer: (rows) => ['Total', '', h('span', { class: 'num' }, fmtIDR(sum(verified(rows), 'jumlah'))), '', '', ''],
  aliases: { student_id: ['Nama', 'Nama Mahasiswa', 'Mahasiswa'], jumlah: ['Nominal', 'Setoran'], tanggal: ['Tanggal Setor', 'Tanggal Transfer'] },
  importNote: 'Kolom: Tanggal, Batch, Nama/NIM mahasiswa, Jumlah, Metode, Status, Bukti (link). Mahasiswa dicocokkan otomatis lewat NIM atau nama.',
  emptyTitle: 'Belum ada setoran', emptyText: 'Catat setoran tabungan immersion mahasiswa beserta bukti transfernya.',
};

/* =================== Pengeluaran immersion =================== */
const pengeluaranCfg = {
  id: 'immersionExpenses', collection: 'immersionExpenses', noun: 'pengeluaran', title: 'Pengeluaran Dana Immersion', eyebrow: 'Program · Immersion',
  description: 'Penggunaan dana tabungan immersion: tiket, akomodasi, visa, dan lainnya. Kosongkan mahasiswa untuk pengeluaran kolektif satu batch.',
  sections: [
    { title: 'Pengeluaran', fields: [
      { key: 'tanggal', label: 'Tanggal', type: 'date', required: true, col: 'half', default: () => today() },
      { key: 'batch_id', label: 'Batch', type: 'batch', required: true, col: 'half' },
      { key: 'kategori', label: 'Kategori', type: 'select', options: KATEGORI, required: true, col: 'half' },
      { key: 'jumlah', label: 'Jumlah', type: 'money', required: true, col: 'half' },
      { key: 'uraian', label: 'Uraian', type: 'text', required: true, placeholder: 'mis. Tiket pesawat Surabaya–Osaka (PP)' },
      { key: 'student_id', label: 'Atas nama mahasiswa (opsional)', type: 'student', batchKey: 'batch_id', placeholder: '— Kolektif (seluruh batch) —' },
    ] },
    { title: 'Bukti', fields: [
      { key: 'bukti', label: 'Bukti / invoice', type: 'attachment', accept: 'image/*,.pdf' },
      { key: 'catatan', label: 'Catatan', type: 'textarea', rows: 2 },
    ] },
  ],
  columns: [
    { key: 'tanggal', label: 'Tanggal', render: r => fmtDate(r.tanggal), nowrap: true },
    { key: 'uraian', label: 'Uraian', main: true, render: r => h('div', {}, h('span', { class: 'primary' }, r.uraian), h('span', { class: 'secondary' }, [r.kategori, batchName(r.batch_id)].filter(Boolean).join(' · '))) },
    { key: 'atas', label: 'Atas nama', value: r => r.student_id || r.nama_mahasiswa ? studentOf(r) : 'Kolektif' },
    { key: 'jumlah', label: 'Jumlah', align: 'right', money: true, value: r => Number(r.jumlah) || 0, render: r => h('span', { class: 'num' }, fmtIDR(r.jumlah)), nowrap: true },
    { key: 'bukti', label: 'Bukti', sortable: false, render: r => docLink(r.bukti, '–') },
  ],
  exportColumns: [
    { key: 'tanggal', label: 'Tanggal' }, { key: 'batch_id', label: 'Batch', value: r => batchName(r.batch_id) }, { key: 'kategori', label: 'Kategori' }, { key: 'uraian', label: 'Uraian' },
    { key: 'jumlah', label: 'Jumlah (Rp)', money: true, value: r => Number(r.jumlah) || 0 }, { key: 'atas', label: 'Atas Nama', value: r => r.student_id || r.nama_mahasiswa ? studentOf(r) : 'Kolektif' }, { key: 'bukti', label: 'Bukti' }, { key: 'catatan', label: 'Catatan' },
  ],
  exportName: 'Pengeluaran_Immersion', sort: { key: 'tanggal', dir: 'desc' },
  search: r => [r.uraian, r.kategori, studentOf(r), r.catatan].join(' '),
  filters: [
    { key: 'batch_id', label: 'Batch', options: () => batchOptions() },
    { key: 'kategori', label: 'Kategori', options: () => uniq([...KATEGORI(), ...store.all('immersionExpenses').map(r => r.kategori)]) },
  ],
  kpis: (rows) => {
    const by = Object.entries(rows.reduce((m, r) => { m[r.kategori || 'Lainnya'] = (m[r.kategori || 'Lainnya'] || 0) + (Number(r.jumlah) || 0); return m; }, {})).sort((a, b) => b[1] - a[1]);
    return [
      { label: 'Total pengeluaran', value: fmtIDR(sum(rows, 'jumlah')), sub: `${rows.length} transaksi`, icon: 'expense', accent: true },
      { label: 'Kategori terbesar', small: true, value: by[0] ? by[0][0] : '–', sub: by[0] ? fmtIDR(by[0][1]) : '', icon: 'report' },
      { label: 'Kolektif', value: fmtIDR(sum(rows.filter(r => !r.student_id && !r.nama_mahasiswa), 'jumlah')), icon: 'users' },
      { label: 'Atas nama mahasiswa', value: fmtIDR(sum(rows.filter(r => r.student_id || r.nama_mahasiswa), 'jumlah')), icon: 'teacher' },
    ];
  },
  footer: (rows) => ['Total', '', '', h('span', { class: 'num' }, fmtIDR(sum(rows, 'jumlah'))), ''],
  aliases: { student_id: ['Nama Mahasiswa', 'Atas Nama'], jumlah: ['Nominal'] },
  emptyTitle: 'Belum ada pengeluaran immersion',
};

/* =================== Target per batch =================== */
const targetCfg = {
  id: 'immersionTargets', collection: 'immersionTargets', noun: 'target', title: 'Target Tabungan per Batch', eyebrow: 'Program · Immersion',
  description: 'Goal tabungan immersion tiap batch (boleh berbeda). Rekap memakai target berstatus “Aktif” untuk menghitung kekurangan tiap mahasiswa.',
  sections: [{ fields: [
    { key: 'batch_id', label: 'Batch', type: 'batch', required: true, col: 'half' },
    { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Selesai'], col: 'half', default: 'Aktif' },
    { key: 'program', label: 'Nama program', type: 'text', required: true, placeholder: 'mis. Immersion Osaka 2027' },
    { key: 'destinasi', label: 'Destinasi', type: 'text', col: 'half', placeholder: 'mis. Osaka, Jepang' },
    { key: 'tenggat', label: 'Tenggat tabungan', type: 'date', col: 'half' },
    { key: 'target_per_mahasiswa', label: 'Target per mahasiswa', type: 'money', required: true, col: 'half' },
    { key: 'catatan', label: 'Catatan', type: 'textarea', rows: 2 },
  ] }],
  columns: [
    { key: 'program', label: 'Program', main: true, render: r => h('div', {}, h('span', { class: 'primary' }, r.program), h('span', { class: 'secondary' }, [batchName(r.batch_id), r.destinasi].filter(Boolean).join(' · '))) },
    { key: 'target_per_mahasiswa', label: 'Target / mahasiswa', align: 'right', render: r => h('span', { class: 'num' }, fmtIDR(r.target_per_mahasiswa)) },
    { key: 'progres', label: 'Terkumpul', value: r => { const P = batchProgress(r.batch_id); return P.targetTotal ? pct(P.total, P.targetTotal) : 0; }, render: r => { const P = batchProgress(r.batch_id); return P.target && P.target.id === r.id ? progressCell(P.targetTotal ? pct(P.total, P.targetTotal) : 0) : h('span', { class: 'muted' }, 'tidak aktif'); } },
    { key: 'tenggat', label: 'Tenggat', render: r => r.tenggat ? fmtDate(r.tenggat) : null, nowrap: true },
    { key: 'status', label: 'Status', render: r => badge(r.status || 'Aktif') },
  ],
  exportName: 'Target_Immersion', sort: { key: 'tenggat', dir: 'asc' }, importable: true,
  defaults: () => ({ status: 'Aktif' }),
  emptyTitle: 'Belum ada target tabungan', emptyText: 'Atur goal tabungan immersion untuk tiap batch.',
};

export default {
  mount(root) {
    let tab = pref.get('tab_imm', 'rekap'); let inner = null; const body = h('div');
    const TABS = [{ id: 'rekap', label: 'Rekap & progres' }, { id: 'setoran', label: 'Log setoran' }, { id: 'pengeluaran', label: 'Pengeluaran' }, { id: 'target', label: 'Target per batch' }];
    const views = { setoran: crudView(setoranCfg), pengeluaran: crudView(pengeluaranCfg), target: crudView(targetCfg) };
    const go = (t, preset) => { tab = t; pref.set('tab_imm', t); draw(); if (preset && inner && inner.ctx) setTimeout(() => inner.ctx.openForm(preset), 30); };
    const draw = () => {
      inner && inner.destroy && inner.destroy(); clear(root);
      root.appendChild(tabs(TABS, tab, (t) => go(t)));
      clear(body); root.appendChild(body);
      inner = tab === 'rekap' ? rekap(body, go) : (views[tab] || views.setoran)(body);
    };
    draw();
    return { destroy: () => inner && inner.destroy && inner.destroy() };
  },
};
