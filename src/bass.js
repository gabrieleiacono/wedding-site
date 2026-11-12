// The bass, hanging on the desk wall in the corner by the door: a Squier 40th Anniversary Jazz
// Bass, Gold Edition, in its metallic ruby, with the gold anodised pickguard and control plate, gold
// hardware, a bound rosewood board with pearloid blocks, and a natural maple headstock.
//
// Modelled from a photo of the bass itself, not from a generic Jazz Bass: the body, the pickguard and the
// headstock are the outlines traced off the photo (bass-outline.js), scaled so that the saddles are a
// 34" scale length (864 mm) from the nut. The rest is the instrument's own geometry: 20 frets at their
// true positions (864 · 2^(-n/12) from the saddles), the neck tapering from 38 mm at the nut to 60 mm at
// the body, a 7¼" radius board, strings of real gauges at a real action, the four-saddle bent-plate
// bridge, the two J pickups, three knobs and the jack on the control plate, and the open-gear tuners
// with their cloverleaf keys sticking out beside the headstock.
//
// It hangs by the neck from a wall hanger, its tail resting against the wall. A tap plucks the string
// nearest to where you tapped, and the string shivers while it rings.
//
// Units: the instrument is built in millimetres, in its own frame (x across, bass side negative as you
// face it; y along the neck from the saddles to the nut; z out of the top, the back of the body at 0),
// and scaled down to metres.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { ROOM } from './room.js';
import { BODY, GUARD, HEAD, SEAM, KNOBS, JACK, TUNERS, RETAINER, DECAL, STRAP } from './bass-outline.js';

// where it hangs: on the north wall, in the corner by the door, its tail this high off the floor (m),
// leaning out at the top by this much (rad) so the neck clears the hanger's yoke
const AT = { x: -1.86, y: 1.12 };
const LEAN = 0.06;

const SCALE = 864, NUT = 864;
const Z = { body: 38, neck: 40, board: 5.5, head: 13 }; // body thickness; the neck's top (under the board); board and headstock thickness
const BOARD_END = 264, BOARD_R = 184; // the board stops a little past the 20th fret; a 7¼" radius
const NECK = { wNut: 38.1, wEnd: 60 };
const neckW = (y) => NECK.wNut + (NECK.wEnd - NECK.wNut) * (NUT - Math.min(NUT, y)) / (NUT - BOARD_END);
const fretY = (n) => SCALE * Math.pow(2, -n / 12); // fret n, from the saddles (n = 0 is the nut)
const boardTop = (x, y) => { const h = neckW(y) / 2; return Z.neck + Z.board + (h * h - x * x) / (2 * BOARD_R); };
const FRETS = 20, INLAYS = [1, 3, 5, 7, 9, 12, 15, 17, 19];

// the strings, E A D G: where they cross the saddles and the nut, and their gauges (.105 – .045")
const SADDLE_X = [-28.5, -9.5, 9.5, 28.5], NUT_X = [-15.75, -5.25, 5.25, 15.75];
const GAUGE = [2.67, 2.16, 1.65, 1.14];
// the strings' height: just over the nut, about 2.5 mm over the last fret, 14 mm over the body at the saddles,
// and following the board's radius across
const stringZ = (x, y) => 48.2 + (NUT - y) * 0.00473 - (x * x) / (2 * BOARD_R);
const stringX = (i, y) => SADDLE_X[i] + (NUT_X[i] - SADDLE_X[i]) * THREE.MathUtils.clamp(y / NUT, 0, 1);

const C = {
  ruby: '#84202F', rubySide: '#6E1A28', gold: '#D8AF52', goldPlate: '#D6B45E', black: '#1E1C1D',
  rosewood: '#3F2418', binding: '#EFE7D3', pearl: '#ECE6D6', maple: '#E6C188', nickel: '#CFCBC2', bone: '#EFE6CF',
  string: '#C4C0B6', walnut: '#7A4A2A', foam: '#2A2626',
};

// --- textures -------------------------------------------------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const bbox = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys); return { x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; };
/**
 * A canvas laid over a box of the bass's own millimetres (bb), at ppm pixels a millimetre. draw(g, X, Y, ppm)
 * gets functions from mm to canvas pixels. The texture is placed for ExtrudeGeometry caps, whose UVs are
 * the shape's own coordinates; pass plain = true for a texture on 0..1 UVs.
 */
