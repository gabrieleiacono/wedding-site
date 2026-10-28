// Book spines drawn in canvas: one atlas holds every book on the shelf (spine, page block, cover
// colour), drawn in millimetres from the research data in books-data.js. Typography, publisher
// logos, series furniture and wear (reading creases, sun fade, rubbed edges) are all procedural.
import * as THREE from 'three';
import { makeInk } from './ink.js';

export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

// Webfonts standing in for the faces Italian publishers use on their spines.
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Jost:ital,wght@0,300..900;1,300..900&family=Oswald:wght@300..700&family=Inter:wght@300..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Archivo+Narrow:ital,wght@0,400..700;1,400..700&family=Libre+Franklin:ital,wght@0,300..900;1,300..900&display=swap';
export const FONTS = ['EB Garamond', 'Libre Baskerville', 'Bodoni Moda', 'Jost', 'Oswald', 'Inter', 'Playfair Display', 'Archivo Narrow', 'Libre Franklin'];
export function loadSpineFonts() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!document.querySelector('link[data-spine-fonts]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_CSS; l.dataset.spineFonts = '1'; document.head.appendChild(l);
  }
  const wait = new Promise((r) => setTimeout(r, 6000));
  const loads = [];
  for (const f of FONTS) for (const w of [400, 700]) { loads.push(document.fonts.load(`${w} 20px "${f}"`)); loads.push(document.fonts.load(`italic ${w} 20px "${f}"`)); }
  return Promise.race([Promise.allSettled(loads), wait]);
}

const GENERIC = { serif: 'EB Garamond', sans: 'Jost', condensed: 'Oswald', didone: 'Bodoni Moda', script: 'Caveat', mono: 'Courier Prime', baskerville: 'Libre Baskerville', grotesque: 'Libre Franklin', narrow: 'Archivo Narrow', display: 'Playfair Display', swiss: 'Inter' };
/** Map a free-text font description ("Simoncini Garamond", "Futura bold", "sans") to a loaded family. */
export function fontFamily(desc = '') {
  const d = String(desc).toLowerCase();
  if (GENERIC[d]) return GENERIC[d];
  if (/garamond|simoncini|bembo|sabon|janson|caslon|times|minion|plantin|old ?style|book/.test(d)) return 'EB Garamond';
  if (/baskerville|georgia|century|electra|scotch/.test(d)) return 'Libre Baskerville';
  if (/bodoni|didot|didone|walbaum/.test(d)) return 'Bodoni Moda';
  if (/playfair|display|modern serif/.test(d)) return 'Playfair Display';
  if (/futura|avenir|century gothic|geometric|kabel|erbar|twentieth/.test(d)) return 'Jost';
  if (/condensed|compressed|impact|bebas|knockout|league gothic|oswald|alternate gothic|trade gothic bold cond/.test(d)) return 'Oswald';
  if (/narrow|news gothic|trade gothic|franklin|grotesk|grotesque|akzidenz/.test(d)) return /narrow|cond/.test(d) ? 'Archivo Narrow' : 'Libre Franklin';
  if (/helvetica|arial|univers|frutiger|inter|swiss|neue haas|din|gill|optima|myriad/.test(d)) return 'Inter';
  if (/script|hand|brush|calligraph/.test(d)) return 'Caveat';
  if (/mono|courier|typewriter/.test(d)) return 'Courier Prime';
  if (/sans/.test(d)) return 'Inter';
  if (/serif|roman/.test(d)) return 'EB Garamond';
  return 'EB Garamond';
}

const hex = (c, f = '#888888') => (typeof c === 'string' && /^#?[0-9a-f]{3,8}$/i.test(c.trim()) ? (c.trim()[0] === '#' ? c.trim() : '#' + c.trim()) : (typeof c === 'string' && c ? c : f));
function lum(c) { const k = new THREE.Color(hex(c)); return 0.299 * k.r + 0.587 * k.g + 0.114 * k.b; }
function shade(c, t) { const k = new THREE.Color(hex(c)); const o = t < 0 ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 0.97, 0.9); k.lerp(o, Math.abs(t)); return '#' + k.getHexString(); }
const bgOf = (s) => (s && typeof s.bg === 'object' && s.bg ? hex(s.bg.top ?? s.bg.bottom ?? s.bg.from) : hex(s?.bg, '#E8E2D4'));

