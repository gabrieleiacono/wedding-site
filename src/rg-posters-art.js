// Six Roland-Garros posters, redrawn by hand in canvas for the room (keepsakes.js hangs them): our own
// sketches after the originals, not reproductions. Each is drawn on its white mount, ready for the frame.
//   1980 Valerio Adami · 1981 Eduardo Arroyo · 1982 Jean-Michel Folon · 1984 Gilles Aillaud
//   1991 Joan Miró · 2025 Marc-Antoine Mathieu
// Every function returns a canvas; the lettering uses the page's fonts (Caveat, Archivo), so keepsakes.js
// draws them again once the fonts have loaded.

import { rng } from './keepsakes-art.js';

const INK = '#16130F';
const MOUNT = '#F6F1E6';
const HAND = (px, w = 500) => `${w} ${px}px Caveat, "Segoe Print", cursive`;
const SANS = (px, w = 400) => `${w} ${px}px "Archivo Narrow", "Arial Narrow", sans-serif`;

/** A canvas with its white mount; returns the drawing area inside it. */
function mounted(W, H, m = 0.075) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = MOUNT; g.fillRect(0, 0, W, H);
  const b = Math.round(W * m);
  return { c, g, x: b, y: b, w: W - 2 * b, h: H - 2 * b };
}
/** The bevel of the mount's window, a hairline of shadow round the print. */
function bevel({ g, x, y, w, h }) {
  g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 3; g.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.strokeRect(x - 5, y - 5, w + 10, h + 10);
}
function text(g, s, x, y, font, fill = INK, align = 'center', rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.font = font; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
}
/** A wobbly hand-drawn line through the points. */
function line(g, pts, w, col = INK, r = Math.random, wob = 1.5) {
  g.strokeStyle = col; g.lineWidth = w; g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px + (r() - 0.5) * wob, py + (r() - 0.5) * wob) : g.moveTo(px, py)));
  g.stroke();
}

// --- 1980 · Valerio Adami: the first poster. A hand tossing the ball, the racket's strings, on blue --------
export function adami1980() {
  const P = mounted(1000, 1400), { g, x, y, w, h } = P, r = rng(1980);
  g.fillStyle = '#1C79E4'; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); // everything stays on the print
  text(g, '1980', x + w / 2, y + h * 0.16, HAND(150, 500), INK);
  const cx = x + w * 0.47, cy = y + h * 0.6;
  // the racket head, seen from the side, its strings a diamond net
  g.save(); g.translate(cx + 150, cy + 220); g.rotate(0.42);
  g.beginPath(); g.ellipse(0, 0, 170, 105, 0, 0, Math.PI * 2);
  g.save(); g.clip(); g.strokeStyle = INK; g.lineWidth = 2.2;
  for (let i = -26; i < 27; i++) { g.beginPath(); g.moveTo(i * 14 - 180, -120); g.lineTo(i * 14 + 180, 120); g.stroke(); g.beginPath(); g.moveTo(i * 14 + 180, -120); g.lineTo(i * 14 - 180, 120); g.stroke(); }
  g.restore(); g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 170, 105, 0, 0, Math.PI * 2); g.stroke(); // the frame
  line(g, [[-150, 60], [-250, 130]], 6); line(g, [[-130, 80], [-235, 150]], 6); // the throat, toward the hand
  g.restore();
  // the ball, deep red, with its seam
  g.fillStyle = '#A3203A'; g.beginPath(); g.arc(cx + 20, cy - 40, 118, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  g.strokeStyle = 'rgba(255,240,240,0.55)'; g.lineWidth = 4; g.beginPath(); g.arc(cx - 50, cy - 80, 110, -0.2, 1.3); g.stroke();
  // the hand cupping it from below, flat black outlines in Adami's way: four fingers round the ball's
  // left side, the thumb across the front, the palm and the wrist running down out of the picture
  const bx = cx + 20, by = cy - 40;
  g.strokeStyle = INK; g.lineWidth = 6;
  for (let k = 0; k < 4; k++) {
    const R0 = 118 + 4, a0 = 2.05 + k * 0.34, a1 = a0 + 0.3; // each finger: a band hugging the ball
    g.beginPath(); g.arc(bx, by, R0, a0, a1); g.arc(bx, by, R0 + 34, a1, a0, true); g.closePath(); g.stroke();
  }
  g.beginPath(); g.moveTo(bx + 60, by + 104); g.quadraticCurveTo(bx + 10, by + 60, bx - 70, by + 70); g.stroke(); // the thumb
  g.beginPath(); g.moveTo(bx - 150, by + 30); g.quadraticCurveTo(bx - 120, by + 190, bx - 10, by + 200); g.quadraticCurveTo(bx + 80, by + 190, bx + 100, by + 90); g.stroke(); // the palm
  line(g, [[bx - 60, by + 196], [bx - 40, y + h * 0.86]], 6); line(g, [[bx + 40, by + 196], [bx + 60, y + h * 0.86]], 6); // the wrist
  for (let k = 0; k < 5; k++) line(g, [[bx - 330, by - 70 + k * 16], [bx - 190, by - 40 + k * 14]], 3, INK, r, 0); // the toss, rising
  g.restore();
  text(g, 'roland', x + 34, y + h * 0.93, HAND(110, 500), INK, 'left');
  text(g, 'Garros', x + w - 34, y + h * 0.93, HAND(110, 500), INK, 'right');
  bevel(P); return P.c;
}

