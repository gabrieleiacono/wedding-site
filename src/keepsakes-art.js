// The pictures for the keepsakes in the room (keepsakes.js), drawn in canvas: the two prints on the desk
// wall (a rubbing of the rock carvings in Valle Camonica, an etching of Modica), the weave of the wicker
// bin and the draft lying beside it, and the Sicilian rag rug. Every function returns a canvas.

const INK = '#1A1714';

export function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647, (s - 1) / 2147483646); }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; return [c, g]; }
function pen(g, w = 3, c = INK) { g.strokeStyle = c; g.lineWidth = w; }
function poly(g, pts, close = true) { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); if (close) g.closePath(); }
/** Parallel hatch lines clipped to the current path. */
function hatch(g, x0, y0, x1, y1, step, ang = Math.PI / 4, w = 1, c = INK, r = Math.random) {
  g.save(); g.clip(); pen(g, w, c);
  const d = Math.hypot(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let t = -d; t < d; t += step) {
    const ox = cx - dy * t + (r() - 0.5) * step * 0.25, oy = cy + dx * t;
    g.beginPath(); g.moveTo(ox - dx * d, oy - dy * d); g.lineTo(ox + dx * d, oy + dy * d); g.stroke();
  }
  g.restore();
}
function text(g, s, x, y, font, fill = INK, align = 'center', rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.font = font; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
}