// --- publisher marks, drawn into a size×size box centred at (0,0), in mm ---------------------
function ostrich(x, s, col) {
  // Einaudi's struzzo with the nail in its beak ("spiritus durissima coquit")
  x.save(); x.scale(s / 10, s / 10); x.translate(-5, -5); x.fillStyle = col; x.strokeStyle = col;
  x.beginPath(); x.ellipse(6.5, 1.25, 0.75, 0.55, -0.2, 0, Math.PI * 2); x.fill();
  x.lineWidth = 0.35; x.beginPath(); x.moveTo(7.1, 1.25); x.lineTo(8.6, 1.0); x.stroke(); // beak
  x.lineWidth = 0.22; x.beginPath(); x.moveTo(8.3, 0.4); x.lineTo(8.7, 1.8); x.stroke(); // the nail
  x.beginPath(); x.moveTo(6.0, 1.5); x.bezierCurveTo(5.4, 3.0, 6.5, 3.8, 5.9, 5.0); x.lineTo(6.9, 5.0); x.bezierCurveTo(7.2, 3.8, 6.4, 3.0, 7.0, 1.6); x.closePath(); x.fill(); // neck
  x.beginPath(); x.moveTo(1.0, 4.6); x.bezierCurveTo(2.0, 4.0, 4.0, 4.2, 5.5, 4.6); x.bezierCurveTo(7.6, 5.0, 7.8, 6.6, 6.0, 7.1); x.bezierCurveTo(4.3, 7.6, 2.4, 7.2, 1.6, 6.3); x.bezierCurveTo(1.0, 5.8, 0.4, 5.4, 1.0, 4.6); x.fill(); // body
  x.beginPath(); x.moveTo(1.6, 4.9); x.lineTo(0.0, 3.6); x.lineTo(0.5, 5.6); x.closePath(); x.fill(); // tail plume
  x.lineWidth = 0.42; x.lineCap = 'round';
  x.beginPath(); x.moveTo(3.8, 7.2); x.lineTo(3.3, 8.6); x.lineTo(3.7, 9.8); x.moveTo(5.0, 7.1); x.lineTo(5.6, 8.5); x.lineTo(5.3, 9.8); x.stroke();
  x.lineWidth = 0.3; x.beginPath(); x.moveTo(3.2, 9.8); x.lineTo(4.2, 9.8); x.moveTo(4.9, 9.8); x.lineTo(5.9, 9.8); x.stroke();
  x.restore();
}
function rose(x, s, col) {
  // Mondadori's rose: a ring of petals around a spiral
  x.save(); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = s * 0.06;
  x.beginPath(); x.arc(0, 0, s * 0.46, 0, Math.PI * 2); x.stroke();
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; x.beginPath(); x.ellipse(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22, s * 0.16, s * 0.09, a, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); for (let t = 0; t < 12; t += 0.2) { const r = s * 0.012 * t; x.lineTo(Math.cos(t) * r, Math.sin(t) * r); } x.stroke();
  x.restore();
}
function adelphi(x, s, col) {
  // the Adelphi mark: a pictogram of death and rebirth, here as a handful of brush strokes
  x.save(); x.strokeStyle = col; x.lineWidth = s * 0.09; x.lineCap = 'round';
  const L = (a, b, c, d) => { x.beginPath(); x.moveTo(a * s, b * s); x.lineTo(c * s, d * s); x.stroke(); };
  L(-0.3, -0.35, 0.3, -0.35); L(0, -0.45, 0, 0.1); L(-0.35, 0.1, 0.35, 0.1); L(-0.2, 0.1, -0.32, 0.42); L(0.2, 0.1, 0.32, 0.42); L(-0.15, -0.15, 0.15, -0.15);
  x.restore();
}
function wordmark(x, text, s, col, font, w, opts = {}) {
  x.save(); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = s * (opts.k ?? 0.42);
  x.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size}px "${font}"`;
  const m = x.measureText(text).width, max = w * 0.86;
  if (m > max) { const sc = max / m; if (sc < 0.72) { size *= sc / 0.72; x.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size}px "${font}"`; } x.scale(Math.max(0.72, Math.min(1, max / x.measureText(text).width)), 1); }
  x.fillText(text, 0, 0); x.restore();
}
// Il Battello a Vapore: a little paddle steamer in a white roundel
function steamboat(x, s, col) {
  x.save(); x.fillStyle = col;
  x.beginPath(); x.moveTo(-s * 0.42, s * 0.04); x.lineTo(s * 0.42, s * 0.04); x.lineTo(s * 0.3, s * 0.24); x.lineTo(-s * 0.32, s * 0.24); x.closePath(); x.fill();
  x.fillRect(-s * 0.26, -s * 0.1, s * 0.46, s * 0.14);
  x.fillRect(-s * 0.06, -s * 0.36, s * 0.12, s * 0.26);
  x.globalAlpha = 0.7; x.beginPath(); x.arc(s * 0.08, -s * 0.44, s * 0.06, 0, Math.PI * 2); x.arc(s * 0.2, -s * 0.48, s * 0.05, 0, Math.PI * 2); x.fill();
  x.restore();
}
// La Spiga: an ear of wheat
function wheatEar(x, s, col) {
  x.save(); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s * 0.04;
  x.beginPath(); x.moveTo(0, s * 0.46); x.lineTo(0, -s * 0.3); x.stroke();
  for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(sd * s * 0.08, -s * 0.3 + k * s * 0.16, s * 0.06, s * 0.11, sd * 0.5, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); x.ellipse(0, -s * 0.42, s * 0.05, s * 0.09, 0, 0, Math.PI * 2); x.fill();
  x.restore();
}
// La nave di Teseo: a ship under one square sail
function sailingShip(x, s, col) {
  x.save(); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s * 0.035;
  x.beginPath(); x.moveTo(-s * 0.42, s * 0.14); x.lineTo(s * 0.42, s * 0.14); x.quadraticCurveTo(s * 0.3, s * 0.34, 0, s * 0.34); x.quadraticCurveTo(-s * 0.3, s * 0.34, -s * 0.42, s * 0.14); x.fill();
  x.beginPath(); x.moveTo(0, s * 0.14); x.lineTo(0, -s * 0.44); x.stroke();
  x.beginPath(); x.moveTo(-s * 0.26, -s * 0.34); x.quadraticCurveTo(-s * 0.2, -s * 0.1, -s * 0.26, s * 0.06); x.lineTo(s * 0.26, s * 0.06); x.quadraticCurveTo(s * 0.32, -s * 0.1, s * 0.26, -s * 0.34); x.closePath(); x.fill();
  x.restore();
}
/** Draw a publisher's mark centred at (cx, cy) in a spine of width w (mm). */
export function drawLogo(x, pub, cx, cy, size, col, w) {
  const p = String(pub || '').toLowerCase().replace(/[^a-z]/g, '');
  x.save(); x.translate(cx, cy);
  const s = Math.min(size, w * 0.86);
  if (p.includes('battello')) steamboat(x, s, col);
  else if (p === 'nn' || p.startsWith('nneditore')) { x.strokeStyle = col; x.lineWidth = s * 0.06; x.strokeRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.6); wordmark(x, 'NN', s, col, 'Libre Franklin', w, { weight: 700, k: 0.4 }); }
  else if (p.includes('piemme')) wordmark(x, 'PIEMME', s, col, 'Libre Franklin', w, { weight: 800, k: 0.3 });
  else if (p.includes('demetra')) wordmark(x, 'Demetra', s, col, 'Playfair Display', w, { weight: 700, italic: true, k: 0.32 });
  else if (p.includes('manning')) { x.fillStyle = col; for (const dx of [-1, 1]) x.fillRect(dx * s * 0.13 - s * 0.11, -s * 0.36, s * 0.22, s * 0.3); wordmark(x, 'MANNING', s, col, 'Inter', w, { weight: 800, k: 0.17 }); }
  else if (p.includes('bodley')) { x.strokeStyle = col; x.lineWidth = s * 0.05; x.strokeRect(-s * 0.42, -s * 0.26, s * 0.84, s * 0.52); wordmark(x, 'BH', s, col, 'Inter', w, { weight: 500, k: 0.36 }); }
  else if (p.includes('littlebrown')) { wordmark(x, 'LITTLE,', s, col, 'Libre Baskerville', w, { weight: 700, k: 0.2 }); x.translate(0, s * 0.24); wordmark(x, 'BROWN', s, col, 'Libre Baskerville', w, { weight: 700, k: 0.2 }); }
  else if (p.includes('spiga')) wheatEar(x, s, col);
  else if (p.includes('ippocampo')) wordmark(x, "L'Ippocampo", s, col, 'EB Garamond', w, { weight: 600, italic: true, k: 0.3 });
  else if (p.includes('saggiatore')) { wordmark(x, 'il', s, col, 'EB Garamond', w, { weight: 500, italic: true, k: 0.26 }); x.translate(0, s * 0.28); wordmark(x, 'Saggiatore', s, col, 'EB Garamond', w, { weight: 600, k: 0.3 }); }
  else if (p.includes('nave') || p.includes('teseo')) sailingShip(x, s, col);
  else if (p.includes('terre')) wordmark(x, 'terre di mezzo', s, col, 'Jost', w, { weight: 600, k: 0.26 });
  else if (p.includes('einaudi')) ostrich(x, s, col);
  else if (p.includes('oscar')) { wordmark(x, 'OSCAR', s, col, 'Jost', w, { weight: 800, k: 0.36 }); x.translate(0, s * 0.42); rose(x, s * 0.42, col); }
  else if (p.includes('mondadori')) rose(x, s, col);
  else if (p.includes('urania')) { x.fillStyle = '#C8102E'; x.beginPath(); x.arc(0, 0, s * 0.48, 0, Math.PI * 2); x.fill(); wordmark(x, 'U', s, '#ffffff', 'Bodoni Moda', w, { weight: 800, k: 0.62 }); }
  else if (p.includes('adelphi')) adelphi(x, s, col);
  else if (p.includes('feltrinelli')) { x.strokeStyle = col; x.lineWidth = s * 0.07; x.strokeRect(-s * 0.38, -s * 0.38, s * 0.76, s * 0.76); wordmark(x, 'F', s, col, 'Bodoni Moda', w, { weight: 700, k: 0.62 }); }
  else if (p.includes('bompiani')) wordmark(x, 'Bompiani', s, col, 'Bodoni Moda', w, { weight: 600, italic: true, k: 0.34 });
  else if (p.includes('fanucci')) wordmark(x, 'Fanucci', s, col, 'Libre Baskerville', w, { weight: 700, italic: true, k: 0.32 });
  else if (p.includes('nord')) { x.strokeStyle = col; x.lineWidth = s * 0.06; x.beginPath(); x.arc(0, 0, s * 0.44, 0, Math.PI * 2); x.stroke(); wordmark(x, 'NORD', s, col, 'Oswald', w, { weight: 600, k: 0.3 }); }
  else if (p.includes('iperborea')) { wordmark(x, 'iperborea', s, col, 'Jost', w, { weight: 500, k: 0.28 }); }
  else if (p.includes('minimum')) wordmark(x, 'minimum fax', s, col, 'Courier Prime', w, { weight: 700, k: 0.24 });
  else if (p.includes('ponte') || p.includes('grazie')) { x.fillStyle = col; x.fillRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72); wordmark(x, 'PG', s, lum(col) > 0.5 ? '#222' : '#fff', 'Libre Franklin', w, { weight: 800, k: 0.4 }); }
  else if (p.includes('salani')) wordmark(x, 'Salani', s, col, 'Playfair Display', w, { weight: 700, k: 0.34 });
  else if (p.includes('sellerio')) wordmark(x, 'Sellerio', s, col, 'EB Garamond', w, { weight: 600, italic: true, k: 0.34 });
  else if (p.includes('garzanti')) { x.strokeStyle = col; x.lineWidth = s * 0.06; x.beginPath(); x.arc(0, 0, s * 0.42, 0, Math.PI * 2); x.stroke(); wordmark(x, 'G', s, col, 'Bodoni Moda', w, { weight: 700, k: 0.56 }); }
  else if (p.includes('bur') || p.includes('rizzoli')) wordmark(x, p.includes('bur') ? 'BUR' : 'Rizzoli', s, col, 'Libre Franklin', w, { weight: 800, k: 0.36 });
  else if (p.includes('marcos') || p.includes('marcosy')) wordmark(x, 'M&M', s, col, 'Bodoni Moda', w, { weight: 700, k: 0.36 });
  else if (p.includes('codice')) wordmark(x, 'codice', s, col, 'Inter', w, { weight: 700, k: 0.3 });
  else if (p.includes('neri') || p.includes('pozza')) wordmark(x, 'NP', s, col, 'Bodoni Moda', w, { weight: 700, k: 0.42 });
  else if (p.includes('tea')) wordmark(x, 'TEA', s, col, 'Libre Franklin', w, { weight: 800, k: 0.38 });
  else if (p.includes('sonzogno')) wordmark(x, 'Sonzogno', s, col, 'Playfair Display', w, { weight: 700, k: 0.3 });
  else if (pub) { const name = String(pub).split(/\s+/)[0]; wordmark(x, name, s, col, 'EB Garamond', w, { weight: 700, k: 0.3 }); }
  x.restore();
}

