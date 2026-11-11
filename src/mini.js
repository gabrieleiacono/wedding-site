// A 1:12 scale model of a classic Mini (the original Mk1 two-door saloon of 1959-67), in British racing
// green with twin white stripes over the bonnet and the roof, on a little walnut display base. It stands
// on the bookshelf next to the tennis trophy, where the globe used to be.
//
// Shaped from photos of real Mk1 Minis, front, back and sides (wedding-site-shots/mini/refs), and the real
// car's numbers in millimetres at full size, then shrunk 12 times: 3054 mm long, 1410 wide, 1346 high,
// 2036 wheelbase, 10-inch wheels (so the model is 254 × 118 × 112 mm). A Mini is two boxes, not three:
// the cabin runs nearly bumper to bumper, the back drops straight down from the rear window to the bumper,
// the bonnet is short and falls away, and the little wheels sit right out at the corners. The body bellies
// out below the waist and tucks under at the sills; the seams are on the outside (down the front of the
// doors, at the back corners, along the sills); the headlamps stand out of the wings in pods each side of
// the wide "moustache" grille; the door hinges show; and the tail lamps are small upright ones on the corners.
//
// Built in the car's own frame (z forward, x to the car's left, y up, y = 0 under the tyres) and merged
// into one vertex-coloured mesh; only the number plates are separate, for their drawn text.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { roundedShape } from './room.js';
import { merge } from './geo.js';

export const MINI_SCALE = 1 / 12;
const MM = MINI_SCALE / 1000; // full-size millimetres → metres in the room

const C = {
  green: '#1F4A33', white: '#F1EDE1', chrome: '#C9CCCB', black: '#232226', rubber: '#1C1B1E',
  glass: '#3C4C55', wheel: '#B9BBB8', red: '#B5372B', amber: '#E0943A', lamp: '#EFEBD8', under: '#2A2A2C',
};
const PLATE = 'GP 2027';

// --- the body's measurements (mm), read off photos of real Mk1 Minis (see wedding-site-shots/mini/refs) --
// A Mini is a box on four tiny wheels pushed right out to the corners: the cabin runs almost the whole
// length, the boot is no more than the upright lid at the back, and the bonnet is short and falls away.
const AXLE = { r: 500, f: 2536, y: 258 }; // wheel centres along z, and their height
const TRACK = { f: 1205, r: 1164 };
const TYRE = { r: 258, rim: 128 }; // 5.20-10 cross-plies on 10-inch steel wheels
const BODY = { half: 705, bevel: 45, arch: 345, archY: 270 }; // arch radius before the bevel narrows it
const CAB = { half: 615, bevel: 28, y0: 905, y1: 1318, lean: 0.12 }; // the cabin, and how far it leans in
const LENGTH = { front: 3057, rear: -40 }; // bumper to bumper
// where the windscreen and the rear window meet the cabin's sides, along z, by height
const zScreen = (y) => 2245 - (y - CAB.y0) * (265 / (CAB.y1 - CAB.y0));
const zRearWin = (y) => 225 + (y - CAB.y0) * (250 / (CAB.y1 - CAB.y0));
const cabHalf = (y) => CAB.half * (1 - CAB.lean * Math.min(1, Math.max(0, (y - CAB.y0) / (CAB.y1 - CAB.y0))));
// the top of the lower body, rear to front (before the bevel): the boot lid's top, the waist under the
// windows, then the scuttle and the bonnet falling to the nose
const TOP = [[55, 840], [110, 880], [220, 898], [2245, 902], [2450, 880], [2700, 845], [2860, 810], [2935, 760]];
// the body's half width by height (it bellies out below the waist and tucks under to sills as high as
// the hubs, with the floor pan hidden in the shadow beneath) ...
const HW = [[350, 648], [440, 690], [520, 705], [620, 705], [900, 672], [960, 650]];
const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lerpTable = (T, v) => {
  if (v <= T[0][0]) return T[0][1];
  for (let i = 0; i < T.length - 1; i++) if (v <= T[i + 1][0]) return T[i][1] + (T[i + 1][1] - T[i][1]) * (v - T[i][0]) / (T[i + 1][0] - T[i][0]);
  return T[T.length - 1][1];
};
// ... and how much it narrows towards the rounded nose and tail, seen from above
const plan = (z) => 1 - 0.07 * ease((450 - z) / 440) - 0.13 * Math.pow(ease((z - 2450) / 560), 1.5);
const sideX = (y, z) => lerpTable(HW, y) * plan(z);