function mmTexture(bb, ppm, draw, plain = false) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(bb.w * ppm); cv.height = Math.ceil(bb.h * ppm);
  const g = cv.getContext('2d');
  const X = (x) => (x - bb.x0) * ppm, Y = (y) => (bb.y0 + bb.h - y) * ppm;
  draw(g, X, Y, ppm, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  if (!plain) { tex.repeat.set(1 / bb.w, 1 / bb.h); tex.offset.set(-bb.x0 / bb.w, -bb.y0 / bb.h); }
  return tex;
}

// metallic ruby: the colour, a broad soft sheen where the light comes across the top, and metal flake
function rubyTexture(bb) {
  return mmTexture(bb, 2, (g, X, Y, ppm, W, H) => {
    g.fillStyle = C.ruby; g.fillRect(0, 0, W, H);
    const sheen = g.createRadialGradient(X(-40), Y(330), 10, X(-40), Y(330), 260 * ppm);
    sheen.addColorStop(0, 'rgba(214,110,128,0.42)'); sheen.addColorStop(0.55, 'rgba(170,60,80,0.16)'); sheen.addColorStop(1, 'rgba(90,10,30,0)');
    g.fillStyle = sheen; g.fillRect(0, 0, W, H);
    const dark = g.createLinearGradient(0, Y(-70), 0, Y(120));
    dark.addColorStop(0, 'rgba(50,5,15,0.28)'); dark.addColorStop(1, 'rgba(50,5,15,0)');
    g.fillStyle = dark; g.fillRect(0, 0, W, H);
    const r = rng(7);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.6 ? `rgba(255,190,200,${0.12 + r() * 0.18})` : `rgba(40,0,10,${0.1 + r() * 0.15})`;
      g.fillRect(r() * W, r() * H, 1, 1);
    }
  });
}

// the outline's screw holes: every `step` mm round the edge, `inset` mm in from it
function edgeScrews(pts, step, inset, skip = () => false) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = Math.sign(area), out = [];
  let carry = step / 2;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    while (carry <= L) {
      const t = carry / L, nx = (-dy / L) * s, ny = (dx / L) * s; // the inward normal (left of a counter-clockwise edge)
      const p = [a[0] + dx * t + nx * inset, a[1] + dy * t + ny * inset];
      if (!skip(p)) out.push(p);
      carry += step;
    }
    carry -= L;
  }
  return out;
}
function screwHead(g, x, y, r, rot, base = '#C9A24A') {
  g.fillStyle = 'rgba(70,45,10,0.55)'; g.beginPath(); g.arc(x, y, r * 1.18, 0, Math.PI * 2); g.fill();
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grd.addColorStop(0, '#F3DC95'); grd.addColorStop(1, base);
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(60,40,10,0.8)'; g.lineWidth = r * 0.28;
  g.beginPath(); g.moveTo(x - Math.cos(rot) * r * 0.8, y - Math.sin(rot) * r * 0.8); g.lineTo(x + Math.cos(rot) * r * 0.8, y + Math.sin(rot) * r * 0.8); g.stroke();
}

// gold anodised aluminium: brushed, with the seam where the control plate meets the guard, and screws
function guardTexture(bb) {
  return mmTexture(bb, 3, (g, X, Y, ppm, W, H) => {
    g.fillStyle = C.goldPlate; g.fillRect(0, 0, W, H);
    const r = rng(11);
    for (let i = 0; i < 2600; i++) {
      const y = r() * H, x = r() * W, len = 20 + r() * 120;
      g.strokeStyle = r() < 0.5 ? `rgba(255,240,200,${0.05 + r() * 0.08})` : `rgba(120,85,20,${0.04 + r() * 0.06})`;
      g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + len * 0.08); g.stroke();
    }
    const glow = g.createLinearGradient(X(-80), Y(330), X(160), Y(0));
    glow.addColorStop(0, 'rgba(255,245,210,0.28)'); glow.addColorStop(0.5, 'rgba(255,245,210,0)'); glow.addColorStop(1, 'rgba(110,70,10,0.18)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // the seam, carried a little past the traced ends so it runs edge to edge
    const [a, b] = SEAM, ex = (b[0] - a[0]) * 0.08, ey = (b[1] - a[1]) * 0.08;
    g.strokeStyle = 'rgba(80,55,12,0.85)'; g.lineWidth = 0.7 * ppm;
    g.beginPath(); g.moveTo(X(a[0] - ex), Y(a[1] - ey)); g.lineTo(X(b[0] + ex), Y(b[1] + ey)); g.stroke();
    const away = (p) => (Math.abs(p[0]) < 34 && p[1] > 255) || KNOBS.some((k) => Math.hypot(p[0] - k[0], p[1] - k[1]) < 14) || Math.hypot(p[0] - JACK[0], p[1] - JACK[1]) < 12
      || (p[1] > 145 && p[1] < 176 && Math.abs(p[0]) < 52);
    for (const p of edgeScrews(GUARD, 46, 4.2, away)) screwHead(g, X(p[0]), Y(p[1]), 1.9 * ppm, r() * Math.PI);
  });
}