// --- one spine --------------------------------------------------------------------------------
/**
 * Draw a book's spine into ctx, with (0,0) at the spine's top-left and units in mm.
 * W is the thickness (across), H the height (down). Viewer's left is x=0.
 */
export function drawSpine(x, book, W, H) {
  const s = book.spine || {}, r = rng(book.seed);
  if (book.house === 'meridiani') {
    x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
    meridiani(x, book, W, H, r); wear(x, book, W, H, r, MERIDIANI_BLACK);
    x.restore();
    return;
  }
  const bg = bgOf(s);
  const ink = hex(s.text_color, lum(bg) > 0.55 ? '#1E1A17' : '#F3ECDD');
  const accent = hex(s.accent, ink);
  const fam = fontFamily(s.font_family_guess);
  x.save();
  x.beginPath(); x.rect(0, 0, W, H); x.clip();
  // ground: flat, gradient, or two-tone
  if (s.bg && typeof s.bg === 'object') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hex(s.bg.top ?? s.bg.from, bg)); g.addColorStop(1, hex(s.bg.bottom ?? s.bg.to, bg)); x.fillStyle = g; }
  else x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  // paper / cloth texture under the print
  paperGrain(x, W, H, r, book.binding === 'hardcover' ? 0.05 : 0.035, lum(bg));
  const els = Array.isArray(s.elements) && s.elements.length ? s.elements : defaultElements(book, W, H);
  for (const el of els) drawElement(x, el, W, H, { ink, accent, fam, book, r });
  wear(x, book, W, H, r, bg);
  x.restore();
}

