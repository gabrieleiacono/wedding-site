// A 1:24 scale model of a classic Mini (the original late-1950s/60s two-door saloon), in British racing
// green with twin white stripes over the bonnet, the roof and the boot lid, on a little black display base.
// It stands on the bookshelf next to the tennis trophy, where the globe used to be.
//
// Drawn from the real car's numbers, in millimetres at full size, then shrunk 24 times: 3054 mm long,
// 1410 wide, 1346 high, 2036 wheelbase, 10-inch wheels (so the model is 127 × 59 × 56 mm). The things
// that make it a Mini are all here: the body seams on the outside (down the front of the doors, behind
// the rear windows and along the sills), the cabin leaning in above the waist, the headlamps standing
// in the front wings, the "moustache" grille, the external door hinges, the twin fuel caps, the drip
// rails along the roof and the little upright tail lamps.
//
// Built in the car's own frame (z forward, x to the car's left, y up, y = 0 under the tyres) and merged
// into one vertex-coloured mesh; only the number plates are separate, for their drawn text.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { roundedShape } from './room.js';
import { merge } from './geo.js';

export const MINI_SCALE = 1 / 24;
const MM = MINI_SCALE / 1000; // full-size millimetres → metres in the room

const C = {
  green: '#1F4A33', white: '#F1EDE1', chrome: '#C9CCCB', black: '#232226', rubber: '#1C1B1E',
  glass: '#3C4C55', wheel: '#B9BBB8', red: '#B5372B', amber: '#E0943A', lamp: '#EFEBD8', under: '#2A2A2C',
};
const PLATE = 'GP 2027';

// --- the body's measurements (mm) ----------------------------------------------------------------
const AXLE = { r: 480, f: 2516, y: 243 }; // wheel centres along z, and their height
const TRACK = { f: 1205, r: 1164 };
const TYRE = { r: 243, w: 145, rim: 128 };
const BODY = { half: 705, bevel: 45, arch: 318 }; // arch radius before the bevel narrows it
const CAB = { half: 620, bevel: 22, y0: 905, y1: 1330, lean: 0.12 }; // the cabin, and how far it leans in
// where the windscreen and the rear window meet the cabin's sides, along z, by height
const zScreen = (y) => 2240 - (y - CAB.y0) * (270 / (CAB.y1 - CAB.y0));
const zRearWin = (y) => 450 + (y - CAB.y0) * (110 / (CAB.y1 - CAB.y0));
const cabHalf = (y) => CAB.half * (1 - CAB.lean * Math.min(1, Math.max(0, (y - CAB.y0) / (CAB.y1 - CAB.y0))));
// the top of the lower body, rear to front (before the bevel): boot lid, waist, scuttle, bonnet, nose
const TOP = [[90, 860], [300, 885], [380, 895], [2260, 895], [2450, 868], [2750, 825], [2920, 785], [2985, 735]];