// --- 1981 · Eduardo Arroyo: Borg from behind, a scribble of hair under a blue-white-red headband ------------
export function arroyo1981() {
  const P = mounted(1000, 1400), { g, x, y, w, h } = P, r = rng(1981);
  g.fillStyle = '#F4D7AE'; g.fillRect(x, y, w, h);
  text(g, 'Roland', x + w / 2, y + h * 0.1, HAND(130, 500));
  text(g, 'Garros', x + w / 2, y + h * 0.2, HAND(130, 500));
  const cx = x + w / 2, cy = y + h * 0.55;
  // the shoulders, one line
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy + h * 0.42, w * 0.47, h * 0.3, 0, Math.PI + 0.12, 2 * Math.PI - 0.12); g.stroke();
  // the hair: a mass of orange loops
  g.fillStyle = '#EE7F2E'; g.beginPath(); g.ellipse(cx, cy, 250, 215, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 700; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    g.strokeStyle = ['#D4561A', '#F39A48', '#E46C22'][i % 3]; g.lineWidth = 4;
    g.beginPath(); g.ellipse(cx + Math.cos(a) * 250 * d, cy + Math.sin(a) * 215 * d, 14 + r() * 26, 9 + r() * 16, r() * 3, 0, Math.PI * 2); g.stroke();
  }
  // the headband
  const by = cy - 58, bw = 470;
  [['#1E2A6E', 0], ['#FBFAF6', 22], ['#C61E2C', 44]].forEach(([c, o]) => { g.fillStyle = c; g.fillRect(cx - bw / 2, by + o, bw, 22); });
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(cx - bw / 2, by, bw, 66);
  text(g, '1981', x + w / 2, y + h * 0.9, HAND(130, 500));
  bevel(P); return P.c;
}

