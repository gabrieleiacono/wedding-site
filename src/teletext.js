// Televideo-style teletext engine (design F7): a 40×25 character grid drawn on a canvas,
// pages as data, three-digit page entry, fastext colours, rotating subpages and a live clock.
// The canvas is drawn at twice its 800×600 layout so the text stays sharp on a retina screen.
// SIZE (the remote's key, on a phone) redraws the body of each page in BIG_COLS bigger columns.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { WEDDING, PROGRAMME, TRAVEL, WEATHER, DRESS, RSVP, GUESTBOOK, FAQ } from './content.js';
import { Tennis } from './tennis.js';

const COLS = 40, ROWS = 25, CW = 20, CH = 24, RES = 2;
// Text is IBM Plex Mono at medium weight (bold clogs up once it is stretched to the cell), one column in from
// the left edge, as a real set's overscan would have it. FS is the font size of a normal row.
const FONT = (px) => `500 ${px}px "IBM Plex Mono", monospace`, FS = 22, ADV = 0.6; // Plex Mono advances 0.6 em
const MARGIN = 1;
// SIZE: the body in 28 columns, rows 1.43 times taller, between the title bar (ends at row 4) and the fastext bar (row 23)
const BIG_COLS = 28, BIG_CW = (COLS * CW) / BIG_COLS, BIG_CH = 34, BIG_ROWS = Math.floor((23 * CH - 4 * CH) / BIG_CH);
const LAYOUT = {
  normal: { width: COLS - 2 * MARGIN, body: 18, cw: CW, ch: CH, rows: 19 },
  big: { width: BIG_COLS - 2 * MARGIN, body: BIG_ROWS - 1, cw: BIG_CW, ch: BIG_CH, rows: BIG_ROWS },
};
const W = '#FFFFFF', Y = '#FFF24A', C = '#5CF2FF', G = '#38E05A', M = '#FF6AF2', R = '#FF5A44', B = '#1C2BFF';
const FAST = [['#E8261C', '#FFFFFF'], ['#1FCF3A', '#000000'], ['#FFE81A', '#000000'], ['#2BD9F2', '#000000']];

const L = (t, c = W, n = '') => ({ t, c, n });
const E = () => L('');
const dots = (label, n, width = 31) => label + ' ' + '.'.repeat(Math.max(2, width - label.length - 1)) + ' ';
const wrap = (text, width = 38) => {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    if ((line + ' ' + w).trim().length > width) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
};

// The screen has rows 2..22 for a page; the double-height title takes two, the body gets the rest. A page with
// subpages ends with a yellow CONTINUA bar right under its last line. A body longer than `body` rows is split
// into subpages, between blocks if it can. All of it is laid out for a width: 38 columns, or 26 with SIZE on.
function paginate(blocks, BODY) {
  const subs = []; let cur = [];
  const push = () => { if (cur.length) subs.push(cur); cur = []; };
  for (const b of blocks) {
    const need = (cur.length ? 1 : 0) + b.length;
    if (cur.length && cur.length + need > BODY) push();
    if (b.length > BODY) { for (let i = 0; i < b.length; i += BODY) { push(); cur = b.slice(i, i + BODY); } continue; }
    if (cur.length) cur.push(E());
    cur.push(...b);
  }
  push();
  return subs.length ? subs : [[]];
}