// --- little geometry helpers (all in mm) -----------------------------------------------------------
const parts = [];
const add = (geo, col) => { parts.push([geo, col]); return geo; };
const bx = (w, h, d, x, y, z, col) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z), col);
function cylAlong(axis, r0, r1, len, x, y, z, col, seg = 16) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  return add(g.translate(x, y, z), col);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** A round bead (trim, seam, shut line) through points [x,y,z]. */
const bead = (pts, r, col, closed = false) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), closed), pts.length * 6, r, 6, closed), col);
/** A bead running down the body's side at z, from y0 to y1, `out` mm proud of it. */
const sideBead = (s, z, y0, y1, r, out, col) => { const pts = []; for (let i = 0; i <= 8; i++) { const y = y0 + (y1 - y0) * i / 8; pts.push([s * (sideX(y, z) + out), y, z]); } return bead(pts, r, col); };
/** A flat polygon (pts as [x,y,z]) facing `out`; used for the windows laid on the cabin. */
function panel(pts, out, col) {
  const P = pts.map((p) => V(...p));
  const n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0]));
  if (n.dot(out) < 0) P.reverse();
  const pos = [];
  for (let i = 1; i < P.length - 1; i++) for (const v of [P[0], P[i], P[i + 1]]) pos.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return add(g, col);
}
/** Extrude a side profile ([z, y] pairs) across the car, centred on x = xc, `w` wide. */
function across(shape, w, bevel, xc = 0, bevelSegments = 4) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: w - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); // shape x → car z, extrusion → −x
  g.translate(w / 2 - bevel + xc, 0, 0);
  return g;
}
/** After bending a geometry about, smooth its normals across shared points, keeping the creases it had. */
function resmooth(g) {
  const p = g.attributes.position, n = g.attributes.normal, key = (i) => `${Math.round(p.getX(i) * 4)},${Math.round(p.getY(i) * 4)},${Math.round(p.getZ(i) * 4)}`;
  const faces = new Map(), a = V(), b = V(), c = V(), fn = [];
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const f = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    for (let k = 0; k < 3; k++) { const kk = key(i + k); if (!faces.has(kk)) faces.set(kk, []); faces.get(kk).push(f); }
  }
  const o = V(), sum = V();
  for (let i = 0; i < p.count; i++) {
    o.fromBufferAttribute(n, i); sum.set(0, 0, 0);
    for (const f of faces.get(key(i))) if (f.clone().normalize().dot(o) > 0.5) sum.add(f);
    if (sum.lengthSq() > 0) { sum.normalize(); n.setXYZ(i, sum.x, sum.y, sum.z); }
  }
  n.needsUpdate = true;
}
/** A band lying `offset` mm out from a (pre-bevel) top line, for the stripes. */
function stripe(line, z0, z1, offset, w, xc) {
  const up = [], down = [], n = 40;
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * i / n, dz = 4;
    const y = lerpTable(line, z), sy = (lerpTable(line, z + dz) - lerpTable(line, z - dz)) / (2 * dz);
    const nz = -sy / Math.hypot(1, sy), ny = 1 / Math.hypot(1, sy);
    up.push(new THREE.Vector2(z + nz * offset, y + ny * offset));
    down.push(new THREE.Vector2(z + nz * (offset - 14), y + ny * (offset - 14)));
  }
  const s = new THREE.Shape([...up, ...down.reverse()]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 2 });
  g.rotateY(-Math.PI / 2); g.translate(w / 2 + xc, 0, 0);
  return g;
}

