// The 1996/97 Brescia "Pagine Gialle" on the phone table: canvas art for the cover, the spine and
// the AGRITURISMO page where Cascina Carretto sits. Drawn, not photographed, in the way of the mid-90s SEAT
// editions: lemon-yellow board cover, a huge black grotesque title, the province in a pale panel, a red
// "NOVITÀ!" sash, the recycled-paper roundel and the two-arrow mark; inside, yellow newsprint in four columns,
// a black-barred category head, plain entries with dot leaders and boxed display ads.

export const VENUE = {
  name: 'Cascina Carretto',
  street: 'Località Cascina Carretto',
  short: 'Loc. Cascina Carretto', // as the directory would abbreviate it
  town: '25030 Erbusco (BS)',
  tel: '030/7769869',
  maps: 'https://maps.app.goo.gl/3DUPBKpB8tmckejS8',
};

const INK = '#141210', YELLOW = '#F6D21E', NEWSPRINT = '#F4E07E', RED = '#D2311F', BLUE = '#2C4E9A', SKY = '#BFD9E8';
const HEAVY = '"Archivo Black", "Arial Black", sans-serif';
const NARROW = '"Archivo Narrow", "Arial Narrow", sans-serif';
export const FONTS = ['400 20px "Archivo Black"', '400 20px "Archivo Narrow"', '700 20px "Archivo Narrow"', '700 20px "Caveat"'];

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function grain(x, W, H, n, alpha, seed) {
  const r = rnd(seed);
  for (let i = 0; i < n; i++) { x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha * r()})` : `rgba(255,255,255,${alpha * r()})`; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
}

/** The two-arrow mark: an arrow to the right above an arrow to the left, joined like a Z. */
function arrows(x, cx, cy, s) {
  const arrow = (dir, oy, fill) => {
    x.save(); x.translate(cx, cy + oy * s); x.scale(dir * s, s);
    x.beginPath(); x.moveTo(-1, -0.16); x.lineTo(0.55, -0.16); x.lineTo(0.55, -0.42); x.lineTo(1, 0); x.lineTo(0.55, 0.42); x.lineTo(0.55, 0.16); x.lineTo(-1, 0.16); x.closePath();
    x.fillStyle = fill; x.fill(); x.lineWidth = 0.07; x.strokeStyle = RED; x.stroke(); x.restore();
  };
  x.save(); x.lineWidth = 0.32 * s; x.strokeStyle = BLUE; x.beginPath(); x.moveTo(cx - 0.75 * s, cy - 0.3 * s); x.lineTo(cx + 0.75 * s, cy + 0.3 * s); x.stroke(); x.restore();
  arrow(1, -0.32, BLUE); arrow(-1, 0.32, BLUE);
}

/** A long Franciacorta farmhouse: portico arches, a pantile roof, a dovecote tower, rows of vines in front. */
function cascina(x, ox, oy, w, color) {
  const s = w / 100; x.save(); x.translate(ox, oy); x.scale(s, s);
  x.strokeStyle = color; x.lineWidth = 1.1; x.lineJoin = 'round'; x.lineCap = 'round';
  const L = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); };
  L([[6, 40], [6, 22], [30, 14], [70, 14], [94, 22], [94, 40]]); // walls and roof line
  L([[2, 23], [30, 13], [70, 13], [98, 23]]);
  for (let i = 0; i < 14; i++) L([[30 + i * 3, 13.5], [30 + i * 3 - 1.5, 15.5]]); // pantiles
  L([[40, 14], [40, 2], [50, -4], [60, 2], [60, 14]]); L([[38, 3], [50, -5.5], [62, 3]]); // dovecote
  for (const a of [44, 52]) { x.beginPath(); x.arc(a + 2, 6, 1.6, 0, Math.PI * 2); x.stroke(); }
  for (let i = 0; i < 5; i++) { const a = 14 + i * 15; L([[a, 40], [a, 31]]); x.beginPath(); x.arc(a + 5.5, 31, 5.5, Math.PI, 0); x.stroke(); L([[a + 11, 31], [a + 11, 40]]); }
  for (const a of [12, 27, 72, 86]) x.strokeRect(a - 2, 23, 4, 4);
  for (let r = 0; r < 3; r++) { const y = 46 + r * 5, k = 1 + r * 0.12; L([[50 - 48 * k, y], [50 + 48 * k, y]]); for (let i = -6; i <= 6; i++) L([[50 + i * 7.6 * k, y], [50 + i * 7.6 * k, y - 2.2 * k]]); }
  L([[-4, 40], [104, 40]]);
  x.restore();
}

/** Front cover, any size with a 3:4 aspect (21 × 28 cm). */
export function drawCover(x, W, H) {
  x.fillStyle = YELLOW; x.fillRect(0, 0, W, H);
  grain(x, W, H, W * 6, 0.05, 7);
  const u = W / 100;
  // edition line
  x.fillStyle = INK; x.font = `700 ${4.6 * u}px ${NARROW}`; x.textBaseline = 'alphabetic';
  x.fillText('1996/97', 8 * u, 9 * u);
  x.font = `400 ${2.6 * u}px ${NARROW}`; x.fillText('da utilizzare fino a ottobre 1997', 22 * u, 8.8 * u);
  x.fillRect(8 * u, 11 * u, 84 * u, 0.35 * u);
  // title
  x.font = `400 ${19.5 * u}px ${HEAVY}`; x.letterSpacing = `${-0.6 * u}px`;
  x.fillText('PAGINE', 7 * u, 32 * u); x.fillText('GIALLE', 7 * u, 51 * u);
  x.letterSpacing = '0px'; x.font = `700 ${3 * u}px ${NARROW}`; x.fillText('®', 85 * u, 38 * u);
  x.font = `700 ${6.4 * u}px ${NARROW}`; x.fillText('Brescia e provincia', 8 * u, 62 * u);
  // the pale panel with the farmhouse
  x.fillStyle = SKY; x.fillRect(8 * u, 67 * u, 58 * u, 44 * u);
  x.strokeStyle = BLUE; x.lineWidth = 0.5 * u; x.strokeRect(8 * u, 67 * u, 58 * u, 44 * u);
  x.save(); x.beginPath(); x.rect(8 * u, 67 * u, 58 * u, 44 * u); x.clip(); cascina(x, 17 * u, 79 * u, 40 * u, BLUE); x.restore();
  x.fillStyle = BLUE; x.font = `700 ${3.3 * u}px ${NARROW}`; x.textAlign = 'center';
  x.fillText('CASA · LAVORO · TEMPO LIBERO', 37 * u, 108.2 * u); x.textAlign = 'left';
  // "consultate subito" list on the right, as on the 1998 covers
  x.fillStyle = RED; x.fillRect(70 * u, 67 * u, 22 * u, 4.4 * u);
  x.fillStyle = '#fff'; x.font = `700 ${2.6 * u}px ${NARROW}`; x.fillText('Consultate subito', 71.2 * u, 70.1 * u);
  x.fillStyle = INK; x.font = `400 ${2.35 * u}px ${NARROW}`;
  ['• Guida pratica', '  del cittadino', '• Indici delle', '  categorie', '• Cartine stradali', '• Numeri utili', '  e di emergenza'].forEach((t, i) => x.fillText(t, 70.5 * u, (75 + i * 3.4) * u));
  // red sash across the top-right corner
  x.save(); x.translate(W, 0); x.rotate(Math.PI / 4);
  x.fillStyle = RED; x.fillRect(-20 * u, 9 * u, 40 * u, 7 * u);
  x.fillStyle = '#fff'; x.font = `400 ${3.6 * u}px ${HEAVY}`; x.textAlign = 'center'; x.fillText('NOVITÀ!', 0, 14 * u);
  x.restore(); x.textAlign = 'left';
  // recycled-paper roundel, bottom left
  x.strokeStyle = '#2E8A4A'; x.fillStyle = '#2E8A4A'; x.lineWidth = 0.5 * u;
  x.beginPath(); x.arc(14 * u, 124 * u, 5.2 * u, 0, Math.PI * 2); x.stroke();
  x.font = `700 ${3 * u}px ${NARROW}`; x.textAlign = 'center'; x.fillText('40%', 14 * u, 124.5 * u);
  x.font = `400 ${1.6 * u}px ${NARROW}`; x.fillText('carta riciclata', 14 * u, 127 * u); x.textAlign = 'left';
  x.fillStyle = INK; x.font = `400 ${2.2 * u}px ${NARROW}`;
  x.fillText('Dal 1° luglio 1996 anche per le telefonate urbane', 22 * u, 123 * u);
  x.fillText('bisogna comporre il prefisso', 22 * u, 126 * u);
  // the mark and the publisher, bottom right
  arrows(x, 80 * u, 121.5 * u, 6 * u);
  x.fillStyle = INK; x.font = `400 ${4.4 * u}px ${HEAVY}`; x.fillText('SEAT', 72.5 * u, 130.5 * u);
  x.font = `400 ${1.8 * u}px ${NARROW}`; x.fillText('s.p.a.', 88 * u, 130.5 * u);
}

/** The spine (thickness : height), title running down it. */
export function drawSpine(x, W, H) {
  x.fillStyle = YELLOW; x.fillRect(0, 0, W, H); grain(x, W, H, H * 2, 0.06, 3);
  x.save(); x.translate(W / 2, 0); x.rotate(Math.PI / 2); x.fillStyle = INK; x.textBaseline = 'middle';
  x.font = `400 ${W * 0.42}px ${HEAVY}`; x.fillText('PAGINE GIALLE', H * 0.06, 0);
  x.font = `700 ${W * 0.3}px ${NARROW}`; x.fillText('BRESCIA e provincia  1996/97', H * 0.56, 0);
  x.restore();
  x.fillStyle = INK; x.fillRect(0, H * 0.92, W, H * 0.08);
}

// --- the page ------------------------------------------------------------------------------------
// Neighbours on the page are made up (names, streets and numbers); only the venue is real.
const TOWNS = ['Adro', 'Capriolo', 'Cazzago S. M.', 'Chiari', 'Coccaglio', 'Cologne', 'Corte Franca', 'Erbusco', 'Gussago', 'Iseo', 'Ome', 'Paderno F.', 'Palazzolo s/O.', 'Paratico', 'Passirano', 'Provaglio d\'Iseo', 'Rodengo Saiano', 'Rovato', 'Sale Marasino', 'Monticelli B.'];
const STREETS = ['V. Roma', 'V. Mazzini', 'V. Garibaldi', 'P.za Vittoria', 'V. Cavour', 'V. Dante', 'V. Marconi', 'V. Verdi', 'C.so Zanardelli', 'V. Matteotti', 'V. Brescia', 'V. Bergamo'];
const TAIL = ['Sebino Viaggi', 'Sole e Vacanze', 'Turismo Oglio', 'Valigia Blu', 'Viaggi del Monte', 'Viaggi Franciacorta', 'Viaggi Gabbiano', 'Viaggiare Insieme', 'Vie del Mondo', 'Villa Vacanze', 'Volare Tour', 'Zenit Viaggi'];
const FARMS = ['Ai Gelsi', 'Al Castagneto', 'Al Torchio', 'Antica Corte Bonomi', 'Barco Vecchio', 'Belvedere dei Ronchi', 'Boschetto (Il)', 'Brolo dei Peri', 'Ca\' Bianca', 'Ca\' dei Ronchi', 'Ca\' del Lupo', 'Ca\' Rossa', 'Campiani', 'Cantina del Pozzo', 'Casale delle More', 'Cascina Albera', 'Cascina Belfiore', 'Cascina Boschi', 'Cascina Brede', 'Cascina Canneto', 'Cascina Capitanio', 'Cascina Caprera', 'Cascina Carera', 'Cascina Carpine',
  'VENUE', 'Cascina Castagna', 'Cascina dei Gelsi', 'Cascina Fenile', 'Cascina Moie', 'Cascina Nuova', 'Cascina Pradella', 'Cascina S. Rocco', 'Cascina Solive', 'Castelletto (Il)', 'Colombaia (La)', 'Corte del Vento', 'Corte Lantieri', 'Dosso (Il)', 'Fienile (Il)', 'Fontanili (Ai)', 'Gelso (Al)', 'Granaio (Il)'];
function entry(name, r) {
  const t = TOWNS[Math.floor(r() * TOWNS.length)], st = STREETS[Math.floor(r() * STREETS.length)];
  const n = String(Math.floor(r() * 9000000) + 1000000), tel = `030/${n[0] === '0' ? '7' : n[0]}${n.slice(1)}`;
  return [name, `${st} ${1 + Math.floor(r() * 60)} ${t}`, tel.slice(0, 11)];
}

function leaderLine(x, name, addr, tel, X, Y, w, f) {
  x.fillStyle = INK; x.font = `700 ${f}px ${NARROW}`; x.fillText(name, X, Y);
  const nw = x.measureText(name).width;
  x.font = `400 ${f}px ${NARROW}`;
  const tw = x.measureText(tel).width;
  let ax = X + nw + f * 0.3;
  if (ax + x.measureText(addr).width > X + w) { Y += f * 1.12; ax = X + f * 0.8; }
  x.fillText(addr, ax, Y);
  let lx = ax + x.measureText(addr).width + f * 0.35; const end = X + w - tw - f * 0.3;
  if (lx > end) { Y += f * 1.12; lx = X + f * 2; }
  x.fillStyle = 'rgba(20,18,16,0.7)'; for (; lx < end; lx += f * 0.4) x.fillRect(lx, Y - f * 0.1, f * 0.085, f * 0.085);
  x.fillStyle = INK; x.fillText(tel, X + w - tw, Y);
  return Y + f * 1.3;
}

/** One right-hand page of the AGRITURISMO category: 3:4, returns where the venue's entry and ad sit (canvas px). */
export function drawPage(x, W, H, opts = {}) {
  const u = W / 100, f = 1.75 * u, m = 5 * u, gap = 1.8 * u, cw = (W - 2 * m - 3 * gap) / 4;
  const r = rnd(42);
  x.fillStyle = NEWSPRINT; x.fillRect(0, 0, W, H); grain(x, W, H, W * 10, 0.05, 11);
  x.save(); x.globalAlpha = 0.04; x.fillStyle = INK; // a faint show-through of the page behind
  for (let i = 0; i < 300; i++) x.fillRect(m + (i % 4) * (cw + gap) + 0.15 * cw, 15 * u + Math.floor(i / 4) * 1.6 * u, cw * (0.45 + ((i * 37) % 45) / 100), 0.45 * u);
  x.restore(); x.fillStyle = INK; x.textBaseline = 'alphabetic';
  // running head
  x.font = `400 ${3.4 * u}px ${HEAVY}`; x.fillText('Agriturismo', m, 8.4 * u);
  x.font = `700 ${2 * u}px ${NARROW}`; x.textAlign = 'right'; x.fillText('Agenzie viaggi — Agriturismo', W - m - 7 * u, 8 * u);
  x.font = `400 ${3.4 * u}px ${HEAVY}`; x.fillText('37', W - m, 8.4 * u); x.textAlign = 'left';
  x.fillRect(m, 9.8 * u, W - 2 * m, 0.45 * u);
  for (let i = 1; i < 4; i++) x.fillRect(m + i * (cw + gap) - gap / 2, 11.8 * u, 0.1 * u, (i === 3 ? H - 47.5 * u : H - 6.2 * u) - 11.8 * u); // the ad interrupts the last rule
  const top = 13.6 * u;
  let col = 0, X = m, Y = top;
  const next = () => { col++; X = m + col * (cw + gap); Y = top; };
  const adTop = H - 45 * u, bottom = () => (col >= 2 ? adTop - 2.5 * u : H - 8 * u);
  // the end of "Agenzie viaggi", with a small boxed ad
  for (const n of TAIL.slice(0, 7)) { const e = entry(n, r); Y = leaderLine(x, e[0], e[1], e[2], X, Y, cw, f); }
  Y += 0.4 * u; x.lineWidth = 0.25 * u; x.strokeRect(X, Y, cw, 15 * u);
  x.font = `400 ${2.2 * u}px ${HEAVY}`; x.textAlign = 'center'; x.fillText('VOLARE TOUR', X + cw / 2, Y + 4.4 * u);
  x.font = `italic 400 ${f * 0.85}px ${NARROW}`; x.fillText('voli · crociere · viaggi di nozze', X + cw / 2, Y + 7.4 * u);
  x.font = `700 ${f}px ${NARROW}`; x.fillText('Rovato · V. Roma 12', X + cw / 2, Y + 10.4 * u);
  x.font = `400 ${2.2 * u}px ${HEAVY}`; x.fillText('030/7700001', X + cw / 2, Y + 13.4 * u); x.textAlign = 'left';
  Y += 18 * u;
  for (const n of TAIL.slice(7)) { const e = entry(n, r); Y = leaderLine(x, e[0], e[1], e[2], X, Y, cw, f); }
  // category head: a black bar, the name reversed out, a "see also"
  Y += 0.8 * u; x.fillRect(X, Y, cw, 4.6 * u);
  x.fillStyle = NEWSPRINT; x.font = `400 ${2.3 * u}px ${HEAVY}`; x.fillText('AGRITURISMO', X + 1 * u, Y + 3.45 * u); x.fillStyle = INK;
  Y += 7 * u; x.font = `italic 400 ${f * 0.95}px ${NARROW}`;
  for (const l of ['vedi anche: Alberghi;', 'Aziende agricole; Ricevimenti', 'e banchetti – sale; Ristoranti;', 'Vini – produzione']) { x.fillText(l, X, Y); Y += f * 1.15; }
  Y += f * 0.5;
  const at = {};
  for (const n of FARMS) {
    if (Y > bottom() - (n === 'VENUE' ? 22 * u : 1.5 * u)) next();
    if (col > 3) break;
    if (n !== 'VENUE') { const e = entry(n, r); Y = leaderLine(x, e[0], e[1], e[2], X, Y, cw, f); continue; }
    // a "spazio" entry: bold, boxed, with the full address
    const t = Y - f * 1.1, h = 16.5 * u, p = 1.1 * u;
    x.lineWidth = 0.3 * u; x.strokeRect(X, t, cw, h);
    let y = t + 3.4 * u;
    x.font = `400 ${1.62 * u}px ${HEAVY}`; x.fillText('CASCINA CARRETTO', X + p, y); y += 2.6 * u;
    x.font = `italic 400 ${f * 0.95}px ${NARROW}`; x.fillText('agriturismo · ricevimenti', X + p, y); y += 2.6 * u;
    x.font = `400 ${f * 1.05}px ${NARROW}`;
    x.fillText(VENUE.short, X + p, y); y += f * 1.25;
    x.font = `700 ${f * 1.05}px ${NARROW}`; x.fillText(VENUE.town.toUpperCase(), X + p, y); y += f * 1.75;
    x.font = `400 ${2.6 * u}px ${HEAVY}`; x.textAlign = 'right'; x.fillText(VENUE.tel, X + cw - p, y); x.textAlign = 'left';
    at.entry = { x: X, y: t, w: cw, h };
    Y = t + h + f * 1.7 + 5 * u; // room for the pen note
  }
  // the display ad at the foot of columns 3–4
  const ax = m + 2 * (cw + gap), ay = adTop, aw = 2 * cw + gap, ah = 37 * u, cx = ax + aw / 2;
  x.lineWidth = 0.6 * u; x.strokeRect(ax, ay, aw, ah); x.lineWidth = 0.15 * u; x.strokeRect(ax + 0.9 * u, ay + 0.9 * u, aw - 1.8 * u, ah - 1.8 * u);
  x.textAlign = 'center'; x.font = `400 ${3.3 * u}px ${HEAVY}`; x.fillText('CASCINA CARRETTO', cx, ay + 6.6 * u);
  x.font = `italic 700 ${2.1 * u}px ${NARROW}`; x.fillText('agriturismo in Franciacorta', cx, ay + 9.9 * u);
  x.save(); x.beginPath(); x.rect(ax + 2 * u, ay + 10.5 * u, aw - 4 * u, 17 * u); x.clip(); cascina(x, cx - 16 * u, ay + 15 * u, 32 * u, INK); x.restore();
  x.fillStyle = RED; x.fillRect(ax + 2.5 * u, ay + 27.6 * u, aw - 5 * u, 3.6 * u);
  x.fillStyle = '#fff'; x.font = `700 ${1.45 * u}px ${NARROW}`; x.fillText('CUCINA DEL TERRITORIO · VINI · MATRIMONI E RICEVIMENTI', cx, ay + 30.1 * u);
  x.fillStyle = INK; x.font = `700 ${1.45 * u}px ${NARROW}`;
  x.fillText(`${VENUE.street} · ${VENUE.town.toUpperCase()}`, cx, ay + 33.2 * u);
  x.font = `400 ${1.9 * u}px ${HEAVY}`; x.fillText(`Tel. ${VENUE.tel}`, cx, ay + 35.6 * u);
  x.textAlign = 'left'; at.ad = { x: ax, y: ay, w: aw, h: ah };
  // foot of the page
  x.font = `400 ${1.5 * u}px ${NARROW}`; x.fillText('Brescia e provincia 1996/97 · Le inserzioni sono pubblicate a cura della SEAT', m, H - 3.2 * u);
  if (opts.pen !== false) pen(x, at.entry, u);
  return at;
}

/** A blue ballpoint ring round the venue's entry, and a scribbled note. */
function pen(x, e, u) {
  x.save(); x.strokeStyle = 'rgba(32,52,150,0.85)'; x.lineWidth = 0.42 * u; x.lineCap = 'round';
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, rx = e.w * 0.62, ry = e.h * 0.66;
  x.beginPath(); for (let t = 0.15; t <= Math.PI * 2 + 0.75; t += 0.02) { const k = 1 + 0.035 * Math.sin(t * 3) + (t > Math.PI * 2 ? 0.04 : 0); x.lineTo(cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k); } x.stroke();
  x.fillStyle = 'rgba(32,52,150,0.9)'; x.font = `700 ${3.6 * u}px "Caveat", cursive`;
  x.translate(e.x + e.w * 0.12, e.y + e.h + 4.6 * u); x.rotate(-0.05); x.fillText('qui! 29 maggio 2027', 0, 0);
  x.restore();
}