function paperGrain(x, W, H, r, a, L) {
  x.save();
  const n = Math.floor(W * H * 0.6);
  for (let i = 0; i < n; i++) {
    x.globalAlpha = a * r(); x.fillStyle = r() < 0.5 ? '#000' : (L > 0.6 ? '#fff' : '#f3e8d0');
    x.fillRect(r() * W, r() * H, 0.15 + r() * 0.35, 0.15 + r() * 0.5);
  }
  x.restore();
}

const yOf = (v, H) => (typeof v === 'number' ? (v <= 1.0001 ? v * H : v) : null);

function drawElement(x, el, W, H, c) {
  const t = String(el.type || '').toLowerCase();
  const col = hex(el.color, el.role === 'title' || el.role === 'number' ? c.accent : c.ink);
  if (t === 'band' || t === 'rect' || t === 'block') {
    const a = yOf(el.from ?? el.y0 ?? 0, H), b = yOf(el.to ?? el.y1 ?? 1, H);
    const x0 = (el.x0 ?? 0) * W, x1 = (el.x1 ?? 1) * W;
    x.fillStyle = col; x.fillRect(x0, Math.min(a, b), x1 - x0, Math.abs(b - a));
  } else if (t === 'line' || t === 'rule') {
    const y = yOf(el.y ?? 0.5, H), th = el.thickness_mm ?? el.thickness ?? 0.5;
    const ins = (el.inset ?? 0) * W;
    x.fillStyle = col; x.fillRect(ins, y - th / 2, W - ins * 2, th);
  } else if (t === 'box' || t === 'panel' || t === 'label') {
    const a = yOf(el.from ?? 0.3, H), b = yOf(el.to ?? 0.7, H), ins = (el.inset ?? 0.1) * W;
    if (el.color) { x.fillStyle = col; x.fillRect(ins, a, W - ins * 2, b - a); }
    if (el.stroke) { x.strokeStyle = hex(el.stroke); x.lineWidth = el.stroke_mm ?? 0.35; x.strokeRect(ins + 0.2, a + 0.2, W - ins * 2 - 0.4, b - a - 0.4); }
  } else if (t === 'image_strip' || t === 'art' || t === 'image') {
    const a = yOf(el.from ?? 0, H), b = yOf(el.to ?? 1, H);
    artStrip(x, el.colors || [col], 0, a, W, b - a, c.r);
  } else if (t === 'logo' || t === 'mark') {
    const y = yOf(el.y ?? 0.93, H);
    drawLogo(x, el.publisher || c.book.publisher, W / 2, y, el.size_mm ?? Math.min(W * 0.75, 9), hex(el.color, c.ink), W);
  } else if (t === 'text') {
    drawText(x, el, W, H, col, c);
  } else if (t === 'motif' || t === 'illustration') {
    const a = yOf(el.from ?? 0.85, H), b = yOf(el.to ?? 0.95, H);
    motif(x, el, W / 2, (a + b) / 2, Math.min(W * 0.8, b - a), c.r);
  } else if (t === 'dot' || t === 'circle') {
    x.fillStyle = col; x.beginPath(); x.arc((el.x ?? 0.5) * W, yOf(el.y ?? 0.5, H), (el.size_mm ?? W * 0.3) / 2, 0, Math.PI * 2); x.fill();
  }
}