function buildBody() {
  // the lower body: one side profile with the two wheel arches cut out, rounded off by a deep bevel,
  // then bellied out at the sides and drawn in at the nose and tail
  const pts = [[75, 400]];
  const arch = (zc) => { for (let a = 182; a >= -2; a -= 6.5) { const t = THREE.MathUtils.degToRad(a); pts.push([zc + BODY.arch * Math.cos(t), Math.max(400, BODY.archY + BODY.arch * Math.sin(t))]); } };
  arch(AXLE.r); arch(AXLE.f);
  pts.push([2925, 400], [2950, 425], [2962, 440], [2958, 690], ...TOP.slice().reverse(), [48, 600], [52, 420]);
  const body = add(across(roundedShape(pts, 40), BODY.half * 2, BODY.bevel, 0, 5), C.green);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * sideX(p.getY(i), p.getZ(i)) / BODY.half);
  resmooth(body);
  // what you would see through the arches: the subframes and the wheel wells, in shadow
  for (const z of [AXLE.r, AXLE.f]) bx(1060, 330, 640, 0, 440, z, C.under);
  bx(1100, 160, 2500, 0, 270, (AXLE.r + AXLE.f) / 2, C.under); // the floor pan

  // the cabin: windscreen and rear window raked, the sides leaning in towards the roof
  const cab = roundedShape([[zRearWin(CAB.y0), CAB.y0], [zScreen(CAB.y0), CAB.y0], [zScreen(CAB.y1), CAB.y1], [zRearWin(CAB.y1), CAB.y1]], 90);
  const g = add(across(cab, CAB.half * 2, CAB.bevel), C.green);
  const q = g.attributes.position;
  for (let i = 0; i < q.count; i++) q.setX(i, q.getX(i) * cabHalf(q.getY(i)) / CAB.half);
  resmooth(g);

  // windows: laid just proud of the cabin, which leaves the pillars standing in green
  const yLo = 958, yHi = 1266, eps = 2;
  for (const s of [-1, 1]) {
    const side = (z, y) => [s * (cabHalf(y) + eps), y, z];
    const out = V(s, 0, 0);
    panel([side(1360, yLo), side(zScreen(yLo) - 80, yLo), side(zScreen(yHi) - 80, yHi), side(1360, yHi)], out, C.glass); // door window
    panel([side(zRearWin(yLo) + 95, yLo), side(1290, yLo), side(1290, yHi), side(zRearWin(yHi) + 95, yHi)], out, C.glass); // rear quarter
  }
  const face = (zOf, y, x, dir) => {
    const d = new THREE.Vector2(zOf(y + 1) - zOf(y), 1).normalize(); // up the glass
    const n = new THREE.Vector2(d.y, -d.x).multiplyScalar(dir * (CAB.bevel + eps)); // outward
    return [x, y + n.y, zOf(y) + n.x];
  };
  for (const [zOf, dir] of [[zScreen, 1], [zRearWin, -1]]) {
    const inset = dir > 0 ? 80 : 110, lo = dir > 0 ? 950 : 980, hi = dir > 0 ? 1258 : 1250;
    panel([face(zOf, lo, -cabHalf(lo) + inset, dir), face(zOf, lo, cabHalf(lo) - inset, dir), face(zOf, hi, cabHalf(hi) - inset, dir), face(zOf, hi, -cabHalf(hi) + inset, dir)], V(0, 0, dir), C.glass);
  }
  // drip rails along the roof, and the wipers
  const y1 = CAB.y1, railZ0 = zRearWin(y1) + 40, railZ1 = zScreen(y1) - 40;
  for (const s of [-1, 1]) bead([[s * (cabHalf(y1) + 6), y1 - 16, railZ0], [s * (cabHalf(y1) + 8), y1 - 14, (railZ0 + railZ1) / 2], [s * (cabHalf(y1) + 6), y1 - 16, railZ1]], 8, C.green);
  for (const x of [-330, 170]) { const w = bx(330, 8, 10, x + 80, 0, 0, C.black); w.rotateZ(0.12); w.translate(0, 945, zScreen(945) + 34); }

  // the stripes: twin white bands, 150 mm wide with 70 between them, over the bonnet and the roof
  for (const xc of [-110, 110]) {
    add(stripe(TOP, 2290, 2925, BODY.bevel + 4, 150, xc), C.white);
    const z0 = zRearWin(y1) + 95, z1 = zScreen(y1) - 95;
    bx(150, 10, z1 - z0, xc, y1 + CAB.bevel - 1, (z0 + z1) / 2, C.white);
  }

  for (const s of [-1, 1]) {
    // the outside seams: down the front of the doors, at the back corners and along the sills
    sideBead(s, 2275, 560, 905, 7, 3, C.green);
    sideBead(s, 140, 400, 860, 7, 2, C.green);
    const e = BODY.arch - BODY.bevel, sill = [];
    for (let i = 0; i <= 8; i++) { const z = AXLE.r + e + (AXLE.f - AXLE.r - 2 * e) * i / 8; sill.push([s * (sideX(370, z) + 2), 370, z]); }
    bead(sill, 8, C.green);
    // chrome trims round the wheel arches, as on the Coopers
    for (const zc of [AXLE.r, AXLE.f]) {
      const arc = [];
      for (let a = 178; a >= 2; a -= 8) { const t = THREE.MathUtils.degToRad(a), z = zc + (e + 6) * Math.cos(t), y = BODY.archY + (e + 6) * Math.sin(t); arc.push([s * (sideX(y, z) + 3), y, z]); }
      bead(arc, 9, C.chrome);
    }
    // doors: shut lines, handle and the two hinges on the outside
    sideBead(s, 1345, 360, 905, 4, 1, C.black);
    sideBead(s, 2245, 380, 905, 4, 1, C.black);
    bx(10, 18, 90, s * (sideX(830, 1420) + 6), 830, 1420, C.chrome);
    for (const y of [470, 760]) bx(14, 50, 40, s * (sideX(y, 2262) + 6), y, 2262, C.chrome);
    // the fuel cap on each rear wing, and a mirror on each front wing
    cylAlong('x', 40, 40, 16, s * (sideX(770, 330) + 4), 770, 330, C.chrome);
    const wy = lerpTable(TOP, 2560) + BODY.bevel;
    cylAlong('y', 6, 6, 80, s * 545, wy + 35, 2560, C.chrome, 6);
    cylAlong('z', 40, 40, 20, s * 545, wy + 85, 2555, C.chrome);
  }
}

