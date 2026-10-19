// The living window (design F11): a 2.5D ink diorama behind the window, in depth layers —
// sky, far hills, brick viaduct with trains, near hills with cypresses and a farmhouse,
// the paddock with two donkeys, two foals and a rooster, and swallows in the air.
// Everything is drawn with Canvas2D in the same pen-and-wash style, and pauses when you look away.
import * as THREE from 'three';
import { EYE } from './room.js';

const INK = '#1A1714';
const TAN_H = Math.tan(THREE.MathUtils.degToRad(58)), TAN_UP = Math.tan(THREE.MathUtils.degToRad(52)), TAN_DN = Math.tan(THREE.MathUtils.degToRad(22));
const CW = 1536, CHt = 900;
const LOOP = 600; // seconds: the sun sinks over ~9 minutes, then quietly comes back

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A canvas laid out on a vertical plane `d` metres in front of the eye, drawn in metres. */
class Layer {
  constructor(scene, d, name, opts = {}) {
    this.d = d; this.name = name;
    this.canvas = document.createElement('canvas'); this.canvas.width = opts.w ?? CW; this.canvas.height = opts.h ?? CHt;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.wM = 2 * d * TAN_H; this.hM = d * (TAN_UP + TAN_DN);
    this.k = this.canvas.width / this.wM; // px per metre
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.wM, this.hM),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    this.mesh.position.set(EYE.x, EYE.y + d * (TAN_UP - TAN_DN) / 2, EYE.z - d);
    this.mesh.renderOrder = -10 + (opts.order ?? 0);
    this.mesh.layers.set(1);
    scene.add(this.mesh);
  }
  // metres (x across, y up from eye level) → canvas px
  X(x) { return (x + this.wM / 2) * this.k; }
  Y(y) { return (this.d * TAN_UP - y) * this.k; }
  /** angle helpers, in degrees from straight ahead */
  ax(deg) { return this.d * Math.tan(THREE.MathUtils.degToRad(deg)); }
  clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}

// --- ink helpers ------------------------------------------------------------
function wobble(ctx, pts, closed, j = 1.2, seed = 1) {
  const r = rng(seed);
  ctx.beginPath();
  pts.forEach(([x, y], i) => { const dx = (r() - 0.5) * j, dy = (r() - 0.5) * j; i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy); });
  if (closed) ctx.closePath();
}
function inkStroke(ctx, w = 2, a = 1) { ctx.strokeStyle = INK; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.globalAlpha = 1; }
function wash(ctx, color, a = 0.7) { ctx.fillStyle = color; ctx.globalAlpha = a; ctx.fill(); ctx.globalAlpha = 1; }
/** hatch the current path with parallel lines (keeps the path as the clip while drawing) */
function hatch(ctx, bounds, angle, spacing, w = 0.8, a = 0.7, seed = 3) {
  const [x0, y0, x1, y1] = bounds;
  ctx.save(); ctx.clip();
  const r = rng(seed);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
  const c = Math.cos(angle), s = Math.sin(angle);
  ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.globalAlpha = a; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let t = -R; t < R; t += spacing) {
    const jx = (r() - 0.5) * 1.5;
    const ax = cx + -s * (t + jx) - c * R, ay = cy + c * (t + jx) - s * R;
    const bx = cx + -s * (t + jx) + c * R * (0.7 + r() * 0.3), by = cy + c * (t + jx) + s * R * (0.7 + r() * 0.3);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  }
  ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
}
function ridge(layer, base, amp, seed, step = 14) {
  const r = rng(seed), pts = [];
  let a = r() * 10, b = r() * 10;
  for (let x = 0; x <= layer.canvas.width + step; x += step) {
    const t = x / layer.canvas.width;
    const y = base - (Math.sin(t * 5.3 + a) * 0.5 + Math.sin(t * 11.7 + b) * 0.25 + Math.sin(t * 2.1 + a * 2) * 0.6) * amp;
    pts.push([x, y]);
  }
  return pts;
}

export class LivingWindow {
  constructor(scene, audio) {
    this.audio = audio;
    this.active = true;
    this.t0 = performance.now();
    this.sky = new Layer(scene, 900, 'sky', { order: 0, w: 768, h: 450 });
    this.far = new Layer(scene, 600, 'far', { order: 1 });
    this.via = new Layer(scene, 180, 'viaduct', { order: 2 });
    this.trainLayer = new Layer(scene, 179, 'train', { order: 3, w: 1024, h: 600 });
    this.near = new Layer(scene, 60, 'near', { order: 4 });
    this.smoke = new Layer(scene, 59.5, 'smoke', { order: 5, w: 1024, h: 600 });
    this.pad = new Layer(scene, 14, 'paddock', { order: 6 });
    this.air = new Layer(scene, 6, 'air', { order: 7, w: 1024, h: 600 });
    this.padStatic = document.createElement('canvas'); this.padStatic.width = CW; this.padStatic.height = CHt;
    this.drawFar(); this.drawViaduct(); this.drawNear(); this.drawPaddockStatic();
    this.animals = this.makeAnimals();
    this.trains = []; this.nextTrain = performance.now() + 6000;
    this.swallows = []; this.nextSwallow = performance.now() + 3000;
    this.perched = [0.1, 0.16, 0.6].map((u) => ({ u, away: 0 }));
    this.lastAnim = 0; this.lastSky = -1e9;
    this.leaning = false;
    this.nextCrow = performance.now() + 2500;
  }