// a little drawn vignette (the research describes it in words; we pick a matching doodle)
function motif(x, el, cx, cy, s, r) {
  const cols = (el.colors || ['#222']).map((c) => hex(c));
  const d = String(el.desc || '').toLowerCase();
  x.save(); x.translate(cx, cy); x.lineCap = 'round';
  x.strokeStyle = cols[0]; x.fillStyle = cols[0]; x.lineWidth = Math.max(0.18, s * 0.045);
  if (/web|ragn|nest|nid/.test(d)) {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * s * 0.48, Math.sin(a) * s * 0.48); x.stroke(); }
    for (const rr of [0.16, 0.3, 0.44]) { x.beginPath(); for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4; x.lineTo(Math.cos(a) * s * rr, Math.sin(a) * s * rr); } x.stroke(); }
  } else if (/eye|occhi/.test(d)) {
    for (const [ex, ey] of [[-0.2, -0.15], [0.2, -0.15], [-0.15, 0.2], [0.25, 0.22]]) { x.fillStyle = cols[1] || '#fff'; x.beginPath(); x.ellipse(ex * s, ey * s, s * 0.11, s * 0.07, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = cols[2] || '#111'; x.beginPath(); x.arc(ex * s, ey * s, s * 0.04, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = cols[0]; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse((r() - 0.5) * s * 0.7, (r() - 0.5) * s * 0.7, s * 0.14, s * 0.05, r() * 3, 0, Math.PI * 2); x.stroke(); }
  } else if (/split|half|dimezz/.test(d)) {
    x.fillStyle = cols[0]; x.beginPath(); x.arc(0, -s * 0.3, s * 0.12, Math.PI / 2, Math.PI * 1.5); x.fill(); x.fillRect(-s * 0.16, -s * 0.16, s * 0.16, s * 0.6);
    x.strokeStyle = cols[1] || '#fff'; x.beginPath(); x.moveTo(s * 0.03, -s * 0.48); x.lineTo(s * 0.03, s * 0.48); x.stroke();
  } else if (/armou|armat|helmet|elmo/.test(d)) {
    x.strokeStyle = cols[1] || '#fff'; x.beginPath(); x.arc(0, -s * 0.12, s * 0.22, Math.PI, 0); x.lineTo(s * 0.22, s * 0.2); x.lineTo(-s * 0.22, s * 0.2); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-s * 0.15, -s * 0.02); x.lineTo(s * 0.15, -s * 0.02); x.stroke();
  } else if (/tree|albero|leav|fogli|baron/.test(d)) {
    x.fillStyle = cols[0]; x.beginPath(); x.arc(0, -s * 0.1, s * 0.3, 0, Math.PI * 2); x.fill(); x.fillStyle = cols[2] || '#3a2a1a'; x.fillRect(-s * 0.04, s * 0.1, s * 0.08, s * 0.35);
  } else if (/star|stell|cosm|planet|moon|luna|sun|sole/.test(d)) {
    x.beginPath(); x.arc(0, 0, s * 0.2, 0, Math.PI * 2); x.fill();
    x.strokeStyle = cols[1] || cols[0]; x.beginPath(); x.ellipse(0, 0, s * 0.42, s * 0.12, -0.4, 0, Math.PI * 2); x.stroke();
  } else if (/cit|city|tower|torr|castl|castel|build/.test(d)) {
    for (let k = -2; k <= 2; k++) { const h = s * (0.3 + r() * 0.5); x.fillRect(k * s * 0.18 - s * 0.07, s * 0.45 - h, s * 0.14, h); }
  } else if (/card|tarocc|carte/.test(d)) {
    for (let k = -1; k <= 1; k++) { x.save(); x.rotate(k * 0.3); x.fillStyle = cols[k + 1] || cols[0]; x.fillRect(-s * 0.14, -s * 0.38, s * 0.28, s * 0.5); x.strokeStyle = cols[2] || '#111'; x.strokeRect(-s * 0.14, -s * 0.38, s * 0.28, s * 0.5); x.restore(); }
  } else {
    // something drawn with a fine pen: a few nested arcs and a dot
    for (let k = 0; k < 4; k++) { x.strokeStyle = cols[k % cols.length]; x.beginPath(); x.arc((r() - 0.5) * s * 0.3, (r() - 0.5) * s * 0.3, s * (0.12 + r() * 0.3), r() * 6, r() * 6 + 3); x.stroke(); }
    x.fillStyle = cols[1] || cols[0]; x.beginPath(); x.arc(0, 0, s * 0.07, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}

function artStrip(x, colors, x0, y0, w, h, r) {
  // a sliver of wrap-around cover art: a wash of its colours with a few soft shapes
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  const g = x.createLinearGradient(0, y0, 0, y0 + h);
  colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), hex(c)));
  x.fillStyle = g; x.fillRect(x0, y0, w, h);
  for (let i = 0; i < 6 + h / 8; i++) {
    x.globalAlpha = 0.18 + r() * 0.3; x.fillStyle = hex(colors[Math.floor(r() * colors.length)]);
    x.beginPath(); x.ellipse(x0 + r() * w, y0 + r() * h, 1 + r() * w * 0.8, 1 + r() * h * 0.15, r() * 3, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}

function drawText(x, el, W, H, col, c) {
  let text = String(el.text ?? '');
  if (!text.trim()) return;
  if (el.uppercase) text = text.toUpperCase();
  const fam = el.font ? fontFamily(el.font) : (el.role === 'author' || el.role === 'title' ? c.fam : fontFamily(el.font_family || c.fam));
  const weight = el.weight ?? (el.role === 'author' ? 500 : el.role === 'title' ? 600 : 500);
  const ital = el.italic ? 'italic ' : '';
  const orient = String(el.orientation || c.book.spine?.title_orientation || 'up').toLowerCase();
  const vertical = !/horiz/.test(orient);
  const down = /down|top.?to.?bottom|ttb|discend/.test(orient);
  const lines = text.split('\n');
  let y0, y1;
  if (el.y_to != null) { y0 = yOf(el.y, H); y1 = yOf(el.y_to, H); if (y1 < y0) [y0, y1] = [y1, y0]; }
  else { const yc = yOf(el.y ?? 0.5, H); const half = Math.min(yc, H - yc) * 0.96; y0 = yc - half; y1 = yc + half; if (el.span != null) { const sp = yOf(el.span, H) / 2; y0 = yc - sp; y1 = yc + sp; } }
  const cx = (el.x ?? 0.5) * W, cy = (y0 + y1) / 2;
  const across = vertical ? W : (y1 - y0), along = vertical ? (y1 - y0) : W;
  let size = el.size_mm ?? (el.role === 'author' ? W * 0.42 : el.role === 'title' ? W * 0.5 : W * 0.32);
  // a line's em must fit across the spine, with a little margin
  const maxEm = (vertical ? W * 0.84 : W * 0.9) / (lines.length * 1.05);
  if (vertical) size = Math.min(size, maxEm);
  x.save(); x.translate(cx, cy);
  if (vertical) x.rotate(down ? Math.PI / 2 : -Math.PI / 2);
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
  const track = el.letter_spacing ?? (el.uppercase ? 0.06 : 0);
  const setFont = () => { x.font = `${ital}${weight} ${size}px "${fam}"`; if ('letterSpacing' in x) x.letterSpacing = `${(track * size).toFixed(2)}px`; };
  setFont();
  const widest = () => Math.max(...lines.map((l) => x.measureText(l).width));
  const maxLen = along * (vertical ? 0.97 : 0.9);
  let sx = 1, m = widest();
  if (m > maxLen) { sx = maxLen / m; if (sx < 0.78) { size *= sx / 0.78; setFont(); m = widest(); sx = Math.min(1, maxLen / m); } }
  const lh = size * (el.line_height ?? 1.05);
  x.scale(sx, 1);
  // cap-height optical centring: middle baseline sits a touch low for these faces
  const off = size * 0.04;
  lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * lh + off));
  x.restore();
  void across;
}

/** When the research gave colours but no layout: author at the head, title in the middle, mark at the foot. */
function defaultElements(b, W, H) {
  const s = b.spine || {};
  const o = s.title_orientation || 'up';
  const ink = s.text_color, acc = s.accent || s.text_color;
  return [
    { type: 'text', role: 'author', text: b.author, y: 0.05, y_to: 0.36, size_mm: Math.min(W * 0.4, 4.2), color: ink, orientation: o, uppercase: true, weight: 500 },
    { type: 'text', role: 'title', text: b.title, y: 0.38, y_to: 0.84, size_mm: Math.min(W * 0.55, 6), color: acc, orientation: o, weight: 600 },
    { type: 'logo', publisher: b.publisher, y: 0.92, size_mm: Math.min(W * 0.7, 8), color: ink },
  ];
}

