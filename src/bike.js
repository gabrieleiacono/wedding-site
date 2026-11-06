// The bike in the south-east corner, between the TV and the bookshelf: a 1990s Wheeler 2100
// Pro Line, cro-mo steel, in neon yellow with black paint splatter. Drawn from photos of real 2100s
// (sale listings and a video): WHEELER in black with a red shadow down the down tube, 2100 up the
// seat tube, "Pro Line" in script on the top tube, rigid black fork, cantilever brakes, triple
// chainset and the rear-mounted kickstand it stands on. The real ones came with black mudguards
// and a rear rack; this one has had them taken off, as a mountain bike.
//
// Built in the bike's own frame (x forward, y up, z to the right, the chain side; y = 0 is the floor)
// and merged into a few draws: the frame (one texture with splatter and decals), every other fixed
// part (vertex colours), the spokes (lines), the chain, the crank set and the two pedals. Only the
// last three move, and only when you tap the bike: the pedals spin back one turn (see spin()).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { ROOM } from './room.js';
import { merge, rng } from './geo.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const deg = THREE.MathUtils.degToRad;

// --- geometry (metres): 26" wheels, 20" frame, 71° head and 73° seat angles ---------------------
const R = V(0, 0.33), F = V(1.06, 0.33), BB = V(0.425, 0.295);
const AX = V(-Math.cos(deg(71)), Math.sin(deg(71))); // steering axis, pointing up
const AXN = V(AX.y, -AX.x); // perpendicular to it, forward
const SD = V(-Math.cos(deg(73)), Math.sin(deg(73))); // seat tube, pointing up
const CROWN = F.clone().addScaledVector(AXN, -0.045).addScaledVector(AX, 0.405);
const HT0 = CROWN.clone().addScaledVector(AX, 0.025), HT1 = HT0.clone().addScaledVector(AX, 0.14);
const onST = (l) => BB.clone().addScaledVector(SD, l);
const ST1 = onST(0.53), TT0 = HT1.clone().addScaledVector(AX, -0.024), TT1 = onST(0.505);
const DT0 = HT0.clone().addScaledVector(AX, 0.03), SS0 = onST(0.488);
const TYRE = { r: 0.305, t: 0.027 }, RIM = 0.2795;
const CRANK = 0.17, CRANK_ANGLE = deg(-35);
const STEER = 0.3, LEAN = deg(8), YAW = deg(4);
const CHAIN_PITCH = 0.0127, MID_TEETH = 38;
// Tapping the bike pushes the pedals back: from rest one tap carries them one turn (SPIN.turns) before
// friction (DRAG: dw/dt = -k w - c) stops them; taps add up to SPIN.maxPushes pushes of speed. The
// freewheel's sprocket turns `ratio` times for each turn of the cranks and clicks `ratchet` times a turn.
// Taps faster than SPAM (more than `rate` a second, averaged over `window` seconds) throw the chain off.
const SPIN = { turns: 1, ratio: 2, ratchet: 24, maxPushes: 3.2 };
const DRAG = { k: 1.5, c: 1.8 };
const SPAM = { rate: 5, window: 1.5 };

const C = {
  yellow: '#DCEB2A', black: '#242327', rubber: '#1D1C1F', dark: '#3A393E', silver: '#C3C5C6',
  chain: '#77777A', orange: '#E8892B', red: '#C2302A', white: '#EDEBE4', clear: '#B7C1BD',
};

// --- helpers --------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
/** A cylinder from a to b (radius r0 at a, r1 at b) whose u = 0.5 seam-free side faces `side`. */
function rod(a, b, r0, r1 = r0, seg = 12, side = V(0, 0, 1), open = false) {
  const L = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, open);
  g.translate(0, L / 2, 0);
  const t = b.clone().sub(a).normalize();
  let s = side.clone().addScaledVector(t, -side.dot(t));
  if (s.lengthSq() < 1e-6) s = Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  s.normalize();
  const w = new THREE.Vector3().crossVectors(t, s);
  g.applyMatrix4(_m.makeBasis(w.negate(), t, s.clone().negate()).setPosition(a));
  g.userData.L = L; g.userData.circ = Math.PI * (r0 + r1);
  return g;
}
function pipe(points, r, seg = 24, rs = 6, closed = false) {
  const c = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(c, seg, r, rs, closed);
}
function boxAt(w, h, d, x, y, z, rz = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
}
/** A ring lying in the wheel plane (axis z) from a lathe profile of [radius, z] pairs. */
function wheelLathe(profile, seg, x, y, z = 0) {
  const g = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  return g.rotateX(Math.PI / 2).translate(x, y, z);
}
/** A flat outline (in the x/y plane) extruded `depth` along z, centred on z. */
function flat(shape, depth, z = 0, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 12 });
  return g.translate(0, 0, z - depth / 2);
}
function toothedRing(teeth, rIn, depth, cx, cy, z) {
  const pitchR = 0.0127 / (2 * Math.sin(Math.PI / teeth));
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2, r = i % 2 ? pitchR - 0.003 : pitchR + 0.0035;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(hole);
  return flat(s, depth, z).translate(cx, cy, 0);
}