function buildFront() {
  const zf = 2962 + BODY.bevel; // the front panel's face
  // the grille: a wide chrome "moustache", its top arching up in the middle, slats in the dark behind
  const G = [[-430, 430], [-458, 560], [-425, 640], [-300, 672], [0, 688], [300, 672], [425, 640], [458, 560], [430, 430], [0, 425]];
  const curve = new THREE.CatmullRomCurve3(G.map(([x, y]) => V(x, y, zf + 6)), true);
  add(new THREE.TubeGeometry(curve, 80, 13, 6, true), C.chrome);
  const back = new THREE.ShapeGeometry(new THREE.Shape(curve.getPoints(60).map((v) => new THREE.Vector2(v.x, v.y))));
  add(back.translate(0, 0, zf + 1), C.under);
  const halfAt = (y) => lerpTable([[425, 430], [560, 455], [640, 420], [672, 300], [688, 0]], y);
  for (let y = 455; y < 670; y += 30) { const w = 2 * halfAt(y) - 40; if (w > 60) bx(w, 9, 8, 0, y, zf + 4, C.chrome); }
  for (const s of [-1, 1]) {
    // headlamps standing out of the wings in their pods, sidelights under them
    cylAlong('z', 118, 118, 110, s * 520, 705, zf - 50, C.green, 24);
    cylAlong('z', 100, 100, 40, s * 520, 705, zf + 6, C.chrome, 24);
    cylAlong('z', 86, 86, 40, s * 520, 705, zf + 10, C.lamp, 24);
    cylAlong('z', 32, 32, 30, s * 530, 505, zf + 2, C.amber, 12);
    // overriders
    bx(36, 150, 50, s * 290, 355, zf + 32, C.chrome);
  }
  bead([[-650, 360, zf - 140], [-628, 360, zf + 2], [-520, 360, zf + 20], [0, 360, zf + 28], [520, 360, zf + 20], [628, 360, zf + 2], [650, 360, zf - 140]], 24, C.chrome);
  return zf;
}