// --- 1982 · Jean-Michel Folon: the court seen from the umpire's chair, a lone ball, a soft light ------------
export function folon1982() {
  const P = mounted(1000, 1400), { g, x, y, w, h } = P;
  const grd = g.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, '#B4533A'); grd.addColorStop(0.45, '#C8826A'); grd.addColorStop(0.55, '#C8826A'); grd.addColorStop(1, '#A9452C');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  const glow = g.createRadialGradient(x + w / 2, y + h * 0.5, 10, x + w / 2, y + h * 0.5, 260);
  glow.addColorStop(0, 'rgba(240,222,232,0.9)'); glow.addColorStop(1, 'rgba(240,222,232,0)');
  g.fillStyle = glow; g.fillRect(x, y, w, h);
  g.strokeStyle = '#F5EEE6'; g.lineWidth = 9;
  const L = x + 60, R = x + w - 60, T = y + h * 0.14, B = y + h * 0.87, sL = x + w * 0.3, sR = x + w * 0.7;
  g.strokeRect(L, T, R - L, B - T);
  g.lineWidth = 6; g.beginPath();
  g.moveTo(L + 45, T); g.lineTo(L + 45, B); g.moveTo(R - 45, T); g.lineTo(R - 45, B);
  g.moveTo(sL, T + 70); g.lineTo(sL, B - 70); g.moveTo(sR, T + 70); g.lineTo(sR, B - 70);
  g.moveTo(sL, T + 70); g.lineTo(sR, T + 70); g.moveTo(sL, B - 70); g.lineTo(sR, B - 70);
  g.stroke();
  g.fillStyle = '#EFE6D6'; g.beginPath(); g.arc(x + w / 2, y + h * 0.43, 30, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(150,120,90,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(x + w / 2 - 34, y + h * 0.43, 28, -0.9, 0.9); g.stroke();
  text(g, 'ROLAND GARROS', x + w / 2, y + h * 0.075, SANS(84, 400), '#F5EEE6');
  text(g, '1982', x + w / 2, y + h * 0.94, SANS(84, 400), '#F5EEE6');
  bevel(P); return P.c;
}

// --- 1984 · Gilles Aillaud: the stands as a crowd of dabs round a flat clay court ---------------------------
export function aillaud1984() {
  const P = mounted(1000, 1400), { g, x, y, w, h } = P, r = rng(1984);
  g.fillStyle = '#E68A3E'; g.fillRect(x, y, w, h);
  const cols = ['#5C2A18', '#F6E6CE', '#B83E26', '#2A2522', '#D45E30', '#FFFFFF', '#2E4486', '#E9B48A'];
  for (let i = 0; i < 9000; i++) {
    const py = y + h * 0.12 + Math.pow(r(), 0.8) * h * 0.88, d = (py - y) / h;
    g.globalAlpha = 0.45 + d * 0.55; g.fillStyle = cols[(r() * cols.length) | 0];
    g.beginPath(); g.ellipse(x + r() * w, py, 1.5 + d * 9, 1.2 + d * 6, r() * 3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#EA7632'; // the court, tilted away, empty but for two white specks
  g.beginPath(); g.moveTo(x + w * 0.26, y + h * 0.4); g.lineTo(x + w * 0.83, y + h * 0.38); g.lineTo(x + w * 0.76, y + h * 0.65); g.lineTo(x + w * 0.19, y + h * 0.67); g.closePath(); g.fill();
  g.fillStyle = '#FFFFFF'; g.fillRect(x + w * 0.55, y + h * 0.46, 5, 9); g.fillRect(x + w * 0.4, y + h * 0.58, 5, 9);
  g.fillStyle = '#E68A3E'; g.fillRect(x, y, w, h * 0.12);
  text(g, 'Roland Garros 84', x + 40, y + h * 0.065, HAND(110, 500), '#27346A', 'left', -0.02);
  bevel(P); return P.c;
}

// --- 1991 · Joan Miró: on white, a yellow sun, a red wedge, a knot of black, a blue head ---------------------
export function miro1991() {
  const P = mounted(1000, 1400), { g, x, y, w, h } = P, r = rng(1991);
  g.fillStyle = '#FCFBF7'; g.fillRect(x, y, w, h);
  text(g, 'ROLAND GARROS 1991', x + w / 2, y + h * 0.065, '400 66px "Times New Roman", Georgia, serif');
  const cx = x + w * 0.52;
  g.fillStyle = '#F1CF24'; g.beginPath(); g.arc(cx, y + h * 0.35, 118, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.arc(cx, y + h * 0.35, 80, 0, Math.PI * 2); g.lineWidth = 2.5; g.stroke(); // the ball's seam, loosely
  g.fillStyle = '#C9242A'; g.beginPath(); g.moveTo(cx - 45, y + h * 0.45); g.lineTo(cx + 115, y + h * 0.44); g.lineTo(cx + 60, y + h * 0.7); g.lineTo(cx + 12, y + h * 0.86); g.lineTo(cx - 20, y + h * 0.62); g.closePath(); g.fill();
  g.fillStyle = '#28509E'; g.beginPath(); g.ellipse(cx + 26, y + h * 0.17, 48, 62, 0.25, 0, Math.PI * 2); g.fill();
  g.save(); g.translate(x + w * 0.84, y + h * 0.2); g.rotate(-0.45); g.fillStyle = '#2E8A3A'; g.fillRect(0, 0, 80, 16); g.restore();
  for (let i = 0; i < 40; i++) { // the black knot, bottom left
    g.strokeStyle = INK; g.lineWidth = 4 + r() * 4; g.beginPath();
    g.ellipse(x + w * 0.27 + (r() - 0.5) * 60, y + h * 0.74 + (r() - 0.5) * 60, 40 + r() * 90, 26 + r() * 70, r() * 3, 0, Math.PI * 2); g.stroke();
  }
  g.lineWidth = 3.5; g.beginPath(); g.ellipse(cx + 14, y + h * 0.42, 250, 330, 0.15, 3.6, 7.4); g.stroke(); // the swing
  line(g, [[x + w * 0.16, y + h * 0.37], [x + w * 0.88, y + h * 0.3]], 3.5, INK, r);
  g.beginPath(); g.arc(x + w * 0.21, y + h * 0.52, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(x + w * 0.27, y + h * 0.51, 9, 0, 7); g.stroke();
  line(g, [[x + w * 0.21, y + h * 0.535], [x + w * 0.2, y + h * 0.58]], 3); line(g, [[x + w * 0.27, y + h * 0.52], [x + w * 0.28, y + h * 0.57]], 3);
  text(g, 'Miró', x + w * 0.86, y + h * 0.95, HAND(54, 500), INK, 'center', -0.1);
  bevel(P); return P.c;
}

// --- 2025 · Marc-Antoine Mathieu: a comic page cut from a court plan, morning sun to night --------------------
export function mathieu2025() {
  const P = mounted(1000, 1250, 0.06), { g, x, y, w, h } = P;
  g.fillStyle = '#FFFFFF'; g.fillRect(x, y, w, h);
  const ih = h - 110; g.fillStyle = '#121212'; g.fillRect(x, y, w, ih);
  const gap = 12, cols = [0.15, 0.7, 0.15].map((f) => f * w), rows = [0.24, 0.27, 0.27, 0.22].map((f) => f * ih);
  const sky = ['#3A8DDB', '#2267B4', '#174784', '#0D2950'], clay = '#C7643A';
  let yy = y;
  rows.forEach((rh, ri) => {
    let xx = x;
    cols.forEach((cw, ci) => {
      const px = xx + gap / 2, py = yy + gap / 2, pw = cw - gap, ph = rh - gap, big = ci === 1;
      g.fillStyle = (ri + ci) % 2 ? clay : sky[ri]; g.fillRect(px, py, pw, ph);
      g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip();
      if (big) {
        if (ri % 2 === 0) { g.fillStyle = clay; g.fillRect(px, py + ph * 0.64, pw, ph * 0.36); }
        else { g.fillStyle = sky[ri]; g.fillRect(px, py, pw, ph * 0.3); }
        const day = ri < 2;
        g.fillStyle = day ? '#F6CB2A' : '#F4E7A6'; g.beginPath(); g.arc(px + pw * (0.22 + ri * 0.16), py + ph * 0.24, day ? 34 : 18, 0, Math.PI * 2); g.fill();
        if (!day) { g.fillStyle = sky[ri]; g.beginPath(); g.arc(px + pw * (0.22 + ri * 0.16) + 8, py + ph * 0.24 - 5, 15, 0, Math.PI * 2); g.fill(); } // a crescent
        // a player, black silhouette: body, head, the racket
        const sx = px + pw * (ri % 2 ? 0.34 : 0.66), sy = py + ph * 0.62, s = ri % 2 ? -1 : 1;
        g.fillStyle = '#121212';
        g.beginPath(); g.ellipse(sx, sy, 30, 62, 0.25 * s, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(sx - 6 * s, sy - 84, 22, 0, Math.PI * 2); g.fill();
        g.lineWidth = 9; g.strokeStyle = '#121212'; g.beginPath(); g.moveTo(sx + 18 * s, sy - 30); g.lineTo(sx + 70 * s, sy - 82); g.stroke();
        g.beginPath(); g.ellipse(sx + 88 * s, sy - 104, 18, 26, -0.7 * s, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#E8F24A'; g.beginPath(); g.arc(sx + 150 * s, sy - 120 + ri * 6, 9, 0, Math.PI * 2); g.fill(); // the ball
      }
      g.strokeStyle = '#F2F2F2'; g.lineWidth = 5; g.beginPath(); // the court's white lines run through the panels
      if (!big) { g.moveTo(px + pw * (ci ? 0.3 : 0.7), py); g.lineTo(px + pw * (ci ? 0.3 : 0.7), py + ph); }
      else if (ri === 3 || ri === 0) { g.moveTo(px + pw / 2, py + (ri ? 0 : ph * 0.64)); g.lineTo(px + pw / 2, py + ph); }
      g.stroke(); g.restore();
      xx += cw;
    });
    yy += rh;
  });
  text(g, 'ROLAND-GARROS 2025', x + w / 2, y + h - 52, '700 74px "Archivo Narrow", "Arial Narrow", sans-serif', '#121212');
  return P.c;
}