function wear(x, book, W, H, r, bg) {
  const L = lum(bg);
  x.save();
  // a rounded spine catches less light at its edges
  const edge = book.binding === 'hardcover' || book.binding === 'jacket' ? 0.22 : 0.12;
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, `rgba(0,0,0,${edge})`); g.addColorStop(0.12, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(255,250,235,0.04)'); g.addColorStop(0.88, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${edge})`);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // sun fade, stronger towards the head of the book, which faced the window for years
  const fade = (book.age ?? 0.5) * (0.06 + r() * 0.1);
  const f = x.createLinearGradient(0, 0, 0, H);
  f.addColorStop(0, `rgba(250,240,215,${fade * 1.6})`); f.addColorStop(0.5, `rgba(250,240,215,${fade * 0.7})`); f.addColorStop(1, `rgba(250,240,215,${fade * 0.4})`);
  x.fillStyle = f; x.fillRect(0, 0, W, H);
  // reading creases on paperbacks: pale, wavering lines along the spine
  if (book.binding !== 'hardcover' && book.binding !== 'jacket') {
    const n = Math.floor((book.read ?? r()) * (1 + W / 8) + r() * 1.2);
    x.strokeStyle = L > 0.6 ? 'rgba(120,105,90,0.16)' : 'rgba(255,248,232,0.4)';
    for (let k = 0; k < n; k++) {
      let px = W * (0.15 + r() * 0.7); const y0 = r() * H * 0.3, y1 = y0 + H * (0.3 + r() * 0.6);
      x.lineWidth = 0.12 + r() * 0.25; x.beginPath(); x.moveTo(px, y0);
      for (let y = y0; y < Math.min(H, y1); y += 2 + r() * 4) { px += (r() - 0.5) * 0.5; x.lineTo(px, y); }
      x.stroke();
      // the crease breaks the ink: a few flakes where it crosses
      x.fillStyle = L > 0.6 ? 'rgba(255,255,255,0.4)' : 'rgba(255,248,232,0.25)';
      for (let i = 0; i < 6; i++) x.fillRect(px + (r() - 0.5) * 0.8, y0 + r() * (y1 - y0), 0.3 + r() * 0.6, 0.2 + r() * 0.5);
    }
  }
  // rubbed head and tail, chipped corners
  x.fillStyle = L > 0.6 ? 'rgba(90,70,50,0.28)' : 'rgba(255,245,225,0.32)';
  for (const y of [0, H]) {
    for (let i = 0; i < 18; i++) { const d = r() * 1.4; x.globalAlpha = 0.3 + r() * 0.7; x.fillRect(r() * W, y === 0 ? 0 : H - d, 0.4 + r() * 1.5, d); }
  }
  x.globalAlpha = 1;
  x.fillStyle = L > 0.6 ? 'rgba(80,60,40,0.2)' : 'rgba(255,245,225,0.22)';
  for (let i = 0; i < 40; i++) { const side = r() < 0.5 ? 0 : W - 0.5; x.fillRect(side + r() * 0.4, r() * H, 0.3, 0.5 + r() * 3); }
  // the odd scuff or stain
  if (r() < 0.12) { x.globalAlpha = 0.04 + r() * 0.05; x.fillStyle = r() < 0.5 ? '#3a2a1a' : '#fff6e0'; x.beginPath(); x.ellipse(r() * W, r() * H, W * (0.2 + r() * 0.3), 2 + r() * 6, 0, 0, Math.PI * 2); x.fill(); }
  x.restore();
}

/** The page block seen from above: cover boards along both long sides, cream pages between. */
function drawTop(x, book, W, D, r) {
  if (book.caseColor) { slipcaseTop(x, book, W, D, r); return; }
  const bg = bgOf(book.spine), hard = book.binding === 'hardcover' || book.binding === 'jacket';
  const board = hard ? 2.2 : 0.4;
  const paper = book.paper || (r() < 0.5 ? '#EFE6D2' : '#F3EBDB');
  x.fillStyle = bg; x.fillRect(0, 0, W, D);
  const inset = hard ? 2.5 : 0; // hardcover boards overhang the pages
  const back = hard ? 3 : 0.6;   // the spine's own thickness, at the front edge
  x.fillStyle = paper; x.fillRect(board, back, W - board * 2, D - inset - back);
  x.globalAlpha = 0.16;
  for (let u = board; u < W - board; u += 0.35 + r() * 0.4) { x.fillStyle = r() < 0.5 ? '#8a7a60' : '#fffaf0'; x.fillRect(u, inset, 0.12, D - inset * 2); }
  x.globalAlpha = 0.22; x.fillStyle = '#6a5a40'; x.fillRect(board, D - inset - 6, W - board * 2, 6); // dust settles at the open edge
  x.globalAlpha = 1;
  if (book.ribbon) { x.fillStyle = hex(book.ribbon); x.fillRect(W * 0.4, D * 0.4, 0.9, D * 0.5); }
}

// --- house designs ----------------------------------------------------------------------------
// A few series are drawn from their real design rather than from the research's element list.

// I Meridiani (Mondadori): a black binding blocked in gold under a clear jacket, five compartments
// between gold rules (four of them a grille of round-ended bars, the second the title panel with
// MONDADORI at its foot), and a kraft card slipcase whose board edges frame the spine.
export const SLIPCASE = '#C9A77B';
const MERIDIANI_BLACK = '#1B1C1F';
const CASE_SIDE = 1.5, CASE_END = 2; // mm of slipcase board beside and above/below the spine
/** Fit a book to its series' house design (the Meridiani slipcase adds its board all round). */
export function applySeries(b) {
  if (!b.house && /meridiani/i.test(String(b.series || ''))) {
    b.house = 'meridiani'; b.binding = 'hardcover'; b.caseColor = SLIPCASE;
    b.h += CASE_END * 2; b.t += CASE_SIDE * 2; b.d += CASE_SIDE;
    b.age = (b.age ?? 0.5) * 0.3; // the jacket and the case keep the sun off
  }
  return b;
}

function meridiani(x, book, W, H, r) {
  const bw = W - CASE_SIDE * 2, bh = H - CASE_END * 2;
  x.fillStyle = MERIDIANI_BLACK; x.fillRect(0, 0, W, H);
  x.save(); x.translate(CASE_SIDE, CASE_END);
  paperGrain(x, bw, bh, r, 0.06, 0.1); // the binding's faint leather grain
  goldLayer(x, bw, bh, r, (g) => meridianiGold(g, book, bw, bh));
  // the acetate jacket catches the light along the curve of the spine
  const s = x.createLinearGradient(0, 0, bw, 0);
  [[0, 0], [0.2, 0], [0.3, 0.09], [0.42, 0], [0.7, 0], [0.78, 0.04], [0.87, 0], [1, 0]].forEach(([u, a]) => s.addColorStop(u, `rgba(255,251,238,${a})`));
  x.fillStyle = s; x.fillRect(0, 0, bw, bh);
  x.restore();
  slipcase(x, W, H, r);
}

/** The gold blocking, as plain shapes in mm (goldLayer turns them into foil). */
function meridianiGold(g, book, w, h) {
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  g.fillRect(0.7, 0.9, 0.32, h - 1.8); g.fillRect(w - 1.02, 0.9, 0.32, h - 1.8); // fillets along the hinges
  const x0 = 1.75, cw = w - 3.5, top = 1.7, gap = 1.3, n = 5;
  const ch = (h - top * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const y0 = top + i * (ch + gap);
    g.lineWidth = 0.3; g.strokeRect(x0, y0, cw, ch);
    if (i === 1) titlePanel(g, book, x0, y0, cw, ch);
    else grille(g, x0 + 0.8, y0 + 0.8, cw - 1.6, ch - 1.6);
  }
}