// --- little geometry helpers (all in mm) -----------------------------------------------------------
const parts = [];
const add = (geo, col) => { parts.push([geo, col]); return geo; };
const bx = (w, h, d, x, y, z, col) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z), col);
function cylAlong(axis, r0, r1, len, x, y, z, col, seg = 16) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  return add(g.translate(x, y, z), col);
}
/** A flat polygon (pts as [x,y,z]) facing `out`; used for the windows laid on the cabin. */
function panel(pts, out, col) {
  const P = pts.map((p) => new THREE.Vector3(...p));
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
function across(shape, w, bevel, xc = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: w - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: bevel > 20 ? 4 : 2, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); // shape x → car z, extrusion → −x
  g.translate(w / 2 - bevel + xc, 0, 0);
  return g;
}
/** A band lying `lift` mm proud of a (pre-bevel) top line, for the stripes. */
function stripe(line, z0, z1, offset, w, xc) {
  const at = (z) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [za, ya] = line[i], [zb, yb] = line[i + 1];
      if (z >= za && z <= zb) return ya + (yb - ya) * (z - za) / (zb - za);
    }
    return line[z < line[0][0] ? 0 : line.length - 1][1];
  };
  const up = [], down = [], n = 40;
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * i / n, dz = 4;
    const y = at(z), sy = (at(z + dz) - at(z - dz)) / (2 * dz);
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
  // the lower body: one side profile with the two wheel arches cut out, rounded off by a deep bevel
  const pts = [[60, 250]];
  const arch = (zc) => { for (let a = 178.8; a >= 1.2; a -= 7) { const t = THREE.MathUtils.degToRad(a); pts.push([zc + BODY.arch * Math.cos(t), Math.max(250, AXLE.y + BODY.arch * Math.sin(t))]); } };
  arch(AXLE.r); arch(AXLE.f);
  pts.push([2970, 250], [3000, 320], [3005, 600], ...TOP.slice().reverse(), [55, 680], [52, 320]);
  add(across(roundedShape(pts, 40), BODY.half * 2, BODY.bevel), C.green);
  // what you would see through the arches: the subframes and the wheel wells, in shadow
  for (const z of [AXLE.r, AXLE.f]) bx(1060, 330, 620, 0, 430, z, C.under);

  // the cabin: windscreen and rear window raked, the sides leaning in towards the roof
  const cab = roundedShape([[zRearWin(CAB.y0), CAB.y0], [zScreen(CAB.y0), CAB.y0], [zScreen(CAB.y1), CAB.y1], [zRearWin(CAB.y1), CAB.y1]], 70);
  const g = add(across(cab, CAB.half * 2, CAB.bevel), C.green);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * cabHalf(p.getY(i)) / CAB.half);
  g.computeVertexNormals();

  // windows: laid just proud of the cabin, which leaves the pillars standing in green
  const yLo = 965, yHi = 1262, eps = 2;
  for (const s of [-1, 1]) {
    const side = (z, y) => [s * (cabHalf(y) + eps), y, z];
    const out = new THREE.Vector3(s, 0, 0);
    panel([side(1345, yLo), side(zScreen(yLo) - 85, yLo), side(zScreen(yHi) - 85, yHi), side(1345, yHi)], out, C.glass); // door window
    panel([side(zRearWin(yLo) + 95, yLo), side(1250, yLo), side(1250, yHi), side(zRearWin(yHi) + 95, yHi)], out, C.glass); // rear quarter
  }
  const face = (zOf, y, x, dir) => {
    const d = new THREE.Vector2(zOf(y + 1) - zOf(y), 1).normalize(); // up the glass
    const n = new THREE.Vector2(d.y, -d.x).multiplyScalar(dir * (CAB.bevel + eps)); // outward
    return [x, y + n.y, zOf(y) + n.x];
  };
  for (const [zOf, dir] of [[zScreen, 1], [zRearWin, -1]]) {
    const inset = dir > 0 ? 75 : 95, lo = dir > 0 ? 950 : 975, hi = dir > 0 ? 1262 : 1255;
    panel([face(zOf, lo, -cabHalf(lo) + inset, dir), face(zOf, lo, cabHalf(lo) - inset, dir), face(zOf, hi, cabHalf(hi) - inset, dir), face(zOf, hi, -cabHalf(hi) + inset, dir)], new THREE.Vector3(0, 0, dir), C.glass);
  }
  // drip rails along the roof, and the wipers
  for (const s of [-1, 1]) bx(14, 16, 1300, s * (cabHalf(CAB.y1) + 8), CAB.y1 - 14, 1265, C.green);
  for (const x of [-330, 170]) { const w = bx(330, 8, 10, x + 80, 0, 0, C.black); w.rotateZ(0.12); w.translate(0, 945, zScreen(945) + 30); }

  // the stripes: twin white bands, 150 mm wide with 70 between them
  for (const xc of [-110, 110]) {
    add(stripe(TOP, 2290, 2940, BODY.bevel + 4, 150, xc), C.white); // bonnet
    add(stripe(TOP, 105, 370, BODY.bevel + 4, 150, xc), C.white); // boot lid
    bx(150, 10, 1240, xc, CAB.y1 + CAB.bevel - 1, 1265, C.white); // roof
  }

  // the outside seams: down the front of the doors, behind the rear windows, and along the sills
  for (const s of [-1, 1]) {
    const x = s * (BODY.half + 4);
    bx(12, 330, 14, x, 715, 2292, C.green);
    bx(12, 300, 14, x, 735, 400, C.green);
    bx(12, 14, AXLE.f - AXLE.r - 2 * BODY.arch + 40, x, 222, (AXLE.r + AXLE.f) / 2, C.green);
    // door: shut lines, handle and the two hinges on the outside
    bx(4, 600, 7, s * (BODY.half + 1), 600, 1330, C.black);
    bx(4, 560, 7, s * (BODY.half + 1), 620, 2250, C.black);
    bx(10, 18, 90, s * (BODY.half + 6), 830, 1410, C.chrome);
    for (const y of [470, 760]) bx(14, 50, 40, s * (BODY.half + 6), y, 2268, C.chrome);
    // twin fuel caps on the rear wings, and a wing mirror at the front of each door
    cylAlong('x', 40, 40, 16, s * (BODY.half + 4), 770, 250, C.chrome);
    cylAlong('y', 6, 6, 90, s * 610, 970, 2400, C.chrome, 6);
    cylAlong('z', 42, 42, 22, s * 610, 1025, 2395, C.chrome);
  }
}