  // 0 = hero light (~20 min before sunset), 1 = blue hour
  get dusk() {
    const t = ((performance.now() - this.t0) / 1000) % LOOP;
    const sink = LOOP * 0.9;
    return t < sink ? t / sink : 1 - (t - sink) / (LOOP - sink);
  }
  sunElevation() { return 7 - this.dusk * 9.5; }

  // --- static layers -----------------------------------------------------
  drawSky(dusk) {
    const L = this.sky, c = L.ctx, w = L.canvas.width, h = L.canvas.height;
    const hz = L.Y(0);
    const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
    const g = c.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, mix('#B9A6C8', '#4A4A6A', dusk));
    g.addColorStop(0.55, mix('#E58C8A', '#9C8AB4', dusk));
    g.addColorStop(1, mix('#F4B183', '#E58C8A', dusk));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // paper grain + light horizontal hatching at the top of the sky
    c.save(); c.beginPath(); c.rect(0, 0, w, hz * 0.4); hatch(c, [0, 0, w, hz * 0.4], 0.02, 5, 0.6, 0.18 + dusk * 0.2, 11); c.restore();
    // the sun
    const el = this.sunElevation();
    const sx = L.X(L.ax(14)), sy = L.Y(L.ax(el)), sr = L.ax(1.3) * L.k;
    const halo = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 6);
    halo.addColorStop(0, `rgba(255,226,160,${0.75 - dusk * 0.5})`); halo.addColorStop(1, 'rgba(255,226,160,0)');
    c.fillStyle = halo; c.fillRect(0, 0, w, h);
    c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2);
    wash(c, '#FFE2A0', 0.95 - dusk * 0.3); inkStroke(c, 1.5, 0.8);
    // drifting clouds
    const t = (performance.now() - this.t0) / 1000;
    const r = rng(42);
    for (let i = 0; i < 7; i++) {
      const cx = ((r() * w + t * (2 + r() * 3)) % (w + 300)) - 150, cy = hz * (0.25 + r() * 0.55), cwid = 70 + r() * 110;
      c.beginPath();
      const n = 5 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) { const bx = cx - cwid / 2 + (k / (n - 1)) * cwid, br = cwid / n * (0.8 + r() * 0.6); c.moveTo(bx + br, cy); c.arc(bx, cy, br, Math.PI, 0); }
      c.moveTo(cx - cwid / 2 - 10, cy); c.lineTo(cx + cwid / 2 + 10, cy);
      wash(c, dusk > 0.5 ? '#9C8AB4' : '#F7D6C0', 0.55); inkStroke(c, 1, 0.55);
    }
    L.tex.needsUpdate = true;
  }
  drawFar() {
    const L = this.far, c = L.ctx; L.clear();
    for (const [base, amp, col, seed, a] of [[L.Y(L.ax(3.2)), L.k * L.ax(1.6), '#B9A6C8', 1, 0.75], [L.Y(L.ax(1.8)), L.k * L.ax(1.2), '#9C8AB4', 2, 0.85]]) {
      const pts = ridge(L, base, amp, seed, 10);
      const poly = [...pts, [L.canvas.width, L.canvas.height], [0, L.canvas.height]];
      wobble(c, poly, true, 1, seed); wash(c, col, a);
      wobble(c, poly, true, 1, seed); hatch(c, [0, base - amp * 2, L.canvas.width, L.canvas.height], -0.5, 7, 0.6, 0.25, seed);
      wobble(c, pts, false, 1, seed); inkStroke(c, 1.2, 0.7);
    }
    L.tex.needsUpdate = true;
  }
  drawViaduct() {
    const L = this.via, c = L.ctx; L.clear();
    const deck = L.Y(L.ax(0.6)), foot = L.Y(L.ax(-5.5));
    const x0 = L.X(-L.ax(52)), x1 = L.X(L.ax(52));
    this.deckY = L.ax(0.6);
    // valley haze under the viaduct
    c.fillStyle = 'rgba(229,140,138,0.25)'; c.fillRect(0, deck, L.canvas.width, foot - deck);
    // brick viaduct: deck + arches
    const span = L.k * 14, pier = L.k * 3.2;
    c.beginPath(); c.rect(x0, deck, x1 - x0, L.k * 2.2);
    wash(c, '#B5624A', 0.9); inkStroke(c, 1.6);
    for (let x = x0; x < x1; x += span) {
      c.beginPath();
      c.moveTo(x, deck + L.k * 2.2); c.lineTo(x, foot); c.lineTo(x + pier, foot); c.lineTo(x + pier, deck + L.k * 2.2 + span * 0.5);
      c.moveTo(x + span, deck + L.k * 2.2);
      c.rect(x, deck + L.k * 2.2, pier, foot - deck - L.k * 2.2);
      wash(c, '#A85A42', 0.9);
      // arch spandrel
      c.beginPath(); c.moveTo(x + pier, deck + L.k * 2.2); c.lineTo(x + span, deck + L.k * 2.2);
      c.lineTo(x + span, deck + L.k * 2.2 + span * 0.35);
      c.arc(x + pier + (span - pier) / 2, deck + L.k * 2.2 + span * 0.35, (span - pier) / 2, 0, Math.PI, true);
      c.closePath(); wash(c, '#B5624A', 0.9); inkStroke(c, 1.1, 0.85);
      c.beginPath(); c.rect(x, deck + L.k * 2.2, pier, foot - deck - L.k * 2.2);
      hatch(c, [x, deck, x + pier, foot], 1.2, 3, 0.6, 0.55, x); c.beginPath(); c.rect(x, deck + L.k * 2.2, pier, foot - deck - L.k * 2.2); inkStroke(c, 1.1, 0.85);
    }
    // overhead line masts on the deck
    for (let x = x0 + span * 0.3; x < x1; x += span * 2) {
      c.beginPath(); c.moveTo(x, deck); c.lineTo(x, deck - L.k * 6); c.lineTo(x + L.k * 2.5, deck - L.k * 6); inkStroke(c, 1, 0.8);
    }
    c.beginPath(); c.moveTo(x0, deck - L.k * 5.6); c.lineTo(x1, deck - L.k * 5.6); inkStroke(c, 0.6, 0.6);
    L.tex.needsUpdate = true;
  }
  drawNear() {
    const L = this.near, c = L.ctx; L.clear();
    const r = rng(7);
    const base = L.Y(L.ax(-0.8)), amp = L.k * L.ax(1.6);
    const pts = ridge(L, base, amp, 5, 12);
    const poly = [...pts, [L.canvas.width, L.canvas.height], [0, L.canvas.height]];
    wobble(c, poly, true, 1, 5); wash(c, '#C9A44C', 0.75);
    // vineyard rows in the last light
    wobble(c, poly, true, 1, 5);
    c.save(); c.clip();
    for (let i = 0; i < 26; i++) {
      const y = base - amp * 0.4 + i * L.k * 1.6;
      c.beginPath(); c.moveTo(0, y); for (let x = 0; x < L.canvas.width; x += 24) c.lineTo(x, y + Math.sin(x * 0.004 + i) * 6 + (r() - 0.5) * 1.4);
      inkStroke(c, 0.9, 0.55);
      c.fillStyle = '#5E8A4A'; c.globalAlpha = 0.5;
      for (let x = (i % 2) * 9; x < L.canvas.width; x += 18) c.fillRect(x, y + Math.sin(x * 0.004 + i) * 6 - 3, 5, 3);
      c.globalAlpha = 1;
    }
    c.restore();
    wobble(c, poly, true, 1, 5); hatch(c, [0, base - amp * 2, L.canvas.width, L.canvas.height], -0.7, 6, 0.6, 0.18, 9);
    wobble(c, pts, false, 1, 5); inkStroke(c, 1.6);
    // farmhouse with chimney
    const fx = L.X(-L.ax(22)), fy = pts[Math.round(fx / 12)]?.[1] ?? base;
    const fw = L.k * 12, fh = L.k * 7;
    c.beginPath(); c.rect(fx, fy - fh, fw, fh + 6); wash(c, '#F1DFC2', 0.95); inkStroke(c, 1.4);
    c.beginPath(); c.moveTo(fx - 6, fy - fh); c.lineTo(fx + fw / 2, fy - fh - L.k * 3.5); c.lineTo(fx + fw + 6, fy - fh); c.closePath(); wash(c, '#C2552E', 0.9); inkStroke(c, 1.4);
    c.beginPath(); c.moveTo(fx - 6, fy - fh); c.lineTo(fx + fw / 2, fy - fh - L.k * 3.5); c.lineTo(fx + fw + 6, fy - fh); c.closePath(); hatch(c, [fx, fy - fh - L.k * 4, fx + fw, fy - fh], 0.3, 3, 0.6, 0.6, 2);
    c.beginPath(); c.rect(fx + fw * 0.7, fy - fh - L.k * 4.2, L.k * 1.2, L.k * 2.5); wash(c, '#B5624A', 1); inkStroke(c, 1.1);
    this.chimney = { x: (fx + fw * 0.7 + L.k * 0.6) / L.k - L.wM / 2, y: L.d * TAN_UP - (fy - fh - L.k * 4.2) / L.k };
    for (const [wx, wy] of [[0.2, 0.35], [0.6, 0.35], [0.2, 0.7]]) { c.beginPath(); c.rect(fx + fw * wx, fy - fh + fh * wy - 6, L.k * 1.5, L.k * 1.7); wash(c, '#2A2420', 0.85); inkStroke(c, 1); }
    c.beginPath(); c.rect(fx, fy - fh, fw, fh + 6); hatch(c, [fx, fy - fh, fx + fw, fy], 0.9, 4, 0.6, 0.3, 4);
    // cypresses
    const cyp = (x, h) => {
      const y = pts[Math.max(0, Math.round(x / 12))]?.[1] ?? base;
      const w = h * 0.17;
      const shape = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16, a = Math.sin(t * Math.PI) ** 0.7; shape.push([x - w * a * (0.9 + r() * 0.2), y - t * h]); }
      for (let i = 16; i >= 0; i--) { const t = i / 16, a = Math.sin(t * Math.PI) ** 0.7; shape.push([x + w * a * (0.9 + r() * 0.2), y - t * h]); }
      wobble(c, shape, true, 1.5, x); wash(c, '#2F4A2E', 0.92);
      wobble(c, shape, true, 1.5, x); hatch(c, [x - w, y - h, x + w, y], 1.25, 3, 0.7, 0.75, x);
      wobble(c, shape, true, 1.5, x); inkStroke(c, 1.3);
    };
    for (const deg of [-50, -46, -38, -31, -15, -11, 20, 27, 33, 44, 49]) cyp(L.X(L.ax(deg)), L.k * (9 + r() * 7));
    L.tex.needsUpdate = true;
  }
  drawPaddockStatic() {
    const L = this.pad, c = this.padStatic.getContext('2d');
    const top = L.Y(L.ax(-4.5));
    // the paddock slopes up to meet the near hills
    const pts = ridge(L, top, L.k * 0.4, 13, 16);
    const poly = [...pts, [L.canvas.width, L.canvas.height], [0, L.canvas.height]];
    wobble(c, poly, true, 1, 13); wash(c, '#B8A15A', 0.95);
    wobble(c, poly, true, 1, 13); hatch(c, [0, top, L.canvas.width, L.canvas.height], -0.15, 6, 0.6, 0.25, 3);
    // tufts of grass and dusty patches
    const r = rng(77);
    for (let i = 0; i < 420; i++) {
      const x = r() * L.canvas.width, y = top + 10 + r() * (L.canvas.height - top);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6 - r() * 4); c.moveTo(x, y); c.lineTo(x + 2, y - 5 - r() * 4); inkStroke(c, 0.8, 0.6);
    }
    c.beginPath(); c.ellipse(L.X(L.ax(-4)), L.Y(L.ax(-10)), L.k * 3, L.k * 0.6, 0, 0, Math.PI * 2); wash(c, '#D9C08A', 0.9);
    wobble(c, pts, false, 1, 13); inkStroke(c, 1.4);
    // fence: posts and two rails, running across the paddock
    this.fenceY = L.ax(-8.5);
    const fy = L.Y(this.fenceY), ph = L.k * 1.25;
    c.beginPath();
    for (const dy of [0.35, 0.75]) { c.moveTo(0, fy - ph * dy); for (let x = 0; x < L.canvas.width; x += 30) c.lineTo(x, fy - ph * dy + Math.sin(x * 0.02) * 1.5); }
    inkStroke(c, 2.2);
    this.posts = [];
    for (let x = 20; x < L.canvas.width; x += L.k * 2.6) {
      c.beginPath(); c.rect(x - 5, fy - ph, 10, ph + 6); wash(c, '#8A6A4A', 1); inkStroke(c, 1.4);
      c.beginPath(); c.rect(x - 5, fy - ph, 10, ph + 6); hatch(c, [x - 5, fy - ph, x + 5, fy + 6], 1.4, 2.5, 0.6, 0.6, x);
      this.posts.push(x);
    }
  }

  // --- animals -----------------------------------------------------------
  makeAnimals() {
    const L = this.pad;
    const mk = (kind, x, y, scale) => ({ kind, x, y, scale, dir: Math.random() < 0.5 ? -1 : 1, state: 'graze', until: 0, phase: Math.random() * 10, vx: 0, roll: 0, jump: 0 });
    const groundY = L.ax(-11.5);
    const post = this.posts[Math.floor(this.posts.length * 0.68)];
    return {
      donkeys: [mk('donkey', -L.ax(10), groundY, 1), mk('donkey', L.ax(6), groundY - 0.3, 1.05)],
      foals: [mk('foal', -L.ax(3), groundY - 0.15, 0.62), mk('foal', L.ax(1), groundY - 0.05, 0.58)],
      rooster: { x: post / L.k - L.wM / 2, y: this.fenceY + 1.25, peck: 0, crow: 0, dir: -1 },
    };
  }
  think(a, now, all) {
    const L = this.pad, range = L.ax(28);
    if (now > a.until) {
      const r = Math.random();
      if (a.kind === 'donkey') a.state = r < 0.5 ? 'graze' : r < 0.85 ? 'trot' : 'roll';
      else a.state = r < 0.35 ? 'chase' : r < 0.6 ? 'buck' : r < 0.8 ? 'trot' : 'graze';
      a.until = now + (a.state === 'roll' ? 4200 : a.state === 'buck' ? 1600 : 3000 + Math.random() * 5000);
      if (a.state === 'trot' || a.state === 'chase') a.dir = Math.abs(a.x) > range * 0.8 ? -Math.sign(a.x) : (Math.random() < 0.5 ? -1 : 1);
    }
    if (this.leaning && a.kind === 'foal') { a.state = 'stare'; }
    const sp = { trot: 1.3, chase: 2.4, graze: 0.05, roll: 0, buck: 0.6, stare: 0 }[a.state] ?? 0;
    if (a.state === 'chase') {
      const other = all.foals.find((f) => f !== a) || all.donkeys[0];
      const target = a === all.foals[0] ? other.x + 1.5 * Math.sin(now / 900) : all.donkeys[0].x + 2 * Math.cos(now / 700);
      a.dir = Math.sign(target - a.x) || 1;
    }
    a.x += a.dir * sp / 12;
    a.x = Math.max(-range, Math.min(range, a.x));
    a.phase += sp > 0.1 ? 0.9 : 0.15;
    a.roll = a.state === 'roll' ? Math.min(1, a.roll + 0.08) : Math.max(0, a.roll - 0.1);
    a.jump = a.state === 'buck' ? Math.abs(Math.sin(a.phase * 0.6)) : 0;
  }
  drawDonkey(c, a, L) {
    const s = a.scale * L.k, x = L.X(a.x), y = L.Y(a.y) - a.jump * s * 0.25;
    const col = a.kind === 'foal' ? '#B4A08A' : '#8A7A6A';
    c.save(); c.translate(x, y); c.scale(a.dir, 1);
    if (a.roll > 0) { c.translate(0, -0.55 * s); c.rotate(a.roll * Math.PI * 0.9 * Math.sin(a.phase * 0.25 + 1) ); c.translate(0, 0.55 * s); }
    const legSwing = (i) => (a.state === 'graze' || a.state === 'stare') ? 0 : Math.sin(a.phase + i * Math.PI) * 0.35;
    const legs = [[-0.42, 0], [-0.3, 1], [0.32, 1], [0.44, 0]];
    const kick = a.state === 'buck' ? a.jump : 0;
    // legs behind the body
    for (const [lx, i] of legs) {
      const sw = legSwing(i) + (lx < 0 ? -kick * 0.9 : 0);
      c.beginPath(); c.moveTo(lx * s, -0.62 * s); c.lineTo((lx + Math.sin(sw) * 0.55) * s, -0.05 * s - (lx < 0 ? kick * 0.3 * s : 0)); inkStroke(c, 0.09 * s);
      c.strokeStyle = col; c.lineWidth = 0.06 * s; c.stroke();
    }
    // body
    c.beginPath(); c.ellipse(0, -0.8 * s, 0.6 * s, 0.29 * s, 0, 0, Math.PI * 2); wash(c, col, 1); inkStroke(c, 1.6);
    c.beginPath(); c.ellipse(0, -0.7 * s, 0.55 * s, 0.14 * s, 0, 0, Math.PI); c.save(); c.clip(); hatch(c, [-0.6 * s, -0.8 * s, 0.6 * s, -0.5 * s], 0.9, 2.4, 0.6, 0.7, 5); c.restore();
    c.beginPath(); c.ellipse(0, -0.66 * s, 0.4 * s, 0.09 * s, 0, 0, Math.PI * 2); wash(c, '#F1E6CC', 0.7);
    // neck + head
    const graze = a.state === 'graze' ? 1 : 0;
    const stare = a.state === 'stare';
    const hx = (graze ? 0.78 : 0.62) * s, hy = graze ? -0.2 * s : -1.2 * s;
    c.beginPath(); c.moveTo(0.35 * s, -0.95 * s); c.quadraticCurveTo(0.55 * s, (graze ? -0.8 : -1.1) * s, hx, hy); c.lineTo(hx + 0.05 * s, hy + 0.22 * s); c.lineTo(0.45 * s, -0.68 * s); c.closePath(); wash(c, col, 1); inkStroke(c, 1.4);
    c.save(); c.translate(hx, hy); c.rotate(graze ? 1.2 : 0.35);
    if (stare) {
      c.beginPath(); c.ellipse(0, 0, 0.13 * s, 0.17 * s, 0, 0, Math.PI * 2); wash(c, col, 1); inkStroke(c, 1.3);
      c.beginPath(); c.arc(-0.05 * s, -0.03 * s, 0.022 * s, 0, 7); c.arc(0.05 * s, -0.03 * s, 0.022 * s, 0, 7); c.fillStyle = INK; c.fill();
      c.beginPath(); c.ellipse(0, 0.1 * s, 0.08 * s, 0.05 * s, 0, 0, 7); wash(c, '#F1E6CC', 1); inkStroke(c, 1);
    } else {
      c.beginPath(); c.ellipse(0.12 * s, 0.04 * s, 0.22 * s, 0.1 * s, 0.25, 0, Math.PI * 2); wash(c, col, 1); inkStroke(c, 1.3);
      c.beginPath(); c.ellipse(0.28 * s, 0.09 * s, 0.07 * s, 0.06 * s, 0, 0, 7); wash(c, '#F1E6CC', 1); inkStroke(c, 1);
      c.beginPath(); c.arc(0.04 * s, -0.01 * s, 0.018 * s, 0, 7); c.fillStyle = INK; c.fill();
    }
    // the ears, long and expressive
    const ear = Math.sin(a.phase * 0.3) * 0.15;
    for (const dx of [-0.04, 0.03]) { c.beginPath(); c.ellipse(dx * s, -0.2 * s, 0.035 * s, 0.17 * s, -0.4 + ear + dx * 3, 0, 7); wash(c, col, 1); inkStroke(c, 1.1); }
    c.restore();
    // mane, tail
    c.beginPath(); c.moveTo(0.33 * s, -1.0 * s); c.quadraticCurveTo(0.5 * s, (graze ? -0.85 : -1.2) * s, hx - 0.05 * s, hy - 0.06 * s); inkStroke(c, 0.05 * s, 0.85);
    c.beginPath(); c.moveTo(-0.58 * s, -0.86 * s); c.quadraticCurveTo(-0.75 * s, -0.7 * s + Math.sin(a.phase * 0.5) * 0.05 * s, -0.68 * s, -0.45 * s); inkStroke(c, 0.03 * s);
    c.restore();
  }
  drawRooster(c, ro, now, L) {
    const s = L.k * 0.5, x = L.X(ro.x), y = L.Y(ro.y);
    c.save(); c.translate(x, y); c.scale(ro.dir, 1);
    const crowing = now < ro.crow, peck = !crowing && Math.sin(now / 160) > 0.7 && Math.sin(now / 1900) > 0.2;
    // tail feathers
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-0.2 * s, -0.55 * s); c.quadraticCurveTo(-0.7 * s, (-1.1 + i * 0.12) * s, -0.55 * s, (-0.2 + i * 0.08) * s); inkStroke(c, 0.06 * s); c.strokeStyle = i % 2 ? '#2F5A3A' : '#3A2A5A'; c.lineWidth = 0.035 * s; c.stroke(); }
    c.beginPath(); c.ellipse(0, -0.45 * s, 0.3 * s, 0.22 * s, -0.2, 0, 7); wash(c, '#B6402A', 1); inkStroke(c, 1.3);
    c.beginPath(); c.ellipse(-0.02 * s, -0.42 * s, 0.18 * s, 0.1 * s, -0.3, 0, 7); wash(c, '#C9A44C', 0.9);
    c.beginPath(); c.moveTo(-0.05 * s, -0.25 * s); c.lineTo(-0.05 * s, 0); c.moveTo(0.06 * s, -0.25 * s); c.lineTo(0.06 * s, 0); inkStroke(c, 0.035 * s); c.strokeStyle = '#C9A44C'; c.lineWidth = 0.02 * s; c.stroke();
    c.save(); c.translate(0.22 * s, -0.68 * s); c.rotate(peck ? 1.1 : crowing ? -0.6 : 0);
    c.beginPath(); c.moveTo(0, 0.12 * s); c.lineTo(0.05 * s, -0.18 * s); c.lineTo(0.12 * s, 0.1 * s); c.closePath(); wash(c, '#C9A44C', 1); inkStroke(c, 1);
    c.beginPath(); c.arc(0.08 * s, -0.2 * s, 0.09 * s, 0, 7); wash(c, '#F1E6CC', 1); inkStroke(c, 1.1);
    c.beginPath(); for (let i = 0; i < 3; i++) c.arc((0.02 + i * 0.05) * s, -0.3 * s, 0.035 * s, Math.PI, 0); wash(c, '#E2412F', 1); inkStroke(c, 0.8);
    c.beginPath(); c.moveTo(0.16 * s, -0.22 * s); c.lineTo(0.26 * s, crowing ? -0.24 * s : -0.19 * s); c.lineTo(0.16 * s, -0.16 * s); if (crowing) { c.moveTo(0.16 * s, -0.19 * s); c.lineTo(0.25 * s, -0.12 * s); } wash(c, '#E8B84A', 1); inkStroke(c, 0.8);
    c.beginPath(); c.arc(0.1 * s, -0.22 * s, 0.014 * s, 0, 7); c.fillStyle = INK; c.fill();
    c.restore();
    if (crowing) { c.font = `italic 600 ${Math.round(0.28 * s)}px Caveat, cursive`; c.fillStyle = INK; c.fillText('chicchirichì!', 0.35 * s, -1.0 * s); }
    c.restore();
  }
  crow() { this.animals.rooster.crow = performance.now() + 1600; this.audio?.rooster(); }
  bray() { this.audio?.bray(); const d = this.animals.donkeys[0]; d.state = 'graze'; d.until = performance.now() + 1500; }

  drawAir(now) {
    const L = this.air, c = L.ctx; L.clear();
    // overhead wire, sagging across, with birds perched on it
    const wy = L.ax(9), x0 = L.X(-L.ax(55)), x1 = L.X(L.ax(55));
    c.beginPath(); c.moveTo(x0, L.Y(wy)); c.quadraticCurveTo((x0 + x1) / 2, L.Y(wy) + 40, x1, L.Y(wy)); inkStroke(c, 1.3, 0.9);
    for (const p of this.perched) {
      if (now < p.away) continue;
      const px = x0 + (x1 - x0) * p.u, t = p.u, py = L.Y(wy) + 2 * t * (1 - t) * 40;
      c.save(); c.translate(px, py);
      c.beginPath(); c.ellipse(0, -7, 5, 7, 0.3, 0, 7); wash(c, '#2A2A3A', 1); inkStroke(c, 0.8);
      c.beginPath(); c.arc(2, -15, 3.5, 0, 7); wash(c, '#2A2A3A', 1);
      c.beginPath(); c.moveTo(-3, -2); c.lineTo(-9, 6); c.lineTo(-5, 5); inkStroke(c, 1);
      c.restore();
    }
    // swallows
    for (const b of this.swallows) {
      const t = (now - b.t0) / b.dur; if (t > 1) continue;
      const x = b.x0 + (b.x1 - b.x0) * t, y = b.y0 + Math.sin(t * Math.PI) * b.dip + Math.sin(t * 12) * 6;
      const f = Math.sin(now / 50 + b.seed) * 0.8;
      const sz = b.size;
      c.save(); c.translate(L.X(x), L.Y(y)); c.scale(Math.sign(b.x1 - b.x0), 1);
      c.beginPath(); c.moveTo(-sz, -f * sz * 0.8); c.quadraticCurveTo(-sz * 0.4, -sz * 0.2, 0, 0); c.quadraticCurveTo(sz * 0.4, -sz * 0.2, sz, -f * sz * 0.8);
      inkStroke(c, 2.2);
      c.beginPath(); c.moveTo(-sz * 0.5, 2); c.lineTo(-sz * 1.1, 6); c.moveTo(-sz * 0.5, 2); c.lineTo(-sz * 1.05, -1); inkStroke(c, 1.2);
      c.restore();
    }
    this.swallows = this.swallows.filter((b) => now - b.t0 < b.dur);
    L.tex.needsUpdate = true;
  }
  drawSmoke(now) {
    const L = this.smoke, c = L.ctx; L.clear();
    if (!this.chimney) return;
    const t = now / 1000;
    for (let i = 0; i < 9; i++) {
      const age = ((t * 0.25 + i / 9) % 1);
      const x = L.X(this.chimney.x + age * 9 + Math.sin(t + i) * 0.6), y = L.Y(this.chimney.y + age * 10);
      c.beginPath(); c.arc(x, y, (4 + age * 18), 0, 7);
      c.fillStyle = 'rgba(240,232,220,' + (0.5 * (1 - age)) + ')'; c.fill();
      c.strokeStyle = 'rgba(26,23,20,' + (0.35 * (1 - age)) + ')'; c.lineWidth = 0.8; c.stroke();
    }
    L.tex.needsUpdate = true;
  }
  drawTrains(now) {
    const L = this.trainLayer, c = L.ctx; L.clear();
    const deckY = this.deckY;
    for (const tr of this.trains) {
      const x = tr.x;
      const carL = 26, h = 3.8, n = tr.cars;
      for (let i = 0; i < n; i++) {
        const cx = x - tr.dir * i * (carL + 0.8);
        const X0 = L.X(cx - carL / 2), X1 = L.X(cx + carL / 2), Y0 = L.Y(deckY + h + 0.4), Y1 = L.Y(deckY + 0.4);
        c.beginPath(); c.rect(X0, Y0, X1 - X0, Y1 - Y0);
        wash(c, tr.intercity ? '#E6E1D6' : '#ECE8DE', 1); inkStroke(c, 1.2);
        c.fillStyle = tr.intercity ? '#B6402A' : '#3E6B4A'; c.fillRect(X0, Y1 - (Y1 - Y0) * 0.32, X1 - X0, (Y1 - Y0) * 0.12);
        if (!tr.intercity) { c.fillStyle = '#2F4F6E'; c.fillRect(X0, Y1 - (Y1 - Y0) * 0.2, X1 - X0, (Y1 - Y0) * 0.06); }
        // lit windows
        for (let w = 0; w < 7; w++) { const wx = X0 + (X1 - X0) * (0.08 + w * 0.125); c.fillStyle = '#FFD27A'; c.fillRect(wx, Y0 + (Y1 - Y0) * 0.22, (X1 - X0) * 0.08, (Y1 - Y0) * 0.26); }
        c.beginPath(); c.rect(X0, Y0, X1 - X0, Y1 - Y0); inkStroke(c, 1);
        if (i === 0) { const nose = tr.dir > 0 ? X1 : X0; c.beginPath(); c.moveTo(nose, Y0); c.lineTo(nose + tr.dir * 6, Y0 + 4); c.lineTo(nose + tr.dir * 6, Y1); c.lineTo(nose, Y1); wash(c, '#ECE8DE', 1); inkStroke(c, 1); }
      }
      // pantograph spark at dusk
      if (this.dusk > 0.5 && Math.random() < 0.1) { c.fillStyle = '#BFE8FF'; c.fillRect(L.X(x) - 2, L.Y(deckY + h + 2.2), 4, 4); }
    }
    L.tex.needsUpdate = true;
  }

  // --- per frame -----------------------------------------------------------
  update(now, dt) {
    // sky follows the sun even when not looking (it drives the room light), but only redraws now and then
    if (now - this.lastSky > (this.active ? 1000 : 5000)) { this.lastSky = now; this.drawSky(this.dusk); }
    if (!this.active) return;
    const L = this.via;
    if (now > this.nextTrain) {
      const dir = Math.random() < 0.5 ? 1 : -1, intercity = Math.random() < 0.25;
      const cars = intercity ? 8 : 3 + Math.floor(Math.random() * 2);
      const edge = L.ax(60) + cars * 27;
      this.trains.push({ dir, x: -dir * edge, end: dir * edge, cars, intercity, speed: intercity ? 38 : 24 });
      this.nextTrain = now + 40000 + Math.random() * 50000;
      this.audio?.train(intercity);
    }
    for (const t of this.trains) t.x += t.dir * t.speed * dt;
    this.trains = this.trains.filter((t) => (t.dir > 0 ? t.x < t.end : t.x > t.end));
    if (now > this.nextSwallow) {
      const A = this.air, dir = Math.random() < 0.5 ? 1 : -1, n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.swallows.push({ t0: now + i * 260, dur: 1800 + Math.random() * 1200, x0: -dir * A.ax(60), x1: dir * A.ax(60), y0: A.ax(4 + Math.random() * 14), dip: -A.ax(4 + Math.random() * 6), size: 9 + Math.random() * 6, seed: Math.random() * 9 });
      this.nextSwallow = now + 15000 + Math.random() * 15000;
      // sometimes a perched bird joins them
      const p = this.perched[Math.floor(Math.random() * 3)]; if (Math.random() < 0.4) p.away = now + 9000;
    }
    if (now > this.nextCrow) { this.crow(); this.nextCrow = now + 120000 + Math.random() * 120000; }
    // 12 fps for the drawn animation
    if (now - this.lastAnim < 1000 / 12) return;
    this.lastAnim = now;
    const P = this.pad, c = P.ctx;
    P.clear(); c.drawImage(this.padStatic, 0, 0);
    const all = this.animals;
    const list = [...all.donkeys, ...all.foals];
    list.forEach((a) => this.think(a, now, all));
    list.sort((a, b) => b.y - a.y).forEach((a) => this.drawDonkey(c, a, P));
    this.drawRooster(c, all.rooster, now, P);
    P.tex.needsUpdate = true;
    this.drawAir(now); this.drawSmoke(now); this.drawTrains(now);
  }

  /** world-space click → which creature (if any), for bray / crow on click */
  hit(point) {
    const P = this.pad;
    // project the click ray onto the paddock plane is done by the caller; here point is in paddock metres
    const r = this.animals.rooster;
    if (Math.hypot(point.x - r.x, point.y - r.y) < 1.2) { this.crow(); return 'rooster'; }
    for (const a of [...this.animals.donkeys, ...this.animals.foals]) if (Math.abs(point.x - a.x) < 1.2 * a.scale && point.y < a.y + 1.5 && point.y > a.y - 0.3) { this.bray(); return 'donkey'; }
    return null;
  }
  get paddockMesh() { return this.pad.mesh; }
  paddockMetres(worldPoint) { const p = this.pad; return { x: worldPoint.x - EYE.x, y: worldPoint.y - EYE.y }; }
}