function grille(g, x, y, w, h) {
  const n = Math.max(4, Math.round(w / 5.9)), gap = Math.min(1.25, w * 0.03), sw = (w - gap * (n + 1)) / n;
  roundRect(g, x, y, w, h, 0.9); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < n; k++) stadium(g, x + gap + k * (sw + gap), y + gap, sw, h - gap * 2);
  g.globalCompositeOperation = 'source-over';
}

function titlePanel(g, book, x, y, w, h) {
  g.lineWidth = 0.22; g.strokeRect(x + 0.85, y + 0.85, w - 1.7, h - 1.7);
  const { main, vol, sub } = volumeTitle(book.title);
  const cx = x + w / 2, maxW = w * 0.82;
  const size = Math.min(4.6, w * 0.104), lead = size * 1.16;
  let author = String(book.author || '').toUpperCase();
  if (measure(g, author, size) > maxW * 1.15) author = author.split(/\s+/).pop(); // only the surname, as on older volumes
  const lines = [author, ...wrap(g, main.toUpperCase(), size, maxW)];
  let cy = y + h * 0.15 + size * 0.45;
  for (const l of lines) { gilt(g, l, cx, cy, size, maxW); cy += lead; }
  if (sub) { gilt(g, sub, cx, cy - lead * 0.08, size * 0.8, maxW, { upper: false, track: 0.02 }); cy += lead * 0.95; }
  const R = size * 0.34;
  for (let k = 0; k < vol; k++) star(g, cx + (k - (vol - 1) / 2) * R * 2.5, cy - lead * 0.1, R);
  gilt(g, 'MONDADORI', cx, y + h * 0.86, Math.min(2.3, size * 0.55), maxW, { track: 0.12 });
}

/** "Romanzi. Vol. 2: 1991-1997" → the title, the volume (drawn as stars) and what follows it. */
function volumeTitle(t) {
  const m = String(t).match(/^(.*?)[\s.,;:–-]*\bvol(?:ume)?\.?\s*(\d+|[ivx]+)\b\s*[:.,–-]?\s*(.*)$/i);
  if (!m) return { main: String(t), vol: 0, sub: '' };
  const vol = /^\d+$/.test(m[2]) ? +m[2] : { i: 1, ii: 2, iii: 3, iv: 4, v: 5 }[m[2].toLowerCase()] || 0;
  return { main: m[1].trim(), vol: Math.min(vol, 5), sub: m[3].trim().replace(/(\d)\s*-\s*(\d)/g, '$1–$2') };
}

const giltFont = (size, o = {}) => `${o.italic ? 'italic ' : ''}${o.weight ?? 600} ${size}px "EB Garamond"`;
function measure(g, text, size, o = {}) {
  g.font = giltFont(size, o); if ('letterSpacing' in g) g.letterSpacing = `${((o.track ?? 0.05) * size).toFixed(3)}px`;
  return g.measureText(text).width;
}
/** One centred line of blocked lettering, squeezed (then shrunk) to fit. */
function gilt(g, text, cx, cy, size, maxW, o = {}) {
  if (o.upper !== false) text = text.toUpperCase();
  let m = measure(g, text, size, o), sx = 1;
  if (m > maxW) { sx = maxW / m; if (sx < 0.8) { size *= sx / 0.8; m = measure(g, text, size, o); sx = Math.min(1, maxW / m); } }
  g.save(); g.translate(cx, cy); g.scale(sx, 1);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, size * 0.04);
  g.restore();
}
function wrap(g, text, size, maxW) {
  const out = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && measure(g, last + ' ' + w, size) <= maxW) out[out.length - 1] = last + ' ' + w; else out.push(w);
  }
  return out.length ? out : [''];
}
function star(g, cx, cy, R) {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.42 : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function stadium(g, x, y, w, h) {
  const rr = w / 2;
  g.beginPath(); g.moveTo(x, y + rr); g.arc(x + rr, y + rr, rr, Math.PI, 0); g.lineTo(x + w, y + h - rr); g.arc(x + rr, y + h - rr, rr, 0, Math.PI); g.closePath(); g.fill();
}
function roundRect(g, x, y, w, h, rr) {
  g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr); g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath();
}

/**
 * Gold foil: draw the blocking's shapes on a scratch canvas at the destination's resolution, colour
 * them with a sheen that follows the curve of the spine, add foil grain and rub a little off.
 */
const FOIL = [[0, '#6E5528'], [0.12, '#A4864A'], [0.32, '#E4C886'], [0.5, '#CFAE69'], [0.78, '#A8884A'], [1, '#6A5126']];
function goldLayer(x, w, h, r, shapes) {
  const T = x.getTransform(), k = Math.hypot(T.a, T.b) || 1;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext('2d'); g.scale(c.width / w, c.height / h);
  shapes(g);
  g.globalCompositeOperation = 'source-in';
  const s = g.createLinearGradient(0, 0, w, 0); FOIL.forEach(([u, col]) => s.addColorStop(u, col));
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0, n = Math.floor(w * h * 1.2); i < n; i++) {
    g.globalAlpha = 0.28 * r(); g.fillStyle = r() < 0.5 ? '#FFF2CC' : '#4A3513';
    g.fillRect(r() * w, r() * h, 0.12 + r() * 0.25, 0.12 + r() * 0.25);
  }
  // worn spots, mostly at the head and tail where fingers pull the book out
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 30; i++) {
    const y = r() < 0.65 ? (r() < 0.5 ? r() * 8 : h - r() * 8) : r() * h;
    g.globalAlpha = 0.2 + r() * 0.6; g.beginPath(); g.ellipse(r() * w, y, 0.2 + r() * 0.9, 0.15 + r() * 0.45, r() * 3, 0, Math.PI * 2); g.fill();
  }
  x.drawImage(c, 0, 0, w, h);
  c.width = c.height = 1;
}