// the board, on 0..1 UVs: u across (bass side at 0), v along it from the body end (0) to the nut (1)
function boardTexture() {
  const L = NUT - BOARD_END;
  return mmTexture({ x0: 0, y0: BOARD_END, w: 64, h: L }, 4, (g, X, Y, ppm, W, H) => {
    g.fillStyle = C.rosewood; g.fillRect(0, 0, W, H);
    const r = rng(23);
    for (let i = 0; i < 260; i++) {
      const x = r() * W, wob = 2 + r() * 6;
      g.strokeStyle = r() < 0.55 ? `rgba(20,8,4,${0.15 + r() * 0.25})` : `rgba(120,70,40,${0.08 + r() * 0.15})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= H; y += 60) g.lineTo(x + Math.sin(y * 0.004 + i) * wob, y);
      g.stroke();
    }
    // pearloid blocks, two-thirds of the board's width, in the middle of their frets
    for (const n of INLAYS) {
      const y0 = fretY(n - 1), y1 = fretY(n), h = Math.min(14, (y0 - y1) * 0.48), yc = (y0 + y1) / 2;
      const bx = W * 0.17, bw = W * 0.66, by = Y(yc + h / 2), bh = h * ppm;
      g.fillStyle = C.pearl; g.fillRect(bx, by, bw, bh);
      for (let k = 0; k < 90; k++) {
        g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.2 + r() * 0.3})` : `rgba(170,165,150,${0.12 + r() * 0.2})`;
        g.beginPath(); g.ellipse(bx + r() * bw, by + r() * bh, 1 + r() * 5, 0.8 + r() * 3, r() * 3, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(40,25,15,0.5)'; g.lineWidth = 1; g.strokeRect(bx, by, bw, bh);
    }
    // the white binding, both edges (the fret ends stop just inside it)
    g.fillStyle = C.binding; g.fillRect(0, 0, W * 0.028, H); g.fillRect(W * 0.972, 0, W * 0.028, H);
  }, true);
}

// natural maple, with the decal along the treble edge: "Squier" in script, then JAZZ BASS
function headTexture(bb) {
  return mmTexture(bb, 7, (g, X, Y, ppm, W, H) => {
    g.fillStyle = C.maple; g.fillRect(0, 0, W, H);
    const r = rng(31);
    for (let i = 0; i < 140; i++) {
      const x = r() * W, wob = 3 + r() * 10;
      g.strokeStyle = r() < 0.6 ? `rgba(170,115,50,${0.08 + r() * 0.14})` : `rgba(255,236,190,${0.1 + r() * 0.15})`;
      g.lineWidth = 0.8 + r() * 2.5;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= H; y += 40) g.lineTo(x + Math.sin(y * 0.006 + i * 1.7) * wob, y);
      g.stroke();
    }
    const [a, b] = DECAL;
    const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); // the decal's line, in the canvas (whose y runs down)
    g.save(); g.translate(X(a[0]), Y(a[1])); g.rotate(ang);
    g.fillStyle = '#141210'; g.textBaseline = 'middle';
    // each word fitted to its length on the real decal: "Squier" 50 mm, then JAZZ BASS 60 mm
    const fit = (text, font, mm) => { g.font = `${font.replace('%', 100)}`; const k = (mm * ppm) / g.measureText(text).width; g.font = font.replace('%', (100 * k).toFixed(1)); };
    fit('Squier', 'italic 700 %px Caveat, "Brush Script MT", cursive', 50);
    g.fillText('Squier', 0, -0.6 * ppm);
    g.font = `italic 700 ${2.4 * ppm}px "Times New Roman", serif`;
    g.fillText('by FENDER', 9 * ppm, 6.4 * ppm); // under the q, towards the edge
    fit('JAZZ BASS', 'italic 700 %px "Times New Roman", Georgia, serif', 60);
    g.fillText('JAZZ BASS', 55 * ppm, 1.4 * ppm);
    g.font = `${2.6 * ppm}px sans-serif`; g.fillText('®', 116 * ppm, -1.4 * ppm);
    g.restore();
  });
}