function buildRear() {
  const zr = 50 - BODY.bevel;
  for (const s of [-1, 1]) {
    // the small upright tail lamps on the back corners, amber over red, in a chrome surround
    bx(120, 260, 16, s * 585, 610, zr + 4, C.chrome);
    bx(100, 80, 30, s * 585, 690, zr, C.amber);
    bx(100, 150, 30, s * 585, 565, zr, C.red);
    bx(36, 140, 50, s * 290, 345, zr - 30, C.chrome);
  }
  bx(130, 20, 26, 0, 610, zr - 4, C.chrome); // boot handle
  bead([[-650, 340, zr + 140], [-628, 340, zr - 2], [-520, 340, zr - 20], [0, 340, zr - 26], [520, 340, zr - 20], [628, 340, zr - 2], [650, 340, zr + 140]], 24, C.chrome);
  cylAlong('z', 22, 22, 120, -380, 230, zr + 20, C.black, 10); // exhaust
  return zr;
}

function buildWheels() {
  const prof = [[TYRE.rim, -60], [200, -74], [240, -68], [TYRE.r, -44], [TYRE.r, 44], [240, 68], [200, 74], [TYRE.rim, 60]].map(([r, y]) => new THREE.Vector2(r, y));
  for (const [z, track] of [[AXLE.r, TRACK.r], [AXLE.f, TRACK.f]]) for (const s of [-1, 1]) {
    const x = s * (track / 2);
    const tyre = new THREE.LatheGeometry(prof, 28); tyre.rotateZ(Math.PI / 2); tyre.translate(x, AXLE.y, z);
    add(tyre, C.rubber);
    cylAlong('x', TYRE.rim, TYRE.rim, 110, x, AXLE.y, z, C.wheel, 24); // the steel wheel
    cylAlong('x', 62, 50, 22, x + s * 60, AXLE.y, z, C.chrome, 18); // hub cap
    for (let k = 0; k < 8; k++) { // the ring of slots in the wheel
      const a = k * Math.PI / 4;
      bx(4, 22, 22, x + s * 56, AXLE.y + Math.sin(a) * 95, z + Math.cos(a) * 95, C.under);
    }
  }
}

function plateTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const x = c.getContext('2d');
  x.fillStyle = '#16161A'; x.fillRect(0, 0, 512, 112);
  x.strokeStyle = '#C9CCCB'; x.lineWidth = 6; x.strokeRect(5, 5, 502, 102);
  x.fillStyle = '#E4E2DA'; x.font = '700 76px "Arial Narrow", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(PLATE, 256, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** The model on its display base, ready to put on a shelf: origin at the middle of the base's foot. */
export function buildMini() {
  parts.length = 0;
  buildBody(); const zf = buildFront(), zr = buildRear(); buildWheels();
  const geo = merge(parts);
  const mid = (LENGTH.front + LENGTH.rear) / 2;
  geo.translate(0, 0, -mid); // centred on its length
  for (const [g] of parts) g.dispose();
  parts.length = 0;
  const mat = makeInk({ color: '#ffffff', vertexColors: true, wash: 0.82, spacing: 0.0042, hatch: 0.6 });
  const car = new THREE.Mesh(geo, mat);
  car.castShadow = car.receiveShadow = true;

  const model = new THREE.Group();
  car.scale.setScalar(MM);
  model.add(car);
  const plateMat = makeInk({ color: '#ffffff', map: plateTexture(), wash: 0.9, hatch: 0.25 });
  const plate = (z, y, flip) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(520 * MM, 112 * MM), plateMat);
    m.position.set(0, y * MM, z * MM); if (flip) m.rotation.y = Math.PI;
    model.add(m);
  };
  plate(zf + 34 - mid, 262, false);
  plate(zr - 4 - mid, 460, true);

  // the display base: a walnut plinth with a little brass plate on its front edge, under the car's nose
  const g = new THREE.Group();
  const baseH = 0.016, len = (LENGTH.front - LENGTH.rear) * MM + 0.034, wid = 1410 * MM + 0.03;
  const base = new THREE.Mesh(new THREE.BoxGeometry(wid, baseH, len), makeInk({ color: '#7A4A2A', wash: 0.7, wood: 1, grain: new THREE.Vector3(0, 0, 1), grainScale: 3 }));
  base.position.y = baseH / 2; base.castShadow = base.receiveShadow = true; g.add(base);
  const brass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.001), makeInk({ color: '#B8964A', wash: 0.6 }));
  brass.position.set(0, baseH / 2, len / 2 + 0.0004); g.add(brass);
  model.position.y = baseH;
  g.add(model);
  return g;
}