/** The slipcase's board edges round the spine, with a hair of shadow where the book slides in. */
function slipcase(x, W, H, r) {
  x.save();
  x.fillStyle = SLIPCASE;
  x.fillRect(0, 0, W, CASE_END); x.fillRect(0, H - CASE_END, W, CASE_END); x.fillRect(0, 0, CASE_SIDE, H); x.fillRect(W - CASE_SIDE, 0, CASE_SIDE, H);
  x.fillStyle = 'rgba(255,248,230,0.35)'; // the cut edge is paler at the outside
  x.fillRect(0, 0, W, 0.35); x.fillRect(0, H - 0.35, W, 0.35); x.fillRect(0, 0, 0.35, H); x.fillRect(W - 0.35, 0, 0.35, H);
  for (let i = 0, n = Math.floor((W + H) * 6); i < n; i++) {
    const side = Math.floor(r() * 4), along = r(), across = r();
    const [px, py] = side === 0 ? [along * W, across * CASE_END] : side === 1 ? [along * W, H - across * CASE_END] : side === 2 ? [across * CASE_SIDE, along * H] : [W - across * CASE_SIDE, along * H];
    x.globalAlpha = 0.25 * r(); x.fillStyle = r() < 0.5 ? '#6B4E2C' : '#F3E2C2'; x.fillRect(px, py, 0.15 + r() * 0.3, 0.15 + r() * 0.3);
  }
  x.globalAlpha = 1;
  x.strokeStyle = 'rgba(18,12,6,0.7)'; x.lineWidth = 0.3;
  x.strokeRect(CASE_SIDE - 0.1, CASE_END - 0.1, W - CASE_SIDE * 2 + 0.2, H - CASE_END * 2 + 0.2);
  x.restore();
}
function slipcaseTop(x, book, W, D, r) {
  x.fillStyle = book.caseColor; x.fillRect(0, 0, W, D);
  for (let i = 0, n = Math.floor(W * D * 0.5); i < n; i++) { x.globalAlpha = 0.2 * r(); x.fillStyle = r() < 0.5 ? '#6B4E2C' : '#F3E2C2'; x.fillRect(r() * W, r() * D, 0.2 + r() * 0.5, 0.2 + r() * 0.5); }
  x.globalAlpha = 0.3; x.fillStyle = '#F6E8CC'; x.fillRect(0, 0, W, 0.4); // the open end's cut edge
  x.globalAlpha = 0.12; x.fillStyle = '#5A4630'; x.fillRect(0, D * 0.55, W, D * 0.45); // dust towards the back
  x.globalAlpha = 1;
}

// --- the atlas --------------------------------------------------------------------------------
const PAD = 1.2; // mm of bled colour round each cell so mipmaps don't pick up neighbours
export class SpineAtlas {
  /**
   * opts.spinesOnly packs spines alone (for close-ups), opts.height makes the canvas non-square,
   * opts.maxScale caps the px per mm, opts.secondary keeps the books' own uv (the room atlas's)
   * untouched and only fills this.uv, opts.hatch / opts.wash tune the ink material.
   */
  constructor(books, size = 4096, opts = {}) {
    this.books = books; this.size = size; this.opts = opts; this.uv = new Map();
    this.canvas = document.createElement('canvas'); this.canvas.width = size; this.canvas.height = opts.height ?? size;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8; this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.mat = makeInk({ color: '#ffffff', map: this.tex, wash: opts.wash ?? 0.9, hatch: opts.hatch ?? 0.32 });
    this.pack();
    if (!opts.deferDraw) this.draw();
  }
  pack() {
    // rects in mm: the spine (W×H) and, unless spinesOnly, the top (W×D) side by side; shelf-pack them at the largest scale that fits
    const only = this.opts.spinesOnly, SW = this.canvas.width, SH = this.canvas.height;
    const items = this.books.map((b) => ({ b, w: only ? b.t + PAD * 2 : b.t + b.t + PAD * 4, h: (only ? b.h : Math.max(b.h, b.d)) + PAD * 2 }));
    items.sort((a, b) => b.h - a.h);
    let s = this.opts.maxScale ?? 6;
    for (; s > 0.6; s *= 0.97) {
      let x = 0, y = 0, rowH = 0, ok = true;
      for (const it of items) {
        const w = Math.ceil(it.w * s), h = Math.ceil(it.h * s);
        if (x + w > SW) { x = 0; y += rowH; rowH = 0; }
        if (y + h > SH) { ok = false; break; }
        it.px = x; it.py = y; x += w; rowH = Math.max(rowH, h);
      }
      if (ok) break;
    }
    this.scale = s; this.items = items;
  }
  draw() {
    const x = this.canvas.getContext('2d'), s = this.scale, SW = this.canvas.width, SH = this.canvas.height, only = this.opts.spinesOnly;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#d8ccb4'; x.fillRect(0, 0, SW, SH);
    for (const it of this.items) {
      const b = it.b, r = rng(b.seed ^ 0x9e37);
      const bg = bgOf(b.spine);
      x.save(); x.translate(it.px, it.py); x.scale(s, s);
      x.fillStyle = b.caseColor || bg; x.fillRect(0, 0, it.w, it.h); // also the colour of the book's sides
      x.save(); x.translate(PAD, PAD); drawSpine(x, b, b.t, b.h); x.restore();
      if (!only) { x.save(); x.translate(b.t + PAD * 3, PAD); drawTop(x, b, b.t, b.d, r); x.restore(); }
      x.restore();
      const U = (mmx) => (it.px + mmx * s) / SW, V = (mmy) => 1 - (it.py + mmy * s) / SH;
      const uv = {
        spine: [U(PAD), V(PAD + b.h), U(PAD + b.t), V(PAD)],
        plain: [U(PAD * 0.5), V(PAD + b.h * 0.5)],
      };
      uv.top = only ? [uv.plain[0], uv.plain[1], uv.plain[0], uv.plain[1]] : [U(b.t + PAD * 3), V(PAD + b.d), U(b.t * 2 + PAD * 3), V(PAD)];
      this.uv.set(b, uv);
      if (!this.opts.secondary) b.uv = uv;
    }
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.mat.dispose(); this.canvas.width = this.canvas.height = 1; }
}

/** UVs for a book box (BoxGeometry: +x,-x,+y,-y,+z,-z; the spine faces the room, -z). */
export function bookUV(geo, b, spineFace = 5, map = b.uv) {
  const uv = geo.attributes.uv;
  for (let v = 0; v < uv.count; v++) {
    const f = Math.floor(v / 4), u0 = uv.getX(v), v0 = uv.getY(v);
    if (f === spineFace) { const [a, bb, c, d] = map.spine; uv.setXY(v, a + u0 * (c - a), bb + v0 * (d - bb)); }
    else if (f === 2) { const [a, bb, c, d] = map.top; uv.setXY(v, a + u0 * (c - a), bb + v0 * (d - bb)); }
    else uv.setXY(v, map.plain[0], map.plain[1]);
  }
  uv.needsUpdate = true;
}
