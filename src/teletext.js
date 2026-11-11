// Televideo-style teletext engine (design F7): a 40×25 character grid drawn on a canvas,
// pages as data, three-digit page entry, fastext colours, rotating subpages and a live clock.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { WEDDING, PROGRAMME, TRAVEL, WEATHER, DRESS, RSVP, GUESTBOOK, FAQ } from './content.js';
import { Tennis } from './tennis.js';

const COLS = 40, ROWS = 25, CW = 20, CH = 24;
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

// The screen has rows 2..21 for a page; the double-height title takes two, the body gets the rest.
// Row 22 carries the subpage hint. A body longer than BODY rows is split into subpages, between blocks if it can.
const BODY = 18;
const para = (text, c = W, width = 38) => wrap(text, width).map((l) => L(l, c));
const paras = (list, c = W) => list.map((t) => para(t, c));
function paginate(blocks) {
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
const page = (title, heading, fast, blocks, extra = {}) => ({ title, heading, fast, subs: paginate(blocks), ...extra });

export function buildPages(guests = [], missing = '') {
  const yes = guests.filter((g) => g.coming);
  const msgs = guests.filter((g) => g.message && g.message.trim());

  const guestPages = [];
  for (let i = 0; i < Math.max(1, Math.ceil(yes.length / 12)); i++) {
    const chunk = yes.slice(i * 12, i * 12 + 12);
    guestPages.push([
      L('Hanno già detto sì:', C), E(),
      ...(chunk.length ? chunk.map((g) => L(g.name.slice(0, 38))) : [L('Ancora nessuno. Siate i primi!', W)]),
    ]);
  }
  const msgPages = [];
  for (let i = 0; i < Math.ceil(msgs.length / 3); i++) {
    const rows = [L('I vostri messaggi:', C)];
    for (const g of msgs.slice(i * 3, i * 3 + 3)) {
      for (const l of wrap('«' + g.message.trim() + '»', 38).slice(0, 3)) rows.push(L(l));
      rows.push(L(('— ' + g.name).padStart(38), M));
    }
    msgPages.push(rows);
  }
  const g600 = [...guestPages, ...msgPages].map((r) => [...r, E(), L(`SÌ: ${yes.length} ${yes.length === 1 ? 'persona' : 'persone'}`, Y), L('Si aggiorna da sola a ogni risposta.', G)]);

  const up = (t) => t.toUpperCase();
  return {
    '100': { title: 'INDICE', heading: 'INDICE', fast: ['101', '600', '200', '700'], logo: true, subs: [[
      E(),
      L(dots(PROGRAMME.title, 101), W, '101'), L(dots(TRAVEL.title, 200), C, '200'),
      L(dots(WEATHER.title, 300), W, '300'), L(dots(DRESS.title, 400), C, '400'),
      L(dots(RSVP.title, 500), W, '500'), L(dots(GUESTBOOK.title, 600), C, '600'),
      L(dots('Domande frequenti', 700), W, '700'),
      E(), L('Digita il numero di pagina.', G), L('Una pagina è nascosta...', M),
    ]] },
    '101': page('PROGRAMMA', up(PROGRAMME.title), ['100', '200', '400', '600'], [
      [L(up(PROGRAMME.day), C), ...PROGRAMME.rows.flatMap(([h, t]) => wrap(t, 31).map((l, i) => L((i ? '' : h).padEnd(7) + l)))],
      ...paras(PROGRAMME.text),
    ]),
    '200': page('ARRIVARE', up(TRAVEL.title), ['100', '101', '300', '700'], paras(TRAVEL.text)),
    '300': page('METEO', up(WEATHER.title), ['100', '101', '200', '400'], [[E(), E(), E()], ...paras(WEATHER.text)], { weather: true }),
    '400': page('DRESS CODE', up(DRESS.title), ['100', '101', '300', '700'], paras(DRESS.text)),
    '500': page('RISPONDI', up(RSVP.title), ['100', '600', '101', '700'], paras(RSVP.text)),
    '600': { title: 'OSPITI', heading: up(GUESTBOOK.title), fast: ['100', '500', '101', '700'], auto: true, subs: g600 },
    '700': page('FAQ', 'FAQ', ['100', '500', '200', '400'], FAQ.map(([q, a]) => [...para(q, C), ...a.flatMap((t) => para(t))])),
    '888': page('SOTTOTITOLI', 'SOTTOTITOLI', ['100', '101', '600', '700'], [[
      L('Il giorno del matrimonio qui'), L('scorreranno le promesse,'), L('sottotitolate in diretta (o quasi).'), E(),
      L('Bravi: l\'avete trovata.', M),
    ]]),
    'none': page('NON TROVATA', 'PAGINA NON DISPONIBILE', ['100', '101', '200', '700'], [[
      L('La pagina ' + (missing || '---') + ' non esiste.'), E(), L('Provate con l\'indice: ', Y, '100'),
    ]]),
  };
}

export class Teletext {
  constructor(store) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = COLS * CW; this.canvas.height = ROWS * CH;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.page = '100'; this.buf = ''; this.missing = ''; this.av = false; this.sub = 0;
    this.guests = [];
    this.store = store;
    store?.onGuests((g) => { this.guests = g; this.dirty = true; });
    this.tennis = new Tennis(this.ctx, this.canvas.width, this.canvas.height);
    this.onChange = () => {};
    this.lastDraw = 0; this.dirty = true;
  }
  pages() { return buildPages(this.guests, this.missing); }
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
    if (this.av) { this.tennis.step(now); this.drawScan(); this.texture.needsUpdate = true; return; }
    if (!this.dirty && now - this.lastDraw < 500) return;
    this.lastDraw = now; this.dirty = false;
    const ctx = this.ctx, all = this.pages(), cur = all[this.page] || all['100'];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const num = this.buf ? (this.buf + '___').slice(0, 3) : (this.page === 'none' ? this.missing : this.page);
    this.text(0, 0, `P${num} MATRIMONIO  SAB ${WEDDING.dateShort}`.padEnd(32) + time, W);
    const n = cur.subs.length, si = this.subIndex(cur);
    const rows = [{ t: ' ' + cur.heading, c: Y, bg: B, dh: true, right: n > 1 ? `${si + 1}/${n}` : '' }, ...cur.subs[si]];
    let row = 2;
    for (const r of rows) {
      if (row > 21) break;
      if (r.bg) { ctx.fillStyle = r.bg; ctx.fillRect(0, row * CH, this.canvas.width, CH * (r.dh ? 2 : 1)); }
      this.text(0, row, r.t, r.c, r.dh);
      if (r.right) this.text(COLS - r.right.length - 1, row, r.right, W, r.dh);
      if (r.n) this.text(r.t.length, row, r.n, Y);
      row += r.dh ? 2 : 1;
    }
    if (n > 1 && !cur.auto) this.text(0, 22, si < n - 1 ? 'Continua: tasto ▶ o freccia destra' : 'Fine. Tasto ▶ per ricominciare', G);
    if (cur.logo) this.mosaicVilla(29, 15);
    if (cur.weather) this.mosaicSun(14, 4);
    // fastext bar
    const labels = cur.fast.map((p) => (all[p]?.title ?? p));
    const bw = this.canvas.width / 4;
    labels.forEach((lab, i) => {
      ctx.fillStyle = FAST[i][0]; ctx.fillRect(i * bw + 4, 23 * CH, bw - 8, CH * 1.6);
      this.text(i * 10 + Math.max(0, Math.floor((10 - lab.length) / 2)), 23.3, lab.slice(0, 10), FAST[i][1]);
    });
    this.drawScan();
    this.texture.needsUpdate = true;
  }
  text(col, row, s, color, dh = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '700 22px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.translate(col * CW, row * CH + 2);
    ctx.scale(CW / 13.2, dh ? 2 : 1);
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
  drawScan() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < this.canvas.height; y += 3) ctx.fillRect(0, y, this.canvas.width, 1);
  }
}