function buildFront() {
  const zf = 3005 + BODY.bevel; // the front panel's face
  // grille: chrome surround with the corners drooping (the "moustache"), slats in the dark
  bx(780, 230, 6, 0, 500, zf - 2, C.under);
  bx(800, 18, 18, 0, 622, zf + 4, C.chrome);
  bx(760, 16, 18, 0, 382, zf + 4, C.chrome);
  for (const s of [-1, 1]) { bx(18, 250, 18, s * 400, 500, zf + 4, C.chrome); const m = bx(160, 18, 18, 0, 0, 0, C.chrome); m.rotateZ(s * 0.35); m.translate(s * 470, 600, zf - 4); }
  for (let i = 0; i < 6; i++) bx(760, 8, 10, 0, 410 + i * 36, zf + 2, C.chrome);
  for (const s of [-1, 1]) {
    // headlamps standing in the wings, sidelights beneath them
    cylAlong('z', 100, 100, 70, s * 525, 680, zf - 30, C.chrome, 24);
    cylAlong('z', 84, 84, 74, s * 525, 680, zf - 28, C.lamp, 24);
    bx(110, 60, 30, s * 545, 470, zf - 6, C.amber);
    // overriders
    bx(36, 140, 50, s * 290, 350, zf + 30, C.chrome);
  }
  const bumper = new THREE.CatmullRomCurve3([[-640, 340, zf - 120], [-620, 340, zf + 5], [-520, 340, zf + 22], [0, 340, zf + 28], [520, 340, zf + 22], [620, 340, zf + 5], [640, 340, zf - 120]].map((p) => new THREE.Vector3(...p)));
  add(new THREE.TubeGeometry(bumper, 40, 24, 8), C.chrome);
}

function buildRear() {
  const zr = 52 - BODY.bevel;
  for (const s of [-1, 1]) {
    // the small upright tail lamps, red over amber
    bx(110, 170, 30, s * 590, 610, zr + 4, C.red);
    bx(110, 60, 30, s * 590, 490, zr + 4, C.amber);
    bx(130, 250, 20, s * 590, 575, zr + 8, C.chrome);
    bx(36, 130, 50, s * 290, 345, zr - 30, C.chrome);
  }
  bx(130, 20, 20, 0, 640, zr - 2, C.chrome); // boot handle
  const bumper = new THREE.CatmullRomCurve3([[-640, 330, zr + 120], [-620, 330, zr - 5], [-520, 330, zr - 20], [0, 330, zr - 26], [520, 330, zr - 20], [620, 330, zr - 5], [640, 330, zr + 120]].map((p) => new THREE.Vector3(...p)));
  add(new THREE.TubeGeometry(bumper, 40, 24, 8), C.chrome);
  // exhaust
  cylAlong('z', 22, 22, 120, -380, 230, zr + 20, C.black, 10);
}

function buildWheels() {
  const prof = [[TYRE.rim, -60], [190, -72], [228, -66], [TYRE.r, -42], [TYRE.r, 42], [228, 66], [190, 72], [TYRE.rim, 60]].map(([r, y]) => new THREE.Vector2(r, y));
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
  buildBody(); buildFront(); buildRear(); buildWheels();
  const geo = merge(parts);
  geo.translate(0, 0, -3054 / 2); // centred on its length
  for (const [g] of parts) g.dispose();
  parts.length = 0;
  const mat = makeInk({ color: '#ffffff', vertexColors: true, wash: 0.82, spacing: 0.0032, hatch: 0.6 });
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
  plate(3005 + BODY.bevel + 30 - 3054 / 2, 262, false);
  plate(52 - BODY.bevel - 3 - 3054 / 2, 450, true);

  // the display base: a walnut plinth with a little brass plate on its front edge, under the car's nose
  const g = new THREE.Group();
  const baseH = 0.012, len = 3054 * MM + 0.03, wid = 1410 * MM + 0.026;
  const base = new THREE.Mesh(new THREE.BoxGeometry(wid, baseH, len), makeInk({ color: '#7A4A2A', wash: 0.7, wood: 1, grain: new THREE.Vector3(0, 0, 1), grainScale: 3 }));
  base.position.y = baseH / 2; base.castShadow = base.receiveShadow = true; g.add(base);
  const brass = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.001), makeInk({ color: '#B8964A', wash: 0.6 }));
  brass.position.set(0, baseH / 2, len / 2 + 0.0004); g.add(brass);
  model.position.y = baseH;
  g.add(model);
  return g;
}