export function buildPages(guests = [], missing = '', layout = LAYOUT.normal) {
  const WD = layout.width;
  const para = (text, c = W, width = WD) => wrap(text, width).map((l) => L(l, c));
  const paras = (list, c = W) => list.map((t) => para(t, c));
  const lines = (list, c = W) => list.flatMap((t) => para(t, c));
  const page = (title, heading, fast, blocks, extra = {}) => ({ title, heading, fast, subs: paginate(blocks, layout.body), ...extra });
  const yes = guests.filter((g) => g.coming);
  const msgs = guests.filter((g) => g.message && g.message.trim());

  const guestPages = [];
  const per = Math.min(12, layout.body - 6);
  for (let i = 0; i < Math.max(1, Math.ceil(yes.length / per)); i++) {
    const chunk = yes.slice(i * per, i * per + per);
    guestPages.push([
      L('Hanno già detto sì:', C), E(),
      ...(chunk.length ? chunk.map((g) => L(g.name.slice(0, WD))) : lines(['Ancora nessuno. Siate i primi!'])),
    ]);
  }
  const msgPages = [];
  const perMsg = layout === LAYOUT.big ? 2 : 3;
  for (let i = 0; i < Math.ceil(msgs.length / perMsg); i++) {
    const rows = [L('I vostri messaggi:', C)];
    for (const g of msgs.slice(i * perMsg, i * perMsg + perMsg)) {
      for (const l of wrap('«' + g.message.trim() + '»', WD).slice(0, 3)) rows.push(L(l));
      rows.push(L(('— ' + g.name).slice(0, WD).padStart(WD), M));
    }
    msgPages.push(rows);
  }
  const g600 = [...guestPages, ...msgPages].map((r) => [...r, E(), L(`SÌ: ${yes.length} ${yes.length === 1 ? 'persona' : 'persone'}`, Y), ...lines(['Si aggiorna da sola a ogni risposta.'], G)]);

  const up = (t) => t.toUpperCase();
  return {
    '100': { title: 'INDICE', heading: 'INDICE', fast: ['101', '600', '200', '700'], logo: true, subs: [[
      E(),
      ...[[PROGRAMME.title, '101'], [TRAVEL.title, '200'], [WEATHER.title, '300'], [DRESS.title, '400'],
        [RSVP.title, '500'], [GUESTBOOK.title, '600'], ['Domande frequenti', '700']]
        .map(([t, n], i) => L(dots(t, n, Math.min(31, WD - 4)), i % 2 ? C : W, n)),
      E(), ...lines(['Digita il numero di pagina.'], G), ...lines(['Una pagina è nascosta...'], M),
    ]] },
    '101': page('PROGRAMMA', up(PROGRAMME.title), ['100', '200', '400', '600'], [
      [L(up(PROGRAMME.day), C), ...PROGRAMME.rows.flatMap(([h, t]) => wrap(t, WD - 7).map((l, i) => L((i ? '' : h).padEnd(7) + l)))],
      ...paras(PROGRAMME.text),
    ]),
    '200': page('ARRIVARE', up(TRAVEL.title), ['100', '101', '300', '700'], paras(TRAVEL.text)),
    '300': page('METEO', up(WEATHER.title), ['100', '101', '200', '400'], [[E(), E(), E()], ...paras(WEATHER.text)], { weather: true }),
    '400': page('DRESS CODE', up(DRESS.title), ['100', '101', '300', '700'], paras(DRESS.text)),
    '500': page('RISPONDI', up(RSVP.title), ['100', '600', '101', '700'], paras(RSVP.text)),
    '600': { title: 'OSPITI', heading: up(GUESTBOOK.title), fast: ['100', '500', '101', '700'], auto: true, subs: g600 },
    '700': page('FAQ', 'FAQ', ['100', '500', '200', '400'], FAQ.map(([q, a]) => [...para(q, C), ...a.flatMap((t) => para(t))])),
    '888': page('SOTTOTITOLI', 'SOTTOTITOLI', ['100', '101', '600', '700'], [[
      ...lines(['Il giorno del matrimonio qui', 'scorreranno le promesse,', 'sottotitolate in diretta (o quasi).']), E(),
      ...lines(['Bravi: l\'avete trovata.'], M),
    ]]),
    'none': page('NON TROVATA', 'PAGINA NON DISPONIBILE', ['100', '101', '200', '700'], [[
      ...lines(['La pagina ' + (missing || '---') + ' non esiste.']), E(), L('Provate con l\'indice: ', Y, '100'),
    ]]),
  };
}