// --- 3 · Due terre: the two prints ---------------------------------------------------------------
export function rockRubbing() {
  const W = 700, H = 900;
  const [c, g] = cv(W, H);
  const r = rng(8000);
  // passe-partout
  g.fillStyle = '#F4EEE0'; g.fillRect(0, 0, W, H);
  const x0 = 70, y0 = 70, w = W - 140, h = H - 220;
  // the rubbing: graphite over rice paper, the glacier-polished rock streaks showing through
  g.fillStyle = '#5F5A63'; g.fillRect(x0, y0, w, h);
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  for (let i = 0; i < 900; i++) { const y = y0 + r() * h; g.strokeStyle = `rgba(${r() > 0.5 ? '220,215,225' : '30,28,34'},${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const x = x0 + r() * w; g.moveTo(x, y); g.lineTo(x + 40 + r() * 140, y + (r() - 0.5) * 20 + 30); g.stroke(); }
  g.restore();
  // pecked figures: each shape is many small light dots
  const peck = (path, density = 1) => {
    const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d'); o.fillStyle = '#fff'; path(o); o.fill();
    const d = o.getImageData(0, 0, W, H).data;
    g.fillStyle = 'rgba(232,226,214,0.92)';
    for (let i = 0; i < 60000 * density; i++) { const x = (x0 + r() * w) | 0, y = (y0 + r() * h) | 0; if (d[(y * W + x) * 4] > 128) { g.beginPath(); g.arc(x, y, 1.1 + r() * 1.5, 0, Math.PI * 2); g.fill(); } }
  };
  const stick = (o, pts, wdt) => { o.beginPath(); o.moveTo(...pts[0]); for (const p of pts.slice(1)) o.lineTo(...p); o.lineWidth = wdt; o.lineCap = 'round'; o.lineJoin = 'round'; o.strokeStyle = '#fff'; o.stroke(); };
  // the deer with branching antlers, and two hunters
  peck((o) => {
    o.beginPath(); o.ellipse(340, 380, 80, 26, -0.05, 0, Math.PI * 2); o.fill();
    stick(o, [[270, 390], [262, 450]], 10); stick(o, [[300, 395], [296, 452]], 10); stick(o, [[380, 395], [386, 452]], 10); stick(o, [[405, 388], [416, 448]], 10);
    stick(o, [[410, 368], [440, 320], [458, 312]], 12); o.beginPath(); o.ellipse(462, 314, 20, 10, -0.3, 0, Math.PI * 2); o.fill();
    stick(o, [[448, 304], [430, 250], [412, 214]], 6); stick(o, [[436, 266], [460, 236]], 5); stick(o, [[424, 236], [394, 222]], 5); stick(o, [[464, 302], [486, 240], [500, 206]], 6); stick(o, [[480, 256], [508, 246]], 5); stick(o, [[492, 226], [470, 200]], 5);
    stick(o, [[262, 372], [246, 360]], 6);
    // hunters: stick men with a round head, raised spear
    for (const [hx, hy, s] of [[150, 300, 1], [180, 520, 0.9]]) {
      o.beginPath(); o.arc(hx, hy - 70 * s, 12 * s, 0, Math.PI * 2); o.fill();
      stick(o, [[hx, hy - 58 * s], [hx, hy]], 8 * s); stick(o, [[hx, hy], [hx - 24 * s, hy + 50 * s]], 7 * s); stick(o, [[hx, hy], [hx + 24 * s, hy + 50 * s]], 7 * s);
      stick(o, [[hx - 34 * s, hy - 52 * s], [hx, hy - 40 * s], [hx + 30 * s, hy - 60 * s]], 6 * s); stick(o, [[hx + 30 * s, hy - 110 * s], [hx + 36 * s, hy - 10 * s]], 4 * s);
    }
    // a little hut and a running dog
    stick(o, [[460, 560], [520, 520], [580, 560], [460, 560]], 7); stick(o, [[480, 560], [480, 610], [560, 610], [560, 560]], 7);
    o.beginPath(); o.ellipse(300, 600, 40, 12, 0, 0, Math.PI * 2); o.fill(); stick(o, [[270, 606], [255, 636]], 6); stick(o, [[330, 606], [345, 636]], 6); stick(o, [[338, 594], [354, 576]], 7); stick(o, [[262, 596], [240, 586]], 5);
  });
  // the Camunian rose, small, in the corner: four lobes around nine cup marks
  peck((o) => {
    const cx = 160, cy = 160, s = 44;
    o.save(); o.translate(cx, cy);
    for (let i = 0; i < 4; i++) { o.rotate(Math.PI / 2); o.beginPath(); o.moveTo(-s * 0.25, -s * 0.25); o.bezierCurveTo(-s * 0.6, -s * 1.1, s * 0.6, -s * 1.1, s * 0.25, -s * 0.25); o.lineWidth = 9; o.strokeStyle = '#fff'; o.stroke(); }
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { o.beginPath(); o.arc(i * s * 0.62, j * s * 0.62, 6, 0, Math.PI * 2); o.fill(); }
    o.restore();
  }, 0.5);
  // rubbing edge: uneven graphite margin
  g.strokeStyle = '#F4EEE0'; g.lineWidth = 18; for (let i = 0; i < 200; i++) { const t = r(); const side = (r() * 4) | 0; const x = side < 2 ? x0 + t * w : (side === 2 ? x0 : x0 + w), y = side >= 2 ? y0 + t * h : (side === 0 ? y0 : y0 + h); g.beginPath(); g.arc(x, y, 4 + r() * 10, 0, Math.PI * 2); g.fillStyle = '#F4EEE0'; g.fill(); }
  // caption in pencil
  text(g, 'Calco · incisioni rupestri, Valle Camonica', W / 2, H - 100, 'italic 26px Georgia, serif', '#555049');
  text(g, 'Darfo', W / 2, H - 62, '600 30px Caveat, cursive', '#555049');
  return c;
}

export function modicaEtching() {
  const W = 700, H = 900;
  const [c, g] = cv(W, H);
  const r = rng(1693); // the earthquake after which the town was rebuilt baroque
  g.fillStyle = '#F4EEE0'; g.fillRect(0, 0, W, H);
  const x0 = 70, y0 = 70, w = W - 140, h = H - 220;
  // plate mark and warm sepia paper
  g.fillStyle = '#EFE2C6'; g.fillRect(x0 - 12, y0 - 12, w + 24, h + 24); pen(g, 2, 'rgba(120,90,50,0.35)'); g.strokeRect(x0 - 12, y0 - 12, w + 24, h + 24);
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  const S = '#3A2A1C';
  // sky: horizontal etched lines, thinning upwards
  for (let y = y0; y < y0 + 260; y += 6) { g.globalAlpha = 0.15 + (y - y0) / 260 * 0.35; pen(g, 0.9, S); g.beginPath(); g.moveTo(x0, y + r()); g.lineTo(x0 + w, y + r()); g.stroke(); }
  g.globalAlpha = 1;
  // the hillside of houses, stacked; drawn back to front
  const house = (x, y, hw, hh) => {
    g.beginPath(); g.rect(x, y, hw, hh); g.fillStyle = '#EFE2C6'; g.fill(); pen(g, 1.4, S); g.stroke();
    g.beginPath(); g.rect(x, y, hw, hh); hatch(g, x, y, x + hw * 0.4, y + hh, 4, Math.PI / 2 - 0.05, 0.8, S, r);
    for (let i = 0; i < Math.floor(hw / 16); i++) { g.fillStyle = S; g.fillRect(x + 6 + i * 16, y + 8, 5, 9); }
    poly(g, [[x - 2, y], [x + hw / 2, y - 7], [x + hw + 2, y]]); g.fillStyle = '#E3C9A0'; g.fill(); pen(g, 1.2, S); g.stroke();
  };
  for (let row = 0; row < 10; row++) {
    const y = y0 + 280 + row * 38;
    for (let x = x0 - 20; x < x0 + w; ) { const hw = 30 + r() * 46; if (!(row < 6 && Math.abs(x + hw / 2 - (x0 + w / 2)) < 120 + row * 10)) house(x, y + (r() - 0.5) * 12, hw, 34 + r() * 10); x += hw + 2; }
  }
  // the staircase climbing to the church
  const cx = x0 + w / 2;
  for (let i = 0; i < 26; i++) { const y = y0 + 470 + i * 9, ww = 70 + i * 6; pen(g, 1, S); g.beginPath(); g.moveTo(cx - ww / 2, y); g.lineTo(cx + ww / 2, y); g.stroke(); }
  pen(g, 1.4, S); g.beginPath(); g.moveTo(cx - 35, y0 + 470); g.lineTo(cx - 113, y0 + 705); g.moveTo(cx + 35, y0 + 470); g.lineTo(cx + 113, y0 + 705); g.stroke();
  // the baroque façade: three tiers, columns, the belfry crown
  const tier = (y, tw, th) => {
    g.beginPath(); g.rect(cx - tw / 2, y - th, tw, th); g.fillStyle = '#F2E6CC'; g.fill(); pen(g, 1.8, S); g.stroke();
    for (let i = 0; i <= 4; i++) { const xx = cx - tw / 2 + 6 + i * (tw - 12) / 4; g.beginPath(); g.rect(xx - 4, y - th + 8, 8, th - 14); g.fillStyle = '#F7EEDA'; g.fill(); pen(g, 1, S); g.stroke(); hatch(g, xx - 4, y - th, xx + 4, y, 2.6, Math.PI / 2, 0.6, S, r); }
    pen(g, 2.2, S); g.beginPath(); g.moveTo(cx - tw / 2 - 6, y - th); g.lineTo(cx + tw / 2 + 6, y - th); g.stroke();
  };
  tier(y0 + 470, 150, 92); tier(y0 + 378, 110, 72); tier(y0 + 306, 76, 58);
  // door + windows
  g.beginPath(); g.moveTo(cx - 14, y0 + 470); g.lineTo(cx - 14, y0 + 430); g.arc(cx, y0 + 430, 14, Math.PI, 0); g.lineTo(cx + 14, y0 + 470); g.fillStyle = S; g.fill();
  g.beginPath(); g.arc(cx, y0 + 345, 10, 0, Math.PI * 2); g.fillStyle = S; g.fill();
  // belfry: the open arch, the little dome and cross
  g.beginPath(); g.rect(cx - 22, y0 + 248, 44, 0); g.stroke();
  g.beginPath(); g.moveTo(cx - 20, y0 + 248); g.lineTo(cx - 20, y0 + 222); g.arc(cx, y0 + 222, 20, Math.PI, 0); g.lineTo(cx + 20, y0 + 248); g.fillStyle = '#F2E6CC'; g.fill(); pen(g, 1.6, S); g.stroke();
  g.beginPath(); g.arc(cx, y0 + 230, 8, Math.PI, 0); g.lineTo(cx + 8, y0 + 244); g.lineTo(cx - 8, y0 + 244); g.closePath(); g.fillStyle = S; g.fill();
  g.beginPath(); g.ellipse(cx, y0 + 200, 16, 8, 0, Math.PI, 0); g.fillStyle = '#E3C9A0'; g.fill(); pen(g, 1.4, S); g.stroke();
  pen(g, 2, S); g.beginPath(); g.moveTo(cx, y0 + 192); g.lineTo(cx, y0 + 168); g.moveTo(cx - 7, y0 + 178); g.lineTo(cx + 7, y0 + 178); g.stroke();
  // swallows
  for (let i = 0; i < 5; i++) { const sx = x0 + 60 + r() * (w - 120), sy = y0 + 40 + r() * 120; pen(g, 1.6, S); g.beginPath(); g.moveTo(sx - 9, sy - 3); g.quadraticCurveTo(sx - 3, sy - 4, sx, sy + 2); g.quadraticCurveTo(sx + 3, sy - 4, sx + 9, sy - 3); g.stroke(); }
  g.restore();
  text(g, 'Modica · San Giorgio, dalla scalinata', W / 2, H - 100, 'italic 26px Georgia, serif', '#555049');
  text(g, 'acquaforte, 2/30', W / 2, H - 62, '600 30px Caveat, cursive', '#555049');
  return c;
}

// --- 6 · Il cestino delle bozze: the bin's weave, and the one draft flattened out again ------------
export function wicker() {
  const W = 1024, H = 384; const [c, g] = cv(W, H); const r = rng(21);
  g.fillStyle = '#B98A50'; g.fillRect(0, 0, W, H);
  const rowH = 16, colW = 32;
  for (let y = 0; y < H; y += rowH) for (let x = 0; x < W; x += colW) {
    const off = ((y / rowH) % 2) * colW / 2;
    const gx = (x + off) % W;
    const grd = g.createLinearGradient(gx, 0, gx + colW, 0); grd.addColorStop(0, '#8A5E2E'); grd.addColorStop(0.5, '#D7A866'); grd.addColorStop(1, '#8A5E2E');
    g.fillStyle = grd; g.beginPath(); g.ellipse(gx + colW / 2, y + rowH / 2, colW / 2 - 1, rowH / 2 - 1, 0, 0, Math.PI * 2); g.fill(); pen(g, 1.2, 'rgba(26,23,20,0.8)'); g.stroke();
  }
  // vertical stakes peeking through
  for (let x = 0; x < W; x += colW) { g.fillStyle = 'rgba(70,40,20,0.5)'; g.fillRect(x + (colW - 4) / 2, 0, 4, H); }
  return c;
}
export function draftSheet() {
  const W = 600, H = 800; const [c, g] = cv(W, H); const r = rng(22);
  g.fillStyle = '#F8F4EA'; g.fillRect(0, 0, W, H);
  // crease shading
  for (let i = 0; i < 16; i++) { const x = r() * W, y = r() * H, a = r() * Math.PI; g.strokeStyle = `rgba(90,70,50,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x - Math.cos(a) * 400, y - Math.sin(a) * 400); g.lineTo(x + Math.cos(a) * 400, y + Math.sin(a) * 400); g.stroke(); }
  const F = '500 25px "Courier Prime", "Courier New", monospace';
  const lines = ['Carissimi amici e parenti,', '', 'con immensa gioia vi annun-', 'ciamo che il giorno', '29 maggio 2027 ci sposeremo', 'nella splendida cornice di', '', 'Cari tutti,', 'indovinate un po\'?', '', 'Ciao! Allora: ci sposiamo.'];
  lines.forEach((l, i) => text(g, l, 50, 80 + i * 40, F, '#2A2622', 'left'));
  pen(g, 3, '#2A2622');
  for (const y of [80, 160, 200, 240, 280]) { g.beginPath(); g.moveTo(44, y); g.lineTo(420, y + (r() - 0.5) * 6); g.stroke(); }
  for (const y of [360, 400]) { for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(44, y - 10 + k * 10); for (let x = 44; x < 330; x += 14) g.lineTo(x, y - 12 + k * 10 + (x / 14 % 2) * 12); g.stroke(); } }
  text(g, 'questa va bene!', 360, 560, '700 40px Caveat, cursive', '#C23B22', 'center', -0.12);
  pen(g, 3, '#C23B22'); g.beginPath(); g.moveTo(320, 500); g.quadraticCurveTo(300, 470, 330, 470); g.stroke();
  return c;
}