// --- the frame's paint: one texture, a band per tube, splatter everywhere, decals on both sides ---
const BANDS = ['dt', 'st', 'tt', 'ht', 'csR', 'csL', 'ssR', 'ssL', 'bb', 'misc'];
const TEX_W = 1024, BAND_H = 128;
function framePaint(tubes) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = BAND_H * BANDS.length;
  const x = c.getContext('2d');
  x.fillStyle = C.yellow; x.fillRect(0, 0, c.width, c.height);
  const r = rng(2100);
  // black splatter: specks of 0.6-3 mm, about four per square centimetre, drawn round on the tube
  for (const [name, t] of Object.entries(tubes)) {
    const b = BANDS.indexOf(name), kx = TEX_W / t.L, ky = BAND_H / t.circ;
    const n = Math.round(t.L * t.circ * 40000);
    x.fillStyle = '#141414';
    for (let i = 0; i < n; i++) {
      const s = Math.pow(r(), 2.2) * 0.0013 + 0.0003;
      const px = r() * TEX_W, py = b * BAND_H + r() * BAND_H;
      x.beginPath(); x.ellipse(px, py, Math.max(0.7, s * kx), Math.max(0.7, s * ky), r() * 3, 0, Math.PI * 2); x.fill();
      if (r() < 0.12) { x.beginPath(); x.ellipse(px + (r() - 0.5) * 3 * s * kx, py + (r() - 0.5) * 3 * s * ky, s * kx * 0.4, s * ky * 0.4, 0, 0, Math.PI * 2); x.fill(); }
    }
  }
  /**
   * Put a decal on a tube. `along` is metres from the tube's start, `around` metres round from the
   * chain side (0) towards the tube's u; `rx/ry` are the decal's right and down directions as
   * [along, around] unit vectors; w/h its size in metres.
   */
  const put = (name, img, along, around, w, h, rx, ry) => {
    const t = tubes[name], b = BANDS.indexOf(name), kx = TEX_W / t.L, ky = BAND_H / t.circ;
    for (const wrap of [0, -t.circ, t.circ]) {
      const ar = around + wrap;
      if (Math.abs(ar) > t.circ * 0.5 + Math.max(w, h)) continue;
      x.save();
      x.beginPath(); x.rect(0, b * BAND_H, TEX_W, BAND_H); x.clip();
      const sx = w / img.width, sy = h / img.height;
      const ox = along - (rx[0] * w + ry[0] * h) / 2, oy = ar - (rx[1] * w + ry[1] * h) / 2;
      x.setTransform(kx * rx[0] * sx, ky * rx[1] * sx, kx * ry[0] * sy, ky * ry[1] * sy, kx * ox, b * BAND_H + BAND_H / 2 + ky * oy);
      x.drawImage(img, 0, 0);
      x.restore();
    }
  };
  // `near` is the chain side's [right, down], `far` the other side's: each reads left to right and
  // upright to someone standing on that side (WHEELER from the bottom bracket up on the chain side,
  // from the head tube down on the other, as on the real frames; 2100 from the bottom up)
  const both = (name, img, along, w, h, near, far) => {
    put(name, img, along, 0, w, h, ...near);
    put(name, img, along, tubes[name].circ / 2, w, h, ...far);
  };
  // [right, down] of each decal as [along, around]; worked out from the tube frames in rod()
  const DT_NEAR = [[-1, 0], [0, -1]], DT_FAR = [[1, 0], [0, 1]];
  both('dt', label('WHEELER', 'block'), 0.27, 0.27, 0.036, DT_NEAR, DT_FAR);
  both('dt', label('', 'oval'), 0.075, 0.034, 0.016, DT_NEAR, DT_FAR);
  both('st', label('2100', 'block'), 0.33, 0.12, 0.03, [[1, 0], [0, 1]], [[1, 0], [0, 1]]); // bottom to top on both sides
  both('st', label('', 'chip'), 0.07, 0.012, 0.012, [[1, 0], [0, 1]], [[1, 0], [0, 1]]);
  both('tt', label('Pro Line', 'script'), 0.425, 0.105, 0.028, [[-1, 0], [0, -1]], [[1, 0], [0, 1]]);
  // the head badge, on the front of the head tube, upright to someone facing the bike
  put('ht', label('', 'badge'), 0.07, tubes.ht.circ / 4, 0.03, 0.05, [0, 1], [-1, 0]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
/** The decals, drawn flat before they go on the tubes. */
function label(text, kind) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  if (kind === 'block') {
    // heavy condensed capitals in black with a red drop shadow, as on the down and seat tubes
    c.width = text.length > 4 ? 1200 : 480; c.height = 160;
    x.font = `italic 900 150px Impact, "Arial Narrow", "Bricolage Grotesque", sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const sx = (c.width - 30) / Math.max(1, x.measureText(text).width);
    x.save(); x.translate(c.width / 2, c.height / 2); x.scale(Math.min(1.6, sx), 1);
    if ('letterSpacing' in x) x.letterSpacing = '4px';
    x.fillStyle = '#D1342B'; x.fillText(text, 7, 7);
    x.lineWidth = 7; x.strokeStyle = '#D1342B'; x.strokeText(text, 7, 7);
    x.fillStyle = '#111'; x.fillText(text, 0, 0);
    x.restore();
  } else if (kind === 'script') {
    c.width = 512; c.height = 128;
    x.font = 'italic 700 112px Caveat, "Brush Script MT", cursive';
    x.lineWidth = 3; x.strokeStyle = '#111'; x.strokeText(text, 256, 70);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#111';
    x.fillText(text, 256, 70);
  } else if (kind === 'oval') {
    // the little black oval sticker just behind the head tube
    c.width = 256; c.height = 120;
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(128, 60, 124, 56, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = C.silver; x.lineWidth = 5; x.beginPath(); x.ellipse(128, 60, 110, 44, 0, 0, Math.PI * 2); x.stroke();
    x.fillStyle = C.silver; x.font = '700 40px "IBM Plex Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Cr-Mo', 128, 62);
  } else if (kind === 'chip') {
    c.width = 64; c.height = 64; x.fillStyle = '#D23C5A'; x.fillRect(4, 4, 56, 56);
  } else if (kind === 'badge') {
    // the head badge: a little shield with a W
    c.width = 120; c.height = 200;
    x.fillStyle = '#1C3F8C'; x.strokeStyle = C.silver; x.lineWidth = 8;
    x.beginPath(); x.moveTo(10, 10); x.lineTo(110, 10); x.lineTo(110, 120); x.quadraticCurveTo(110, 170, 60, 192); x.quadraticCurveTo(10, 170, 10, 120); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#F2F0EA'; x.font = '900 86px "Bricolage Grotesque", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('W', 60, 92);
  }
  return c;
}

// --- the bike --------------------------------------------------------------------------------------
export function buildBike(room) {
  const parts = []; // [geometry, colour] for the one vertex-coloured mesh
  const lines = []; // spoke end points
  // the front end (fork, front wheel, brake, stem, bars) is turned about the steering axis
  const steerM = new THREE.Matrix4().makeTranslation(CROWN.x, CROWN.y, 0)
    .multiply(new THREE.Matrix4().makeRotationAxis(AX, STEER))
    .multiply(new THREE.Matrix4().makeTranslation(-CROWN.x, -CROWN.y, 0));
  let front = false, bucket = null; // `bucket`: where add() puts parts, if not the fixed ones
  const add = (g, col) => { if (front) g.applyMatrix4(steerM); (bucket || parts).push([g, col]); return g; };

  // frame tubes, in the painted texture
  const tubes = {
    dt: rod(DT0, BB, 0.0159, 0.0159, 16),
    st: rod(BB, ST1, 0.0143, 0.0143, 16),
    tt: rod(TT0, TT1, 0.0143, 0.0143, 16),
    ht: rod(HT0, HT1, 0.019, 0.019, 18),
    csR: rod(V(BB.x - 0.02, BB.y, 0.03), V(R.x + 0.01, R.y, 0.066), 0.011, 0.0075, 10),
    csL: rod(V(BB.x - 0.02, BB.y, -0.03), V(R.x + 0.01, R.y, -0.066), 0.011, 0.0075, 10),
    ssR: rod(V(SS0.x - 0.004, SS0.y, 0.02), V(R.x + 0.012, R.y + 0.012, 0.066), 0.0085, 0.0068, 10),
    ssL: rod(V(SS0.x - 0.004, SS0.y, -0.02), V(R.x + 0.012, R.y + 0.012, -0.066), 0.0085, 0.0068, 10),
    bb: rod(V(BB.x, BB.y, -0.036), V(BB.x, BB.y, 0.036), 0.02, 0.02, 16, V(0, -1, 0)),
  };
  const frameParts = Object.entries(tubes).map(([name, g]) => [g, BANDS.indexOf(name)]);
  const misc = (g) => frameParts.push([g, BANDS.indexOf('misc')]);
  // dropouts, bridges, brake and bottle bosses, cable stops
  for (const z of [-0.068, 0.068]) {
    misc(boxAt(0.04, 0.03, 0.005, R.x + 0.008, R.y + 0.004, z, deg(25)));
    const ss = V(R.x, R.y, z).lerp(V(SS0.x, SS0.y, Math.sign(z) * 0.02), 0.36);
    misc(rod(ss, ss.clone().add(V(0.004, 0.0, Math.sign(z) * 0.016)), 0.004, 0.004, 8)); // cantilever bosses
  }
  misc(rod(V(R.x, R.y, -0.046).lerp(V(SS0.x, SS0.y, -0.02), 0.42), V(R.x, R.y, 0.046).lerp(V(SS0.x, SS0.y, 0.02), 0.42), 0.006, 0.006, 8));
  misc(rod(V(BB.x - 0.12, BB.y + 0.007, -0.038), V(BB.x - 0.12, BB.y + 0.007, 0.038), 0.006, 0.006, 8));
  for (const l of [0.22, 0.34]) { const p = DT0.clone().lerp(BB, l / DT0.distanceTo(BB)); misc(rod(p.clone().add(V(0.004, 0.012)), p.clone().add(V(0.0055, 0.0165)), 0.0035, 0.0035, 6)); }
  misc(rod(TT1.clone().addScaledVector(SD, -0.01), TT1.clone().addScaledVector(SD, 0.03), 0.0158, 0.0158, 16)); // seat lug

  // fork: steerer hidden in the head tube, unicrown, straight blades, cantilever bosses
  front = true;
  const crownL = CROWN.clone().addScaledVector(AX, -0.035);
  for (const z of [-0.048, 0.048]) {
    const top = V(crownL.x, crownL.y, z * 0.8), tip = V(F.x - 0.004, F.y + 0.012, z * 1.04);
    const bend = top.clone().lerp(tip, 0.82).add(V(0.012, 0));
    add(pipe([top, top.clone().lerp(bend, 0.5), bend, tip], 0.0105, 10, 10), C.black);
    add(boxAt(0.028, 0.028, 0.005, F.x - 0.004, F.y + 0.006, z * 1.06, deg(-20)), C.black);
    const boss = top.clone().lerp(bend, 0.42);
    add(rod(boss, boss.clone().add(V(0.004, 0, Math.sign(z) * 0.016)), 0.004, 0.004, 8), C.black);
  }
  add(rod(CROWN.clone().addScaledVector(AX, -0.04), CROWN.clone().addScaledVector(AX, 0.005), 0.024, 0.02, 14, V(0, 0, 1)), C.black);
  // headset cups
  add(rod(HT0.clone().addScaledVector(AX, -0.014), HT0, 0.021, 0.021, 18), C.silver);
  add(rod(HT1, HT1.clone().addScaledVector(AX, 0.02), 0.021, 0.02, 18), C.silver);
  // quill stem, black, rising and reaching forward to the bars
  const Q = HT1.clone().addScaledVector(AX, 0.105), BC = Q.clone().add(V(0.097, 0.026));
  add(rod(HT1.clone().addScaledVector(AX, 0.015), Q, 0.0112, 0.0112, 12), C.black);
  add(rod(Q.clone().addScaledVector(AX, -0.012), BC, 0.012, 0.0115, 12), C.black);
  add(rod(V(BC.x, BC.y, -0.026), V(BC.x, BC.y, 0.026), 0.016, 0.016, 14), C.black);
  // flat bar with a little sweep back, grips, brake levers and twist shifters, a bell, the reflector
  const barPts = [-1, -0.62, -0.2, 0, 0.2, 0.62, 1].map((k) => V(BC.x - 0.03 * k * k, BC.y + 0.004 * Math.abs(k), 0.29 * k));
  add(pipe(barPts, 0.0111, 40, 10), C.black);
  for (const s of [-1, 1]) {
    const g0 = V(BC.x - 0.03 * 0.39, BC.y, 0.18 * s), g1 = V(BC.x - 0.03, BC.y + 0.004, 0.295 * s);
    add(rod(g0, g1, 0.016, 0.0165, 14), C.rubber);
    add(rod(V(BC.x - 0.008, BC.y, 0.148 * s), V(BC.x - 0.009, BC.y, 0.178 * s), 0.0195, 0.0195, 14), C.dark); // twist shifter
    add(rod(V(BC.x - 0.006, BC.y, 0.13 * s), V(BC.x - 0.006, BC.y, 0.146 * s), 0.017, 0.017, 10), C.black); // lever clamp
    const lv = [V(BC.x + 0.005, BC.y - 0.004, 0.145 * s), V(BC.x + 0.035, BC.y - 0.012, 0.17 * s), V(BC.x + 0.045, BC.y - 0.022, 0.22 * s), V(BC.x + 0.04, BC.y - 0.026, 0.25 * s)];
    add(pipe(lv, 0.0045, 12, 6), C.black);
    add(boxAt(0.02, 0.012, 0.014, BC.x - 0.006, BC.y + 0.016, 0.163 * s), C.dark); // shifter barrel
  }
  add(new THREE.SphereGeometry(0.02, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(BC.x + 0.012, BC.y + 0.016, -0.075), C.silver); // bell
  add(boxAt(0.006, 0.05, 0.03, BC.x + 0.035, BC.y - 0.035, 0), C.white); // front reflector
  add(boxAt(0.03, 0.006, 0.012, BC.x + 0.02, BC.y - 0.008, 0), C.dark);
  front = false;

  // saddle and seatpost
  const SP = ST1.clone().addScaledVector(SD, 0.17);
  add(rod(ST1.clone().addScaledVector(SD, -0.03), SP, 0.0135, 0.0135, 14), C.silver);
  add(rod(V(SP.x - 0.012, SP.y, -0.02), V(SP.x - 0.012, SP.y, 0.02), 0.012, 0.012, 10), C.silver); // clamp
  {
    const s = new THREE.Shape();
    s.moveTo(0.14, 0); s.bezierCurveTo(0.14, 0.03, 0.05, 0.035, 0.0, 0.06);
    s.bezierCurveTo(-0.06, 0.08, -0.12, 0.085, -0.13, 0.05); s.bezierCurveTo(-0.14, 0.02, -0.14, -0.02, -0.13, -0.05);
    s.bezierCurveTo(-0.12, -0.085, -0.06, -0.08, 0.0, -0.06); s.bezierCurveTo(0.05, -0.035, 0.14, -0.03, 0.14, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 3, curveSegments: 14 });
    // lie it flat (extrusion up), crown the top a little and tip the nose up a touch
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      // a domed top, a plump back and a nose that slims and dips
      const zz = p.getZ(i), yy = p.getY(i), xx = p.getX(i), nose = THREE.MathUtils.smoothstep(xx, -0.02, 0.15);
      const top = yy > 0.02 ? 0.012 * (1 - Math.min(1, (zz / 0.09) ** 2)) - 0.02 * nose : 0.008 * nose;
      p.setY(i, yy + top + 0.006 * THREE.MathUtils.smoothstep(-xx, 0.05, 0.14));
    }
    g.computeVertexNormals();
    g.rotateZ(deg(3)).translate(SP.x - 0.025, SP.y + 0.024, 0);
    add(g, C.black);
    for (const z of [-0.028, 0.028]) add(pipe([V(SP.x + 0.1, SP.y + 0.03, z * 0.4), V(SP.x + 0.02, SP.y + 0.012, z), V(SP.x - 0.08, SP.y + 0.014, z), V(SP.x - 0.13, SP.y + 0.03, z * 1.6)], 0.0035, 12, 5), C.silver); // rails
  }

  // wheels: knobbly 26 x 1.95 tyres, silver box-section rims, hubs, 36 spokes laced three-cross
  const wheel = (c, rear) => {
    const tyre = [];
    for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + (i / 14) * Math.PI * 2; tyre.push([TYRE.r + Math.cos(a) * TYRE.t, Math.sin(a) * TYRE.t * 0.92]); }
    const g = wheelLathe(tyre, 120, c.x, c.y);
    // knobs: a raised block pattern on the tread and shoulders
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const dx = v.x - c.x, dy = v.y - c.y, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (rr < TYRE.r + 0.004) continue;
      const k = Math.floor((a / (Math.PI * 2) + 1) * 60), lat = v.z / TYRE.t;
      const centre = Math.abs(lat) < 0.35, shoulder = Math.abs(lat) > 0.45 && Math.abs(lat) < 0.95;
      const on = (centre && k % 2 === 0) || (shoulder && k % 2 === 1);
      if (on) { const out = 0.0045 * Math.min(1, (rr - TYRE.r - 0.004) / 0.01); p.setXYZ(i, c.x + dx / rr * (rr + out), c.y + dy / rr * (rr + out), v.z); }
    }
    g.computeVertexNormals();
    add(g, C.rubber);
    add(wheelLathe([[RIM - 0.019, -0.008], [RIM - 0.006, -0.0105], [RIM + 0.002, -0.0115], [RIM + 0.0025, -0.009], [RIM - 0.002, -0.008], [RIM - 0.002, 0.008], [RIM + 0.0025, 0.009], [RIM + 0.002, 0.0115], [RIM - 0.006, 0.0105], [RIM - 0.019, 0.008], [RIM - 0.019, -0.008]], 72, c.x, c.y), C.silver);
    // hub with its flanges, axle and quick-release lever
    const fl = rear ? [-0.033, 0.022] : [-0.035, 0.035];
    add(rod(V(c.x, c.y, -0.05), V(c.x, c.y, 0.05), 0.0045, 0.0045, 8), C.silver);
    add(rod(V(c.x, c.y, fl[0]), V(c.x, c.y, fl[1]), 0.012, 0.012, 14), C.silver);
    for (const z of fl) add(rod(V(c.x, c.y, z - 0.002), V(c.x, c.y, z + 0.002), 0.024, 0.024, 18), C.silver);
    add(boxAt(0.05, 0.007, 0.004, c.x - 0.02, c.y - 0.004, -0.058, deg(rear ? 160 : 200)), C.silver);
    for (let i = 0; i < 36; i++) {
      const side = i % 2, dir = Math.floor(i / 2) % 2 ? 1 : -1;
      const ar = (i / 36) * Math.PI * 2, ah = ar + dir * deg(60);
      const zr = side ? 0.003 : -0.003, zh = fl[side];
      lines.push(V(c.x + Math.cos(ah) * 0.021, c.y + Math.sin(ah) * 0.021, zh), V(c.x + Math.cos(ar) * (RIM - 0.017), c.y + Math.sin(ar) * (RIM - 0.017), zr));
    }
    // an orange spoke reflector
    const ra = rear ? deg(200) : deg(-35);
    add(boxAt(0.055, 0.026, 0.012, c.x + Math.cos(ra) * 0.19, c.y + Math.sin(ra) * 0.19, 0.0, ra), C.orange);
  };
  front = true; const f0 = lines.length; wheel(F, false);
  for (let i = f0; i < lines.length; i++) lines[i].applyMatrix4(steerM);
  front = false; wheel(R, true);

  // drivetrain: three chainrings behind a black guard ring, cranks, pedals, freewheel, derailleurs, chain.
  // The chainrings, spider, axle and cranks turn together about the bottom bracket, each pedal goes
  // round with its crank and turns back to stay level, and the chain runs round with the rings (see
  // crankTo below), so those parts are collected apart from the fixed ones.
  const crankParts = [], pedalParts = [[], []], pedalPivot = [];
  bucket = crankParts;
  add(toothedRing(48, 0.07, 0.003, BB.x, BB.y, 0.062), C.silver);
  add(toothedRing(38, 0.055, 0.003, BB.x, BB.y, 0.055), C.silver);
  add(toothedRing(28, 0.034, 0.003, BB.x, BB.y, 0.048), C.silver);
  {
    const s = new THREE.Shape(); s.absarc(0, 0, 0.112, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, 0.101, 0, Math.PI * 2, true); s.holes.push(h);
    add(flat(s, 0.004, 0.068).translate(BB.x, BB.y, 0), C.black);
    for (let i = 0; i < 5; i++) { const a = CRANK_ANGLE + i * deg(72); add(boxAt(0.06, 0.012, 0.005, BB.x + Math.cos(a) * 0.035, BB.y + Math.sin(a) * 0.035, 0.064, a), C.silver); } // spider
  }
  add(rod(V(BB.x, BB.y, -0.075), V(BB.x, BB.y, 0.075), 0.009, 0.009, 10), C.silver);
  [-1, 1].forEach((s, i) => {
    const a = s > 0 ? CRANK_ANGLE : CRANK_ANGLE + Math.PI, z = s * 0.077;
    const end = V(BB.x + Math.cos(a) * CRANK, BB.y + Math.sin(a) * CRANK, z + s * 0.006);
    add(rod(V(BB.x, BB.y, z), end, 0.011, 0.007, 10, V(0, 0, 1)), C.silver);
    add(rod(end, end.clone().add(V(0, 0, s * 0.03)), 0.005, 0.005, 8), C.silver);
    // a black platform pedal with orange reflectors front and back, on its own so it can stay level
    bucket = pedalParts[i]; pedalPivot[i] = end;
    const pc = end.clone().add(V(0, 0, s * 0.06));
    for (const dx of [-0.032, 0.032]) add(boxAt(0.008, 0.022, 0.095, pc.x + dx, pc.y, pc.z), C.black);
    for (const dz of [-0.044, 0.044]) add(boxAt(0.07, 0.018, 0.008, pc.x, pc.y, pc.z + dz), C.black);
    add(boxAt(0.06, 0.008, 0.012, pc.x, pc.y, pc.z), C.black);
    for (const dx of [-0.037, 0.037]) add(boxAt(0.003, 0.01, 0.035, pc.x + dx, pc.y, pc.z), C.orange);
    bucket = crankParts;
  });
  bucket = null;
  // seven-speed freewheel
  for (let i = 0; i < 7; i++) {
    const t = 28 - i * 3, r = 0.0127 / (2 * Math.sin(Math.PI / t)) + 0.002, z = 0.031 + i * 0.0048;
    add(rod(V(R.x, R.y, z - 0.0013), V(R.x, R.y, z + 0.0013), r, r, Math.max(16, t)), C.silver);
  }
  // rear derailleur: hanger, parallelogram body, cage with two jockey wheels
  const J1 = V(R.x - 0.006, R.y - 0.062, 0.05), J2 = V(R.x + 0.024, R.y - 0.124, 0.05);
  add(boxAt(0.03, 0.04, 0.012, R.x - 0.016, R.y - 0.028, 0.072, deg(-30)), C.silver);
  add(boxAt(0.035, 0.016, 0.02, R.x - 0.02, R.y - 0.05, 0.066, deg(-60)), C.dark);
  for (const z of [0.043, 0.058]) add(pipe([J1.clone().setZ(z).add(V(-0.004, 0.012)), J1.clone().setZ(z), J2.clone().setZ(z), J2.clone().setZ(z).add(V(0.012, -0.004))], 0.006, 8, 4), C.silver);
  for (const j of [J1, J2]) add(rod(V(j.x, j.y, 0.046), V(j.x, j.y, 0.055), 0.0155, 0.0155, 14), C.dark);
  // front derailleur cage on the seat tube, over the big ring
  const fd = onST(0.135);
  add(boxAt(0.05, 0.022, 0.004, fd.x + 0.025, fd.y - 0.012, 0.067, deg(-12)), C.silver);
  add(boxAt(0.05, 0.022, 0.004, fd.x + 0.025, fd.y - 0.012, 0.05, deg(-12)), C.silver);
  add(rod(V(fd.x, fd.y + 0.012, -0.017), V(fd.x, fd.y + 0.012, 0.017), 0.017, 0.017, 12), C.silver);
  // the chain, on the middle ring and a middle sprocket, wrapping round both jockey wheels
  let chainPts;
  {
    const rc = 0.0127 / (2 * Math.sin(Math.PI / 38)), rg = 0.0127 / (2 * Math.sin(Math.PI / 19)), zc = 0.052;
    const pts = [];
    for (const a of [90, 135, 180, 225]) pts.push(V(R.x + Math.cos(deg(a)) * rg, R.y + Math.sin(deg(a)) * rg, zc - 0.006));
    for (const a of [160, 230]) pts.push(V(J1.x + Math.cos(deg(a)) * 0.017, J1.y + Math.sin(deg(a)) * 0.017, zc - 0.002));
    for (const a of [170, 230, 290]) pts.push(V(J2.x + Math.cos(deg(a)) * 0.017, J2.y + Math.sin(deg(a)) * 0.017, zc - 0.002));
    for (const a of [-90, -45, 0, 45, 90]) pts.push(V(BB.x + Math.cos(deg(a)) * rc, BB.y + Math.sin(deg(a)) * rc, zc));
    pts.push(V((BB.x + R.x) / 2, (BB.y + rc + R.y + rg) / 2, zc - 0.003));
    chainPts = pts;
  }

  // cantilever brakes: two black arms per wheel, a straddle wire and its yoke
  const canti = (bosses, yoke) => {
    for (const [b, s] of bosses) {
      const tip = b.clone().add(V(0.018, 0.045, s * 0.05));
      add(rod(b, tip, 0.006, 0.005, 8), C.black);
      add(boxAt(0.02, 0.008, 0.012, b.x + 0.012, b.y + 0.005, b.z - s * 0.005), C.dark); // pad
      add(rod(tip, yoke, 0.0012, 0.0012, 4), C.dark);
    }
    add(boxAt(0.012, 0.016, 0.01, yoke.x, yoke.y, 0), C.silver);
  };
  front = true;
  {
    const bosses = [-1, 1].map((s) => { const top = V(crownL.x, crownL.y, s * 0.038), tip = V(F.x - 0.004, F.y + 0.012, s * 0.05); const bend = top.clone().lerp(tip, 0.82).add(V(0.012, 0)); return [top.clone().lerp(bend, 0.42).add(V(0, 0, s * 0.016)), s]; });
    canti(bosses, V(bosses[0][0].x + 0.04, bosses[0][0].y + 0.09, 0));
    const hanger = HT0.clone().addScaledVector(AX, 0.005).add(V(0.03, 0));
    add(boxAt(0.012, 0.03, 0.01, hanger.x, hanger.y, 0, deg(-19)), C.silver);
    add(pipe([V(BC.x + 0.04, BC.y - 0.015, -0.15), V(BC.x + 0.16, BC.y - 0.06, -0.09), V(hanger.x + 0.04, hanger.y + 0.08, 0), V(hanger.x, hanger.y + 0.01, 0)], 0.0025, 24, 5), C.black);
  }
  front = false;
  {
    const bosses = [-1, 1].map((s) => [V(R.x, R.y, s * 0.068).lerp(V(SS0.x, SS0.y, s * 0.02), 0.36).add(V(0.004, 0, s * 0.016)), s]);
    const yk = bosses[0][0].clone().add(V(0.04, 0.085)); yk.z = 0;
    canti(bosses, yk);
    // rear brake and both gear cables: from the bars, along the top tube and down tube
    const ttUp = (k) => TT0.clone().lerp(TT1, k).add(V(0, 0.017, 0));
    add(pipe([V(BC.x + 0.02, BC.y, 0.15).applyMatrix4(steerM), V(BC.x + 0.13, BC.y - 0.05, 0.07), V(TT0.x + 0.05, TT0.y + 0.12, 0.02), ttUp(0.08), ttUp(0.5), ttUp(0.94), V(SS0.x - 0.03, SS0.y + 0.015, 0), V(yk.x + 0.004, yk.y + 0.02, 0)], 0.0022, 60, 4), C.black);
    for (const s of [-1, 1]) {
      const dtp = (k) => DT0.clone().lerp(BB, k).add(V(-0.004, -0.017, s * 0.006));
      add(pipe([V(BC.x - 0.01, BC.y + 0.016, 0.163 * s).applyMatrix4(steerM), V(BC.x + 0.1, BC.y - 0.07, 0.1 * s), V(DT0.x + 0.07, DT0.y - 0.02, 0.03 * s), dtp(0.12), dtp(0.6), dtp(0.93)], 0.0022, 40, 4), C.black);
    }
    add(pipe([V(BB.x - 0.02, BB.y - 0.022, 0.012), V(BB.x - 0.2, BB.y + 0.01, 0.045), V(R.x + 0.06, R.y + 0.0, 0.07), V(R.x - 0.01, R.y - 0.035, 0.08)], 0.0022, 30, 4), C.black);
    add(pipe([V(BB.x - 0.008, BB.y - 0.022, -0.012), V(fd.x - 0.03, fd.y - 0.07, 0.02), V(fd.x - 0.006, fd.y + 0.004, 0.02)], 0.0022, 16, 4), C.black);
  }

  // bottle cage on the down tube: black wire
  {
    const a = DT0.clone().lerp(BB, 0.2), b = DT0.clone().lerp(BB, 0.52), t = b.clone().sub(a).normalize(), nrm = V(-t.y, t.x);
    for (const s of [-1, 1]) add(pipe([a.clone().addScaledVector(nrm, 0.018), a.clone().addScaledVector(nrm, 0.05).add(V(0, 0, s * 0.03)), b.clone().addScaledVector(nrm, 0.058).add(V(0, 0, s * 0.034)), b.clone().addScaledVector(nrm, 0.07).addScaledVector(t, 0.04).add(V(0, 0, s * 0.02)), b.clone().addScaledVector(t, 0.04).addScaledVector(nrm, 0.02)], 0.0022, 24, 4), C.black);
    add(pipe([a.clone().addScaledVector(nrm, 0.05).add(V(0, 0, -0.03)), a.clone().addScaledVector(nrm, 0.07), a.clone().addScaledVector(nrm, 0.05).add(V(0, 0, 0.03))], 0.0022, 10, 4), C.black);
  }

  // rear kickstand on the left chainstay, its foot on the floor of the lean
  {
    const foot = V(0.23, 0, -0.165);
    foot.y = foot.z * Math.tan(-LEAN) + 0.004;
    const top = V(0.1, R.y - 0.004, -0.07);
    add(boxAt(0.05, 0.02, 0.026, top.x + 0.01, top.y, top.z, deg(-12)), C.black);
    add(rod(top, foot, 0.0085, 0.007, 10, V(0, 0, -1)), C.silver);
    add(boxAt(0.035, 0.008, 0.02, foot.x + 0.006, foot.y + 0.002, foot.z), C.rubber);
  }

  // --- meshes ------------------------------------------------------------------------------------
  const outer = new THREE.Group(), bike = new THREE.Group();
  outer.add(bike); room.add(outer);
  // frame: one texture, each tube's uv moved into its band
  const tex = framePaint(Object.fromEntries(Object.entries(tubes).map(([k, g]) => [k, g.userData])));
  const frameGeo = mergeUV(frameParts.map(([g, band]) => {
    const n = g.index ? g.toNonIndexed() : g, uv = n.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      if (band === BANDS.length - 1) uv.setXY(i, 0.5 + uv.getX(i) * 0.01, 1 - (band + 0.5) / BANDS.length);
      else uv.setXY(i, uv.getY(i), 1 - (band + uv.getX(i)) / BANDS.length);
    }
    return n;
  }));
  const frame = new THREE.Mesh(frameGeo, makeInk({ color: '#ffffff', map: tex, wash: 0.88 }));
  const partsMat = makeInk({ color: '#ffffff', vertexColors: true, wash: 0.82, side: THREE.DoubleSide });
  const rest = new THREE.Mesh(merge(parts), partsMat);
  for (const m of [frame, rest]) { m.castShadow = true; m.receiveShadow = true; bike.add(m); }
  const spokes = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: '#3A3836' }));
  spokes.raycast = () => {}; // a line is "hit" within a whole metre by default: never a tap target
  bike.add(spokes);

  // the cranks (with chainrings and spider) and the two pedals, built round their own pivots
  const crank = new THREE.Group(); crank.position.set(BB.x, BB.y, 0); bike.add(crank);
  const around = (list, ox, oy) => {
    const m = new THREE.Mesh(merge(list).translate(-ox, -oy, 0), partsMat);
    m.castShadow = true; m.receiveShadow = true; return m;
  };
  crank.add(around(crankParts, BB.x, BB.y));
  const pedals = pedalParts.map((list, i) => {
    const g = new THREE.Group(); g.position.set(pedalPivot[i].x - BB.x, pedalPivot[i].y - BB.y, 0);
    g.add(around(list, pedalPivot[i].x, pedalPivot[i].y)); crank.add(g); return g;
  });
  // The chain: a tube with a pattern of alternating inner and outer links that runs along it. It is
  // built from points (not a TubeGeometry) so that, when it falls off, those points can be let go and
  // hang and drop as a rope (see fall()).
  const chainCurve = new THREE.CatmullRomCurve3(chainPts, true, 'centripetal');
  const chainLen = chainCurve.getLength(), CN = 128, CS = 6, CR = 0.0038, seg = chainLen / CN;
  const chainTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const x = c.getContext('2d'); x.fillStyle = '#35353A'; x.fillRect(0, 0, 32, 8); x.fillStyle = '#9A9A9E'; x.fillRect(32, 0, 32, 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
    t.repeat.set(Math.round(chainLen / (2 * CHAIN_PITCH)), 1); // one tile = an inner and an outer link
    return t;
  })();
  const chainRest = new Float32Array(CN * 3), chainP = new Float32Array(CN * 3);
  for (let i = 0; i < CN; i++) chainCurve.getPointAt(i / CN).toArray(chainRest, i * 3);
  chainP.set(chainRest);
  const chainGeo = new THREE.BufferGeometry(), RING = CS + 1, VERTS = (CN + 1) * RING;
  chainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3));
  chainGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3));
  {
    const uv = new Float32Array(VERTS * 2), idx = [];
    for (let i = 0; i <= CN; i++) for (let j = 0; j <= CS; j++) { uv[(i * RING + j) * 2] = i / CN; uv[(i * RING + j) * 2 + 1] = j / CS; }
    for (let i = 0; i < CN; i++) for (let j = 0; j < CS; j++) { const a = i * RING + j, b = a + RING; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    chainGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); chainGeo.setIndex(idx);
  }
  const tT = new THREE.Vector3(), tN = new THREE.Vector3(), tB = new THREE.Vector3(), Zr = new THREE.Vector3(0, 0, 1), Yr = new THREE.Vector3(0, 1, 0);
  /** Lay the tube along the points in chainP: a ring of vertices round each, facing along the chain. */
  function writeChain() {
    const pos = chainGeo.attributes.position, nor = chainGeo.attributes.normal;
    for (let i = 0; i <= CN; i++) {
      const k = i % CN, a = ((k + CN - 1) % CN) * 3, b = ((k + 1) % CN) * 3;
      tT.set(chainP[b] - chainP[a], chainP[b + 1] - chainP[a + 1], chainP[b + 2] - chainP[a + 2]).normalize();
      tN.crossVectors(tT, Math.abs(tT.z) > 0.9 ? Yr : Zr).normalize(); tB.crossVectors(tT, tN);
      for (let j = 0; j <= CS; j++) {
        const th = (j / CS) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), o = (i * RING + j) * 3;
        const nx = tN.x * c + tB.x * sn, ny = tN.y * c + tB.y * sn, nz = tN.z * c + tB.z * sn;
        nor.array[o] = nx; nor.array[o + 1] = ny; nor.array[o + 2] = nz;
        pos.array[o] = chainP[k * 3] + nx * CR; pos.array[o + 1] = chainP[k * 3 + 1] + ny * CR; pos.array[o + 2] = chainP[k * 3 + 2] + nz * CR;
      }
    }
    pos.needsUpdate = nor.needsUpdate = true; chainGeo.computeBoundingSphere();
  }
  writeChain();
  const chain = new THREE.Mesh(chainGeo, makeInk({ color: '#ffffff', map: chainTex, wash: 0.8 }));
  chain.castShadow = true; chain.receiveShadow = true; bike.add(chain);

  // --- the pedals as a flywheel ------------------------------------------------------------------
  // Pedalling backwards: the cranks turn counter-clockwise seen from the chain side, the pedals stay
  // level, and the chain follows the middle ring (38 teeth = 19 tiles a turn) while the rear wheel
  // stays put: the freewheel lets the sprocket run on its own, clicking, once per ratchet tooth.
  // A tap gives the crank a push (its speed goes up by PUSH); friction takes it down again, a drag
  // proportional to the speed plus a steady rubbing, which brings it to rest in finite time.
  const crankTo = (a) => {
    crank.rotation.z = a;
    for (const g of pedals) g.rotation.z = -a;
    chainTex.offset.x = -a * (MID_TEETH / 2 / (2 * Math.PI)); // whole tiles a turn: no jump when a wraps
  };
  const TAU = Math.PI * 2;
  const travel = (w) => { const ts = Math.log(1 + DRAG.k * w / DRAG.c) / DRAG.k; return (w + DRAG.c / DRAG.k) * (1 - Math.exp(-DRAG.k * ts)) / DRAG.k - DRAG.c / DRAG.k * ts; };
  // the push is the speed that carries a crank at rest exactly one turn before friction stops it
  let lo = 0, hi = 100; for (let n = 0; n < 40; n++) { const m = (lo + hi) / 2; if (travel(m) < TAU * SPIN.turns) lo = m; else hi = m; }
  const PUSH = (lo + hi) / 2, OMEGA_MAX = PUSH * SPIN.maxPushes;
  let omega = 0, angle = 0, ratchetPos = 0, last = null;
  let broken = false, chainState = 'on'; // 'on', then 'falling', then 'down'
  const taps = [];
  const hooks = {}; // the sounds: click(delay, strength), whirr(level), snap(), clink(delay, strength)

  /** A tap on the bike. Another push on the crank, unless the taps come faster than SPAM allows: then the chain comes off. */
  function tap(now = performance.now()) {
    if (broken) return 'nothing';
    while (taps.length && now - taps[0] > SPAM.window * 1000) taps.shift();
    taps.push(now);
    if (taps.length / SPAM.window > SPAM.rate) { fall(); return 'fall'; }
    omega = Math.min(OMEGA_MAX, omega + PUSH);
    return 'push';
  }

  // --- the chain coming off ----------------------------------------------------------------------
  // The part of the chain wrapped round the rear sprocket and the derailleur's two wheels stays where
  // it is; the rest (the top run, the ring, the bottom run) is let go and becomes a rope, pulled down
  // by gravity (in the bike's own frame, which leans), dropping onto the floor beside the pedals.
  const pinned = new Uint8Array(CN), zMin = new Float32Array(CN);
  for (let i = 0; i < CN; i++) {
    const x = chainRest[i * 3], y = chainRest[i * 3 + 1];
    pinned[i] = Math.hypot(x - R.x, y - R.y) < 0.062 || Math.hypot(x - J1.x, y - J1.y) < 0.045 || Math.hypot(x - J2.x, y - J2.y) < 0.045 ? 1 : 0;
    zMin[i] = 0.075 + 0.06 * (0.5 + 0.5 * Math.sin(i * 0.43)); // stays on the chain side of the frame; the lie of the chain meanders sideways
  }
  const PULL = 5; // m/s^2: the derailleur's spring takes up the slack, drawing the loose chain rearwards, into a heap
  const G = V(0, -Math.cos(LEAN), -Math.sin(LEAN)).multiplyScalar(9.81), UPN = V(0, Math.cos(LEAN), Math.sin(LEAN));
  const chainV = new Float32Array(CN * 3), chainOld = new Float32Array(CN * 3);
  let calm = 0, fallT = 0, lastClink = -1, fastestNow = 0;
  function fall() {
    broken = true; chainState = 'falling';
    const rnd = rng(2100), speed = Math.min(0.5, omega * 0.077 * 0.12); // it is flung a little along its run as it comes off
    for (let i = 0; i < CN; i++) {
      if (pinned[i]) continue;
      const a = ((i + CN - 1) % CN) * 3, b = ((i + 1) % CN) * 3, o = i * 3;
      tT.set(chainRest[b] - chainRest[a], chainRest[b + 1] - chainRest[a + 1], chainRest[b + 2] - chainRest[a + 2]).normalize();
      chainV[o] = tT.x * speed + (rnd() - 0.5) * 0.6; chainV[o + 1] = tT.y * speed + (rnd() - 0.5) * 0.6 - 0.5; chainV[o + 2] = 0.2 + rnd() * 0.4;
    }
    hooks.snap?.(); hooks.whirr?.(0);
  }
  /** Advance the falling chain by dt seconds. */
  function simulate(dt) {
    const H = 1 / 240, steps = Math.max(1, Math.round(dt / H)), h = dt / steps;
    for (let st = 0; st < steps; st++) {
      let fastest = 0;
      for (let i = 0; i < CN; i++) {
        if (pinned[i]) continue;
        const o = i * 3;
        for (let k = 0; k < 3; k++) { chainOld[o + k] = chainP[o + k]; chainV[o + k] = (chainV[o + k] + (G.getComponent(k) + (k === 0 && fallT < 0.7 ? -PULL : 0)) * h) * (fallT < 1.5 ? 0.9995 : 0.985); chainP[o + k] += chainV[o + k] * h; }
      }
      for (let it = 0; it < 14; it++) {
        for (let i = 0; i < CN; i++) {
          const j = (i + 1) % CN, wi = pinned[i] ? 0 : 1, wj = pinned[j] ? 0 : 1;
          if (!wi && !wj) continue;
          const a = i * 3, b = j * 3, dx = chainP[b] - chainP[a], dy = chainP[b + 1] - chainP[a + 1], dz = chainP[b + 2] - chainP[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-9;
          if (d <= seg) continue; // a slack chain does not push: it can crumple and heap up
          const k = (d - seg) / d / (wi + wj);
          chainP[a] += dx * k * wi; chainP[a + 1] += dy * k * wi; chainP[a + 2] += dz * k * wi;
          chainP[b] -= dx * k * wj; chainP[b + 1] -= dy * k * wj; chainP[b + 2] -= dz * k * wj;
        }
        for (let i = 0; i < CN; i++) {
          if (pinned[i]) continue;
          const o = i * 3, below = UPN.x * chainP[o] + UPN.y * chainP[o + 1] + UPN.z * chainP[o + 2] - 0.0045;
          if (below < 0) { chainP[o] -= UPN.x * below; chainP[o + 1] -= UPN.y * below; chainP[o + 2] -= UPN.z * below; }
          if (chainP[o + 2] < zMin[i]) { // stays on the chain side of the frame; near a pinned end it may come closer
            let near = 99; for (let q = 1; q < 8 && near === 99; q++) if (pinned[(i + q) % CN] || pinned[(i - q + CN) % CN]) near = q;
            const lim = near === 99 ? zMin[i] : 0.05 + (zMin[i] - 0.05) * (near / 8);
            if (chainP[o + 2] < lim) chainP[o + 2] = lim;
          }
        }
      }
      for (let i = 0; i < CN; i++) {
        if (pinned[i]) continue;
        const o = i * 3;
        for (let k = 0; k < 3; k++) chainV[o + k] = (chainP[o + k] - chainOld[o + k]) / h;
        const vn = UPN.x * chainV[o] + UPN.y * chainV[o + 1] + UPN.z * chainV[o + 2], onFloor = UPN.x * chainP[o] + UPN.y * chainP[o + 1] + UPN.z * chainP[o + 2] - 0.0045 < 2e-4;
        if (onFloor) {
          if (vn < -0.5 && fallT - lastClink > 0.03) { lastClink = fallT; hooks.clink?.(Math.min(dt, st * h), Math.min(1, -vn / 3)); }
          const keep = vn < 0 ? -vn * 0.2 : vn; // a little bounce, then it lies
          for (let k = 0; k < 3; k++) chainV[o + k] = (chainV[o + k] - UPN.getComponent(k) * vn) * 0.96 + UPN.getComponent(k) * keep;
        }
        fastest = Math.max(fastest, Math.hypot(chainV[o], chainV[o + 1], chainV[o + 2]));
      }
      fallT += h; calm = fastest < 0.08 ? calm + h : 0; fastestNow = fastest;
    }
    writeChain();
    if (calm > 0.4 || fallT > 8) chainState = 'down'; // it has stopped: nothing more to move
  }

  function tick(now) {
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (omega > 0 && dt > 0) {
      const w0 = omega, e = Math.exp(-DRAG.k * dt), w1 = (w0 + DRAG.c / DRAG.k) * e - DRAG.c / DRAG.k;
      let dA;
      if (w1 > 0) { dA = (w0 + DRAG.c / DRAG.k) * (1 - e) / DRAG.k - DRAG.c / DRAG.k * dt; omega = w1; }
      else { dA = travel(w0); omega = 0; } // it stops within this step
      angle = (angle + dA) % TAU; crankTo(angle);
      if (!broken) {
        // one click each time the freewheel's sprocket (turning `ratio` times as fast as the cranks) passes a ratchet tooth
        const r0 = ratchetPos, r1 = r0 + dA * SPIN.ratio * SPIN.ratchet / TAU, loud = 0.45 + 0.55 * Math.min(1, w0 / OMEGA_MAX);
        for (let c = Math.floor(r0) + 1; c <= Math.floor(r1); c++) hooks.click?.((c - r0) / (r1 - r0) * dt, loud);
        ratchetPos = r1;
        hooks.whirr?.(omega / OMEGA_MAX);
      }
    }
    if (chainState === 'falling') simulate(dt);
  }
  // a generous invisible target round the cranks: a tap near the pedals counts (it is never drawn)
  const target = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6), new THREE.MeshBasicMaterial({ visible: false }));
  target.position.set(BB.x, BB.y, 0.04); bike.add(target);
  const isBike = (o) => { for (; o; o = o.parent) if (o === outer) return true; return false; };

  // In the corner: rear wheel by the TV cabinet, front wheel almost at the south wall beside the
  // bookshelf, chain side to the room, leaning a few degrees towards the wall onto its stand, front
  // wheel turned in. It stands a few degrees off the wall so the back wheel clears the cabinet.
  outer.rotation.y = -Math.PI / 2 + YAW; // bike forward = world +z (south), chain side = world -x (into the room)
  bike.rotation.x = -LEAN;
  outer.position.set(ROOM.hx - 0.545, 0, 0.4);
  return { group: outer, hooks, tap, tick, isBike, crankTo, state: () => ({ omega, angle, broken, chain: chainState, push: PUSH, max: OMEGA_MAX, chainSpeed: fastestNow, fallT }) };
}

/** Merge non-indexed geometries keeping position, normal and uv. */
function mergeUV(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