// --- geometry helpers -------------------------------------------------------------------------------
/** A traced outline as a smooth closed Shape (centripetal Catmull-Rom through the traced points). */
function smoothShape(pts, n) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return new THREE.Shape(curve.getSpacedPoints(n).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y)));
}
/** Extrude a shape from z0 up to z1, the edges rounded by `bevel` inside the outline (not past it). */
function slabGeo(shape, z0, z1, bevel, segs = 3, curveSegments = 1) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segs, curveSegments });
  geo.translate(0, 0, z0 + bevel);
  return geo;
}
const roundRect = (x0, y0, w, h, r) => {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
};
/** A cylinder from point a to point b (mm), radius r. */
function rod(a, b, r, mat, seg = 10, rb = r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, rb, L, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
  return m;
}
/** A disc-ish cylinder standing on the face at (x, y), from z0 to z1. */
function post(x, y, z0, z1, r, mat, seg = 16, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, z1 - z0, seg), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, (z0 + z1) / 2);
  return m;
}

/** The neck's back: a C-shaped shell under the board, tapering, and thinning into the headstock. */
function neckBackGeo() {
  const ys = [], K = 18;
  for (let y = BOARD_END; y < NUT; y += 25) ys.push(y);
  ys.push(NUT, 870, 876, 882, 888);
  const depth = (y) => y <= NUT ? 20 + 2.5 * (NUT - y) / (NUT - BOARD_END) : 20 - 7 * Math.min(1, (y - NUT) / 24);
  const pos = [], idx = [];
  ys.forEach((y, j) => {
    const hw = neckW(y) / 2 - 0.2, d = depth(y);
    for (let k = 0; k <= K; k++) {
      const ph = (k / K) * Math.PI, s = Math.sin(ph);
      pos.push(hw * Math.cos(ph), y, Z.neck - d * Math.pow(s, 0.75));
    }
    if (j) for (let k = 0; k < K; k++) { const a = (j - 1) * (K + 1) + k, b = a + K + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/** The board: a radiused top (textured), bound sides, and its end at the body. */
function boardGeos() {
  const J = 24, K = 14, top = [], uv = [], ti = [], side = [], si = [];
  for (let j = 0; j <= J; j++) {
    const y = BOARD_END + (NUT - BOARD_END) * (j / J), hw = neckW(y) / 2;
    for (let k = 0; k <= K; k++) { const x = -hw + 2 * hw * (k / K); top.push(x, y, boardTop(x, y)); uv.push(k / K, j / J); }
    for (const s of [-1, 1]) side.push(s * hw, y, Z.neck, s * hw, y, Z.neck + Z.board);
    if (j) {
      for (let k = 0; k < K; k++) { const a = (j - 1) * (K + 1) + k, b = a + K + 1; ti.push(a, a + 1, b, a + 1, b + 1, b); }
      const p = (j - 1) * 4, q = j * 4; // [left bottom, left top, right bottom, right top] per station
      si.push(p, q + 1, q, p, p + 1, q + 1); // left side faces -x
      si.push(p + 2, q + 2, q + 3, p + 2, q + 3, p + 3);
    }
  }
  const g1 = new THREE.BufferGeometry();
  g1.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); g1.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g1.setIndex(ti); g1.computeVertexNormals();
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(side, 3)); g2.setIndex(si); g2.computeVertexNormals();
  // the end: the radiused top over a flat bottom, facing the bridge
  const hw = neckW(BOARD_END) / 2, end = [0, BOARD_END, Z.neck], ei = [];
  for (let k = 0; k <= K; k++) { const x = -hw + 2 * hw * (k / K); end.push(x, BOARD_END, boardTop(x, BOARD_END)); if (k) ei.push(0, k + 1, k); }
  end.push(-hw, BOARD_END, Z.neck, hw, BOARD_END, Z.neck);
  ei.push(0, 1, K + 2, 0, K + 3, K + 1);
  const g3 = new THREE.BufferGeometry();
  g3.setAttribute('position', new THREE.Float32BufferAttribute(end, 3)); g3.setIndex(ei); g3.computeVertexNormals();
  return { top: g1, sides: g2, end: g3 };
}

/** A tuner key: the cloverleaf, flat, its shaft along -x from (0, 0). */
function keyShape() {
  const s = new THREE.Shape(), n = 64;
  // the stem, then the leaf: a broad paddle with three shallow lobes round its far end
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (i / n) * Math.PI; // from one side of the stem, round the far end, to the other
    const lobes = 1 + 0.09 * Math.cos(3 * (t + Math.PI / 2) * 1.0 + Math.PI);
    const rx = 12.5 * lobes, ry = 13.5 * lobes;
    pts.push([-(16 + rx * Math.cos(t)), ry * Math.sin(t) * (0.55 + 0.45 * Math.cos(t * 0.6))]);
  }
  s.moveTo(0, -3);
  s.lineTo(-6, -3.2); s.quadraticCurveTo(-11, -4, pts[0][0] + 6, pts[0][1] + 2);
  for (const p of pts) s.lineTo(p[0], p[1]);
  s.quadraticCurveTo(-11, 4, -6, 3.2); s.lineTo(0, 3);
  s.closePath();
  return s;
}

// --- the bass -----------------------------------------------------------------------------------------
export function buildBass(room) {
  // outer: on the wall, facing into the room (+z), at the tail's height. lean: tilts the top out.
  const outer = new THREE.Group(); room.add(outer);
  outer.position.set(AT.x, AT.y, -ROOM.hz + 0.002);
  const lean = new THREE.Group(); lean.rotation.x = LEAN; outer.add(lean);
  const b = new THREE.Group(); b.scale.setScalar(0.001); lean.add(b);
  const tail = Math.min(...BODY.map((p) => p[1]));
  b.position.y = -tail * 0.001; // the bottom of the body rests on the wall at the outer group's origin
  const add = (o, shadow = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = true; } }); b.add(o); return o; };

  const bodyBB = bbox(BODY), guardBB = bbox(GUARD), headBB = bbox(HEAD);
  const mats = {
    ruby: makeInk({ color: '#ffffff', map: rubyTexture(bodyBB), wash: 0.92, hatch: 0.45 }),
    rubySide: makeInk({ color: C.rubySide, wash: 0.9, hatch: 0.6 }),
    guard: makeInk({ color: '#ffffff', map: guardTexture(guardBB), wash: 0.92, hatch: 0.35, lift: 0.04 }),
    goldPlate: makeInk({ color: C.goldPlate, wash: 0.85, hatch: 0.5 }),
    gold: makeInk({ color: C.gold, wash: 0.85, hatch: 0.5, lift: 0.05 }),
    black: makeInk({ color: C.black, wash: 0.92, hatch: 0.4 }),
    white: makeInk({ color: '#EDEAE2', wash: 0.6 }),
    nickel: makeInk({ color: C.nickel, wash: 0.7, hatch: 0.4, lift: 0.06 }),
    board: makeInk({ color: '#ffffff', map: boardTexture(), wash: 0.92, hatch: 0.4 }),
    binding: makeInk({ color: C.binding, wash: 0.6, hatch: 0.5 }),
    rosewood: makeInk({ color: C.rosewood, wash: 0.9 }),
    head: makeInk({ color: '#ffffff', map: headTexture(headBB), wash: 0.92, hatch: 0.35 }),
    maple: makeInk({ color: C.maple, wash: 0.78, wood: 1, grain: new THREE.Vector3(0, 1, 0), grainScale: 0.8 }),
    bone: makeInk({ color: C.bone, wash: 0.6 }),
    string: makeInk({ color: C.string, wash: 0.75, hatch: 0.25, lift: 0.05 }),
    walnut: makeInk({ color: C.walnut, wash: 0.75, wood: 1, grain: new THREE.Vector3(0, 1, 0) }),
    foam: makeInk({ color: C.foam, wash: 0.9 }),
  };

  // --- body and pickguard ---------------------------------------------------------------------------
  add(new THREE.Mesh(slabGeo(smoothShape(BODY, 360), 0, Z.body, 5.5, 4), [mats.ruby, mats.rubySide]));
  add(new THREE.Mesh(slabGeo(smoothShape(GUARD, 240), Z.body, Z.body + 1.6, 0.45, 1), [mats.guard, mats.goldPlate]));
  const onGuard = Z.body + 1.6;

  // --- pickups: two J pickups, black, eight poles each (two to a string) ------------------------------
  const pickup = (x0, x1, y0, y1) => {
    const L = x1 - x0, Wd = y1 - y0, top = 47.4;
    add(new THREE.Mesh(slabGeo(roundRect(x0, y0, L, Wd, 6.5), Z.body - 2, top, 1.6, 3, 6), mats.black));
    const yc = (y0 + y1) / 2;
    for (let k = 0; k < 8; k++) add(post(x0 + L / 2 + (k - 3.5) * L * 0.112, yc, top - 0.5, top + 0.25, 1.55, mats.nickel, 10));
    for (const s of [-1, 1]) add(post(x0 + L / 2 + s * (L / 2 - 3.2), yc, top - 0.5, top + 0.3, 1.1, mats.nickel, 8)); // the height screws
  };
  pickup(-48.9, 46.9, 55.8, 76.3); // bridge
  pickup(-46, 46, 151, 169.5); // neck

  // --- control plate: three knobs (volume, volume, tone) and the jack ---------------------------------
  KNOBS.forEach(([x, y], i) => {
    const k = new THREE.Group(); add(k);
    k.add(post(x, y, onGuard, onGuard + 14, 9.6, mats.black, 24, 9.0));
    k.add(post(x, y, onGuard + 14, onGuard + 15.2, 9.0, mats.black, 24, 8.2)); // the domed top's rim
    const a = 0.6 + i * 1.3; // each pointer where it was left
    const ptr = new THREE.Mesh(new THREE.BoxGeometry(1.3, 6.5, 0.6), mats.white);
    ptr.position.set(x + Math.sin(a) * 4.2, y + Math.cos(a) * 4.2, onGuard + 15.3); ptr.rotation.z = -a; k.add(ptr);
    k.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  });
  add(post(JACK[0], JACK[1], onGuard - 0.2, onGuard + 2.2, 6.2, mats.gold, 6)); // the hex nut
  add(post(JACK[0], JACK[1], onGuard + 2.2, onGuard + 2.4, 3.6, mats.black, 16), false);

  // --- bridge: a gold bent plate, four saddles on height screws, intonation screws to the back --------
  const BR = { x0: -40.7, x1: 37.3, y0: -36.2, y1: 17.7 };
  add(new THREE.Mesh(slabGeo(roundRect(BR.x0, BR.y0, BR.x1 - BR.x0, BR.y1 - BR.y0, 3), Z.body, Z.body + 2, 0.5, 1), mats.gold));
  const wall = new THREE.Mesh(new THREE.BoxGeometry(BR.x1 - BR.x0, 2, 12), mats.gold);
  wall.position.set((BR.x0 + BR.x1) / 2, BR.y0 + 1, Z.body + 6); add(wall);
  for (const x of [-34, -12.5, 12.5, 32]) add(post(x, 11, Z.body + 2, Z.body + 2.8, 2.2, mats.gold, 10)); // mounting screws
  SADDLE_X.forEach((x, i) => {
    const top = stringZ(x, 0) - GAUGE[i] / 2, r = 4.2;
    const sad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 17, 14), mats.gold); // a barrel lying along the string
    sad.position.set(x, -6.5, top - r); add(sad);
    for (const s2 of [-1, 1]) add(rod([x + s2 * 2.4, -6.5, Z.body + 2], [x + s2 * 2.4, -6.5, top - r], 1.1, mats.nickel, 6)); // height screws
    add(rod([x, BR.y0 - 1.5, top - r], [x, -15, top - r], 1.15, mats.nickel, 6)); // intonation screw
    add(rod([x, -27, top - r], [x, -15.5, top - r], 2.2, mats.gold, 8)); // its spring
    const head = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.2, 10), mats.nickel); // its head, at the back
    head.position.set(x, BR.y0 - 0.6, top - r); add(head);
    // the string behind the saddle, down through the back of the bridge, and its ball end
    add(rod([x, -6.5, top + GAUGE[i] / 2 - 0.2], [x, BR.y0 + 1, Z.body + 9], GAUGE[i] / 2, mats.string, 6), false);
    const ball = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.8, 6, 12), mats.gold);
    ball.rotation.x = Math.PI / 2; ball.position.set(x, BR.y0 - 0.8, Z.body + 9); add(ball);
  });

  // --- neck, board, frets, nut ---------------------------------------------------------------------------
  add(new THREE.Mesh(neckBackGeo(), mats.maple));
  const bg = boardGeos();
  add(new THREE.Mesh(bg.top, mats.board)); add(new THREE.Mesh(bg.sides, mats.binding)); add(new THREE.Mesh(bg.end, mats.rosewood));
  for (let n = 1; n <= FRETS; n++) {
    const y = fretY(n), hw = neckW(y) / 2 - 1.4, pts = [];
    for (let k = 0; k <= 8; k++) { const x = -hw + 2 * hw * (k / 8); pts.push(new THREE.Vector3(x, y, boardTop(x, y) + 0.1)); }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 1.15, 6, false), mats.nickel));
  }
  const nut = new THREE.Mesh(new THREE.BoxGeometry(NECK.wNut, 4, 8.6), mats.bone);
  nut.position.set(0, NUT + 2, Z.neck + 4.3); add(nut);

  // --- headstock, tuners, string retainer ---------------------------------------------------------------
  add(new THREE.Mesh(slabGeo(smoothShape(HEAD, 220), Z.neck - Z.head, Z.neck, 1.6, 3), [mats.head, mats.maple]));
  const face = Z.neck, back = Z.neck - Z.head;
  const keyGeo = new THREE.ExtrudeGeometry(keyShape(), { depth: 1.6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1, curveSegments: 8 });
  const edgeAt = (y) => { // the headstock's tuner-side edge at height y (the leftmost crossing of the outline)
    let best = 0;
    for (let i = 0; i < HEAD.length; i++) {
      const a = HEAD[i], c = HEAD[(i + 1) % HEAD.length];
      if ((a[1] - y) * (c[1] - y) <= 0 && a[1] !== c[1]) best = Math.min(best, a[0] + (c[0] - a[0]) * (y - a[1]) / (c[1] - a[1]));
    }
    return best;
  };
  const POST_R = 3.6, winds = [];
  TUNERS.forEach(([x, y], i) => {
    const t = new THREE.Group(); add(t);
    t.add(post(x, y, face, face + 2, 6.4, mats.gold, 6)); // the bushing
    t.add(post(x, y, face + 2, face + 15, POST_R, mats.gold, 14)); // the post (slotted at the top: drawn by the outline)
    const slot = new THREE.Mesh(new THREE.BoxGeometry(POST_R * 2.05, 1.1, 5), mats.black); slot.position.set(x, y, face + 13); slot.rotation.z = 0.4 + i; t.add(slot);
    // the winding: more turns on the thin strings
    const wind = post(x, y, face + 4, face + 4 + 3 + i * 0.8, POST_R + GAUGE[i] * 0.9, mats.string, 14); t.add(wind); winds.push(wind);
    // behind the headstock: the gear housing, its shaft out past the edge, and the key
    const ex = edgeAt(y);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(x - ex + 14, 20, 11), mats.gold);
    housing.position.set((x + ex - 4) / 2 + 1, y, back - 5.5); t.add(housing);
    t.add(rod([ex - 2, y, back - 5.5], [ex - 10, y, back - 5.5], 2.1, mats.gold, 8));
    const key = new THREE.Mesh(keyGeo, mats.gold); key.position.set(ex - 6, y, back - 6.3); t.add(key);
    t.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  });
  const [rx, ry] = RETAINER;
  add(post(rx, ry, face, face + 3.6, 2.2, mats.gold, 10));
  add(post(rx, ry, face + 3.6, face + 5.0, 6.6, mats.gold, 18, 6.2));

  // --- strings ------------------------------------------------------------------------------------------
  // the vibrating length, saddle to nut, as a cylinder of rings that tick() can bow sideways;
  // and the fixed lengths behind the nut, to the posts (D and G under the retainer)
  const strings = [];
  for (let i = 0; i < 4; i++) {
    const r = GAUGE[i] / 2;
    const A = new THREE.Vector3(SADDLE_X[i], 0, stringZ(SADDLE_X[i], 0)), B = new THREE.Vector3(NUT_X[i], NUT, stringZ(NUT_X[i], NUT));
    const L = A.distanceTo(B);
    const geo = new THREE.CylinderGeometry(r, r, L, 6, 32, true); geo.translate(0, L / 2, 0);
    const m = new THREE.Mesh(geo, mats.string);
    m.position.copy(A); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    add(m, false);
    strings.push({ mesh: m, L, base: Float32Array.from(geo.attributes.position.array), amp: 0, t0: 0 });
    const [px, py] = TUNERS[i], zp = face + 5.5 + i * 0.4;
    const atPost = [px + POST_R + r, py, zp];
    const n0 = [NUT_X[i], NUT + 4, B.z - 0.4];
    if (i >= 2) { const under = [rx + (i === 2 ? -5.2 : 5.2), ry, face + 3.2]; add(rod(n0, under, r, mats.string, 6), false); add(rod(under, atPost, r, mats.string, 6), false); }
    else add(rod(n0, atPost, r, mats.string, 6), false);
  }

  // --- strap buttons --------------------------------------------------------------------------------------
  const button = (x, y, dir) => {
    const g = new THREE.Group(); g.position.set(x, y, Z.body / 2); add(g);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.8, 7, 14), mats.gold); st.position.y = 3.5 * dir; g.add(st);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.0, 2.4, 16), mats.gold); cap.position.y = 7.6 * dir; g.add(cap);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  };
  button(STRAP.tail[0], STRAP.tail[1] + 1, -1);
  button(STRAP.horn[0], STRAP.horn[1] - 1, 1);

  // --- the hanger: a walnut block on the wall, two prongs with foam sleeves cradling the neck ------------
  // (in the wall's own frame, in metres: placed where the neck is, just under the headstock)
  b.updateMatrix(); lean.updateMatrix();
  const toWall = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(b.matrix).applyMatrix4(lean.matrix);
  const hang = new THREE.Group(); outer.add(hang);
  const yoke = toWall(0, NUT - 4, Z.neck - 21); // the back of the neck, where it rests
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.085, 0.016), mats.walnut);
  plate.position.set(0, yoke.y + 0.012, 0.008); hang.add(plate);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.02, 14), mats.gold);
  hub.rotation.x = Math.PI / 2; hub.position.set(0, yoke.y, 0.025); hang.add(hub);
  for (const s of [-1, 1]) {
    const x = s * 0.0255, reach = yoke.z + 0.03;
    const arm = rod([x * 0.4, yoke.y, 0.03], [x, yoke.y - 0.002, reach], 0.0032, mats.gold, 8); hang.add(arm);
    const sleeve = rod([x, yoke.y - 0.0015, reach - 0.065], [x, yoke.y - 0.002, reach + 0.004], 0.0055, mats.foam, 10); hang.add(sleeve);
    const tip = rod([x, yoke.y - 0.002, reach + 0.002], [x, yoke.y + 0.016, reach + 0.006], 0.005, mats.foam, 10); hang.add(tip);
  }
  hang.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const center = new THREE.Vector3(); // the middle of the instrument, in the room (for the close-up)

  // --- playing it -------------------------------------------------------------------------------------------
  const hooks = { pluck: null }; // main.js sets this to a sound
  let frame = 0;
  const pluck = (worldPoint) => {
    const p = b.worldToLocal(worldPoint.clone());
    let best = 0, bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const sx = p.y > NUT ? NUT_X[i] + (TUNERS[i][0] - NUT_X[i]) * Math.min(1, (p.y - NUT) / (TUNERS[i][1] - NUT)) : stringX(i, p.y);
      const d = Math.abs(p.x - sx); if (d < bd) { bd = d; best = i; }
    }
    const s = strings[best];
    s.amp = 2.6 - best * 0.3; s.t0 = performance.now();
    hooks.pluck?.(best);
    return best;
  };
  const tick = (now) => {
    frame++;
    for (const s of strings) {
      if (!s.amp) continue;
      const age = (now - s.t0) / 1000, a = s.amp * Math.exp(-age * 2.4);
      const pos = s.mesh.geometry.attributes.position, arr = pos.array;
      const done = a < 0.06;
      // a string ringing is a blur: bow it one way on one frame and the other way on the next
      const k = done ? 0 : a * (frame % 2 ? 1 : -0.8);
      for (let v = 0; v < arr.length; v += 3) arr[v] = s.base[v] + k * Math.sin(Math.PI * (s.base[v + 1] / s.L));
      pos.needsUpdate = true;
      if (done) s.amp = 0;
    }
  };
  const isBass = (o) => { for (; o; o = o.parent) if (o === outer) return true; return false; };
  outer.updateMatrixWorld(true);
  b.localToWorld(center.set(0, (tail + HEAD[0][1] + 220) / 2, Z.body / 2));
  return { group: outer, hooks, pluck, tick, isBass, center, ringing: () => strings.some((s) => s.amp) };
}
