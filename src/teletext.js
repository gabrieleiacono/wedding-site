// Televideo-style teletext engine (design F7): a 40×25 character grid drawn on a canvas,
// pages as data, three-digit page entry, fastext colours, rotating subpages and a live clock.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { WEDDING, PROGRAMME, TRAVEL, STAY, DRESS, FAQ } from './content.js';
import { Tennis } from './tennis.js';

const COLS = 40, ROWS = 25, CW = 20, CH = 24;
const W = '#FFFFFF', Y = '#FFF24A', C = '#5CF2FF', G = '#38E05A', M = '#FF6AF2', R = '#FF5A44', B = '#1C2BFF';
const FAST = [['#E8261C', '#FFFFFF'], ['#1FCF3A', '#000000'], ['#FFE81A', '#000000'], ['#2BD9F2', '#000000']];

const L = (t, c = W, n = '') => ({ t, c, n });
const E = () => L('');
const TITLE = (t, right = '') => ({ t: ' ' + t, c: Y, bg: B, dh: true, right });
const dots = (label, n, width = 31) => label + ' ' + '.'.repeat(Math.max(2, width - label.length - 1)) + ' ';
const wrap = (text, width = 38) => {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    if ((line + ' ' + w).trim().length > width) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
};

export function buildPages(guests = [], sub = 0, missing = '') {
  const yes = guests.filter((g) => g.coming);
  const people = yes.reduce((s, g) => s + (g.count || 1), 0);
  const msgs = guests.filter((g) => g.message && g.message.trim());

  const guestPages = [];
  for (let i = 0; i < Math.max(1, Math.ceil(yes.length / 9)); i++) {
    const chunk = yes.slice(i * 9, i * 9 + 9);
    guestPages.push([
      L('Hanno già detto sì:', C),
      ...(chunk.length ? chunk.map((g) => L(dots(g.name.slice(0, 22), 0, 30) + 'in ' + (g.count || 1))) : [L('Ancora nessuno. Siate i primi!', W)]),
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
  const p600 = [...guestPages, ...msgPages];
  const s600 = sub % p600.length;
  const subLabel = p600.length > 1 ? `${s600 + 1}/${p600.length}` : '';

  return {
    '100': { title: 'INDICE', fast: ['101', '600', '200', '700'], logo: true, rows: [
      TITLE('INDICE'), E(),
      L(dots('Il programma', 101), W, '101'), L(dots('Come arrivare', 200), C, '200'),
      L(dots('Dove dormire', 210), W, '210'), L(dots('Meteo alla villa', 300), C, '300'),
      L(dots('Dress code', 400), W, '400'), L(dots('Rispondi', 500), C, '500'),
      L(dots('Libro degli ospiti', 600), W, '600'), L(dots('Domande frequenti', 700), C, '700'),
      E(), L('Digita il numero di pagina.', G), L('Una pagina è nascosta...', M),
    ] },
    '101': { title: 'PROGRAMMA', fast: ['100', '200', '400', '600'], rows: [
      TITLE('IL PROGRAMMA'), E(), L(WEDDING.dateLong.toUpperCase(), C),
      ...PROGRAMME.saturday.map(([h, t]) => L(h.padEnd(9) + t)), E(),
      L('DOMENICA', C), ...PROGRAMME.sunday.map(([h, t]) => L(h.padEnd(9) + t)),
    ] },
    '200': { title: 'ARRIVARE', fast: ['100', '210', '300', '700'], rows: [
      TITLE('COME ARRIVARE'), E(),
      ...TRAVEL.flatMap(([h, t]) => [L(h, C), ...wrap(t).map((l) => L(l))]),
    ] },
    '210': { title: 'DORMIRE', fast: ['100', '200', '101', '700'], rows: [
      TITLE('DOVE DORMIRE'), E(),
      ...STAY.hotels.map(([n, d]) => L(dots(n, 0, 32) + d)), E(),
      L('Codice sconto: ' + STAY.code, Y), L('Prenotate entro il ' + STAY.bookBy + '.'), E(),
      L('NAVETTA', C), ...wrap(STAY.shuttle).map((l) => L(l)),
    ] },
    '300': { title: 'METEO', fast: ['100', '101', '200', '400'], weather: true, rows: [
      TITLE('METEO ALLA VILLA'), E(), E(), E(), E(), E(), E(),
      L('OGGI         [--] gradi  [cielo]'), L('DOMANI       [--] gradi  [cielo]'), L('IL GIORNO    [--] gradi  [cielo]', Y),
      E(), L('Previsioni vere quando il sito', G), L('sarà online.', G),
    ] },
    '400': { title: 'DRESS CODE', fast: ['100', '101', '300', '700'], rows: [
      TITLE('DRESS CODE'), E(), ...wrap(DRESS.line).map((l) => L(l)), E(),
      ...DRESS.rows.map(([k, v]) => L(k.padEnd(9) + v, C)), E(), ...wrap('Consiglio: ' + DRESS.tip).map((l) => L(l, G)),
    ] },
    '500': { title: 'RISPONDI', fast: ['100', '600', '101', '700'], rows: [
      TITLE('RISPONDI'), E(),
      L('Si risponde con la macchina da'), L('scrivere sulla scrivania.'), E(),
      L('Giratevi verso la scrivania (A)', C), L('e cliccate sulla macchina.', C), E(),
      L('Entro il: ' + WEDDING.rsvpBy, Y), E(), L('Già risposto? Pagina 600.', G),
    ] },
    '600': { title: 'OSPITI', fast: ['100', '500', '101', '700'], rows: [
      TITLE('LIBRO DEGLI OSPITI', subLabel), ...p600[s600], E(),
      L(`SÌ: ${yes.length} risposte, ${people} persone`, Y),
      L('Si aggiorna da sola a ogni risposta.', G),
    ] },
    '700': { title: 'FAQ', fast: ['100', '500', '200', '210'], rows: [
      TITLE('DOMANDE FREQUENTI'),
      ...FAQ.flatMap(([q, a]) => [L(q, C), ...wrap(a).map((l) => L(l))]), E(),
      L('Altre domande? ' + WEDDING.contact, G),
    ] },
    '888': { title: 'SOTTOTITOLI', fast: ['100', '101', '600', '700'], rows: [
      TITLE('SOTTOTITOLI'), E(),
      L('Il giorno del matrimonio qui'), L('scorreranno le promesse,'), L('sottotitolate in diretta (o quasi).'), E(),
      L('Bravi: l\'avete trovata.', M),
    ] },
    'none': { title: 'NON TROVATA', fast: ['100', '101', '200', '700'], rows: [
      TITLE('PAGINA NON DISPONIBILE'), E(),
      L('La pagina ' + (missing || '---') + ' non esiste.'), E(), L('Provate con l\'indice: ', Y, '100'),
    ] },
  };
}

export class Teletext {
  constructor(store) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = COLS * CW; this.canvas.height = ROWS * CH;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.page = '100'; this.buf = ''; this.missing = ''; this.av = false;
    this.guests = [];
    this.store = store;
    store?.onGuests((g) => { this.guests = g; this.dirty = true; });
    this.tennis = new Tennis(this.ctx, this.canvas.width, this.canvas.height);
    this.onChange = () => {};
    this.lastDraw = 0; this.dirty = true;
  }
  pages() { return buildPages(this.guests, Math.floor(performance.now() / 8000), this.missing); }
  go(p) { this.av = false; this.page = p; this.buf = ''; this.missing = ''; this.dirty = true; this.onChange(); }
  digit(d) {
    if (this.av) { this.av = false; }
    this.buf += d;
    if (this.buf.length === 3) {
      const all = this.pages();
      if (all[this.buf]) this.go(this.buf);
      else { this.missing = this.buf; this.page = 'none'; this.buf = ''; this.onChange(); }
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
    let row = 2;
    for (const r of cur.rows) {
      if (row > 21) break;
      if (r.bg) { ctx.fillStyle = r.bg; ctx.fillRect(0, row * CH, this.canvas.width, CH * (r.dh ? 2 : 1)); }
      this.text(0, row, r.t, r.c, r.dh);
      if (r.right) this.text(COLS - r.right.length - 1, row, r.right, W, r.dh);
      if (r.n) this.text(r.t.length, row, r.n, Y);
      row += r.dh ? 2 : 1;
    }
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