// --- 7 · Il tappeto: a frazzata, woven from rag strips: bands of colour, each pick a little twisted --
// W across the rug, H along it (the bands run across, the borders are at the two fringed ends)
export function frazzata(W = 1400, H = 2000) {
  const [c, g] = cv(W, H); const r = rng(1973);
  g.fillStyle = '#EDE3CF'; g.fillRect(0, 0, W, H);
  const pal = ['#C23B22', '#2C5C9A', '#E9B634', '#3F8A4A', '#F2EADA', '#7A2A4A', '#D9733A', '#1F2A44'];
  // weft picks run across the width; bands of 6..40 picks; borders denser and darker
  const pick = 9;
  let y = 0, band = 0;
  const plan = [];
  while (y < H) { const n = 4 + ((r() * 30) | 0); const col = pal[(r() * pal.length) | 0]; const mix = r() > 0.6 ? pal[(r() * pal.length) | 0] : null; plan.push([y, n, col, mix]); y += n * pick; band++; }
  // a fixed border scheme at both ends
  const border = ['#1F2A44', '#F2EADA', '#C23B22', '#C23B22', '#F2EADA', '#1F2A44', '#E9B634', '#1F2A44'];
  const drawPick = (yy, col) => {
    for (let x = 0; x < W; x += 14) {
      const l = 10 + r() * 6;
      g.fillStyle = col; g.beginPath(); g.ellipse(x + 7, yy + pick / 2, l / 2 + 1, pick / 2 - 0.5, (r() - 0.5) * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.16})`; g.beginPath(); g.ellipse(x + 9, yy + pick / 2 + 1.5, l / 3, pick / 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,255,255,${r() * 0.18})`; g.beginPath(); g.ellipse(x + 5, yy + pick / 2 - 1.5, l / 4, pick / 6, 0, 0, Math.PI * 2); g.fill();
    }
  };
  let yy = 0;
  for (const b of border) for (let k = 0; k < 5; k++, yy += pick) drawPick(yy, b);
  const endTop = yy;
  let ye = H;
  for (const b of border) for (let k = 0; k < 5; k++) { ye -= pick; drawPick(ye, b); }
  for (const [y0, n, col, mix] of plan) for (let k = 0; k < n; k++) { const py = y0 + k * pick + endTop; if (py >= ye - pick) break; drawPick(py, mix && k % 2 ? mix : col); }
  // the white warp threads showing at the edges
  g.fillStyle = 'rgba(242,234,218,0.9)'; for (const x of [0, W - 10]) g.fillRect(x, 0, 10, H);
  return c;
}