export class Teletext {
  constructor(store) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = COLS * CW * RES; this.canvas.height = ROWS * CH * RES;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.page = '100'; this.buf = ''; this.missing = ''; this.av = false; this.sub = 0;
    this.big = false; // SIZE: the body in bigger letters
    this.touch = false; // a touch screen: the hints talk about tapping, not about the arrow keys
    this.guests = [];
    this.store = store;
    store?.onGuests((g) => { this.guests = g; this.dirty = true; });
    this.tennis = new Tennis(this.ctx, COLS * CW, ROWS * CH); // it draws in the 800×600 layout, like the pages
    this.onChange = () => {};
    this.lastDraw = 0; this.dirty = true;
  }
  pages() { return buildPages(this.guests, this.missing, this.big ? LAYOUT.big : LAYOUT.normal); }
  /** SIZE on or off: the page is laid out again, and you stay about as far into it as you were. */
  setBig(on) {
    if (on === this.big) return;
    const all = this.pages(), cur = all[this.page] || all['100'], n0 = cur.subs.length, at = this.subIndex(cur);
    this.big = on;
    const nw = this.pages(), n1 = (nw[this.page] || nw['100']).subs.length;
    this.sub = cur.auto ? 0 : Math.min(n1 - 1, Math.floor(at * n1 / n0));
    this.dirty = true; this.onChange();
  }
  /** Which subpage is on screen, of how many: the remote lights its ▶ while there is more to read. */
  subPos() { if (this.av) return { i: 0, n: 1, auto: false }; const all = this.pages(), p = all[this.page] || all['100']; return { i: this.subIndex(p), n: p.subs.length, auto: !!p.auto }; }
  /** Which subpage of a page is on screen: pages that rotate by themselves (the guestbook) move every 8 s, the arrows move any page. */
  subIndex(p) {
    const n = p.subs.length, tick = p.auto ? Math.floor(performance.now() / 8000) : 0;
    return (((tick + this.sub) % n) + n) % n;
  }
  subCount() { if (this.av) return 1; const all = this.pages(); return (all[this.page] || all['100']).subs.length; }
  step(d) { if (this.av) return; this.sub += d; this.dirty = true; this.onChange(); }
  go(p) { this.av = false; this.page = p; this.buf = ''; this.missing = ''; this.sub = 0; this.dirty = true; this.onChange(); }
  digit(d) {
    if (this.av) { this.av = false; }
    this.buf += d;
    if (this.buf.length === 3) {
      const all = this.pages();
      if (all[this.buf]) this.go(this.buf);
      else { this.missing = this.buf; this.page = 'none'; this.buf = ''; this.sub = 0; this.onChange(); }
    }
    this.dirty = true;
  }
  fast(i) { const cur = this.pages()[this.page] || this.pages()['100']; this.go(cur.fast[i]); }
  setAV(on) { this.av = on; if (on) this.tennis.reset(); this.dirty = true; this.onChange(); }
  fastLabels() {
    const all = this.pages(); const cur = all[this.page] || all['100'];
    return cur.fast.map((p) => ({ page: p, label: all[p]?.title ?? p }));
  }

  draw(now) {
    const ctx = this.ctx;
    ctx.setTransform(RES, 0, 0, RES, 0, 0); // everything below is in the 800×600 layout
    if (this.av) { this.tennis.step(now); this.drawScan(); this.texture.needsUpdate = true; return; }
    if (!this.dirty && now - this.lastDraw < 500) return;
    this.lastDraw = now; this.dirty = false;
    const all = this.pages(), cur = all[this.page] || all['100'];
    const lay = this.big ? LAYOUT.big : LAYOUT.normal;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, COLS * CW, ROWS * CH);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const num = this.buf ? (this.buf + '___').slice(0, 3) : (this.page === 'none' ? this.missing : this.page);
    this.text(MARGIN, 0, `P${num} MATRIMONIO  SAB ${WEDDING.dateShort}`.padEnd(COLS - 2 * MARGIN - time.length) + time, W);
    const n = cur.subs.length, si = this.subIndex(cur), more = n > 1 && !cur.auto;
    // title bar, double height, with the subpage count (and a ▶ while there is more) on the right
    ctx.fillStyle = B; ctx.fillRect(0, 2 * CH, COLS * CW, 2 * CH);
    this.text(MARGIN + 1, 2, cur.heading, Y, { dh: true });
    if (n > 1) { const r = `${si + 1}/${n}` + (more && si < n - 1 ? ' ▶' : ''); this.text(COLS - MARGIN - r.length, 2, r, W, { dh: true }); }
    // the body, in its own grid: 40 columns, or the bigger SIZE one, starting under the title bar
    const y0 = 4 * CH, at = (row) => y0 + row * lay.ch;
    const cell = { cw: lay.cw, ch: lay.ch, y0 };
    let row = 0;
    for (const r of cur.subs[si]) {
      if (row >= lay.rows) break;
      this.text(MARGIN, row, r.t, r.c, cell);
      if (r.n) this.text(MARGIN + r.t.length, row, r.n, Y, cell);
      row++;
    }
    // a page that goes on: a yellow bar right under the last line says so (on the last subpage, a cyan one says
    // it is the end), and a green line under it says how to turn the page, if there is room
    if (more) {
      const last = si === n - 1, big = this.big;
      const bar = last ? (big ? ' FINE · ▶ da capo ' : ' FINE · ▶ per ricominciare ')
        : (big ? ` ▶ CONTINUA · ${si + 2} di ${n} ` : ` ▶ CONTINUA · pagina ${si + 2} di ${n} `);
      const br = Math.min(row + 1, lay.rows - 1);
      ctx.fillStyle = last ? C : Y; ctx.fillRect(MARGIN * lay.cw, at(br), bar.length * lay.cw, lay.ch);
      this.text(MARGIN, br, bar, '#000', cell);
      const how = this.touch ? (big ? 'Tocca lo schermo o ▶' : 'Tocca lo schermo o ▶ sul telecomando') : 'Tasto ▶ del telecomando o freccia →';
      if (br + 1 < lay.rows && !last) this.text(MARGIN, br + 1, how, G, cell);
    }
    if (cur.logo && !this.big) this.mosaicVilla(29, 15);
    if (cur.weather) this.mosaicSun(14, 4);
    // fastext bar: each label centred in its coloured key, squeezed a little if it would not fit
    const labels = cur.fast.map((p) => (all[p]?.title ?? p));
    const bw = (COLS * CW) / 4;
    labels.forEach((lab, i) => {
      ctx.fillStyle = FAST[i][0]; ctx.fillRect(i * bw + 4, 23 * CH, bw - 8, CH * 1.6);
      const t = lab.slice(0, 10), w = Math.min(t.length * CW, bw - 20);
      this.text(0, 0, t, FAST[i][1], { x: i * bw + (bw - w) / 2, y: 23.3 * CH, cw: w / t.length });
    });
    this.drawScan();
    this.texture.needsUpdate = true;
  }
  /** Text in the character grid: `col`, `row` of a grid with cells cw × ch whose first row is at y0 (by default
   * the 40×25 screen). dh draws it double height. x, y place it in pixels instead. */
  text(col, row, s, color, { dh = false, cw = CW, ch = CH, y0 = 0, x, y } = {}) {
    const ctx = this.ctx, fs = FS * ch / CH;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = FONT(fs);
    ctx.textBaseline = 'top';
    ctx.translate(x ?? col * cw, y ?? y0 + row * ch + 2 * ch / CH);
    ctx.scale(cw / (fs * ADV), dh ? 2 : 1);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  }
  // teletext mosaic: a little villa with cypresses, in block graphics
  mosaicVilla(col, row) {
    const art = [
      '....RR....',
      '...RRRR...',
      '..RRRRRR..',
      '.WWWWWWWW.',
      'GWYWWWYWWG',
      'GWWWYYWWWG',
      'GWYWYYWYWG',
      'GGGGGGGGGG',
    ];
    this.mosaic(art, col, row, { R, W, Y, G });
  }
  mosaicSun(col, row) {
    const art = [
      '...Y....Y...Y..',
      '.....YYYYY.....',
      '.Y..YYYYYYY..Y.',
      '...YYYYYYYYY...',
      '....YYYYYYY....',
      '.Y...YYYYY...Y.',
      '...Y...Y...Y...',
    ];
    this.mosaic(art, col, row, { Y });
  }
  mosaic(art, col, row, pal) {
    const ctx = this.ctx, bw = CW / 2, bh = CH / 3;
    art.forEach((line, y) => [...line].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = pal[ch]; ctx.fillRect(col * CW + x * bw, row * CH + y * bh, bw - 1, bh - 1);
    }));
  }
  // scanlines: thin and light, one every 3 pixels of the double-resolution canvas
  drawScan() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < this.canvas.height; y += 3) ctx.fillRect(0, y, this.canvas.width, 1);
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
  }
}
