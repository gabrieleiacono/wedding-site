// Three keepsakes that make the study more theirs (the bass, the fourth, is in bass.js):
//   · Due terre: two prints side by side on the desk wall, right of the window, one for each end of
//     Modica–Darfo: a rubbing of the rock carvings in Valle Camonica, and an etching of San Giorgio in
//     Modica. A tap takes you up to them.
//   · Il cestino delle bozze: a wicker bin right of the desk, full of crumpled drafts of this very
//     invitation, one of them flattened out again on the floor. Just to look at.
//   · Il tappeto: a big Sicilian frazzata, woven from rag strips, across the floor from the phone table
//     to the bookshelf.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { ROOM, box } from './room.js';
import * as A from './keepsakes-art.js';

const tex = (c, o = {}) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  return t;
};
// a drawn picture as an ink material: mostly its own colours, lightly hatched
const art = (c, o = {}) => makeInk({ color: '#ffffff', wash: o.wash ?? 0.92, map: tex(c, o), hatch: o.hatch ?? 0.3, side: o.side, lift: o.lift ?? 0.08, spacing: o.spacing });
const paint = (color, o = {}) => makeInk({ color, wash: o.wash ?? 0.82, ...o });
const shadowy = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
const inside = (g) => (o) => { for (; o; o = o.parent) if (o === g) return true; return false; };

/** A picture frame: moulding of width f and depth d round a w × h picture; local +z faces out of the wall. */
function framed(w, h, artMat, frameMat, f, d) {
  const g = new THREE.Group();
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat); pic.position.z = 0.006; g.add(pic);
  box(w + 2 * f, h + 2 * f, 0.008, frameMat, 0, 0, 0, g); // the backing board
  box(w + 2 * f, f, d, frameMat, 0, h / 2 + f / 2, d / 2, g);
  box(w + 2 * f, f, d, frameMat, 0, -h / 2 - f / 2, d / 2, g);
  box(f, h, d, frameMat, -w / 2 - f / 2, 0, d / 2, g);
  box(f, h, d, frameMat, w / 2 + f / 2, 0, d / 2, g);
  const lip = paint('#2B2420', { wash: 0.9 }); // the moulding's inner step
  for (const s of [-1, 1]) { box(w, 0.004, 0.006, lip, 0, s * (h / 2 - 0.002), 0.009, g); box(0.004, h, 0.006, lip, s * (w / 2 - 0.002), 0, 0.009, g); }
  return shadowy(g);
}

// --- 3 · Due terre --------------------------------------------------------------------------------------
export function buildPrints(room) {
  const g = new THREE.Group(); room.add(g);
  const black = paint('#24201C', { wash: 0.9 });
  const a = framed(0.33, 0.424, art(A.rockRubbing(), { hatch: 0.2 }), black, 0.018, 0.022); a.position.x = -0.21; g.add(a);
  const b = framed(0.33, 0.424, art(A.modicaEtching(), { hatch: 0.2 }), black, 0.018, 0.022); b.position.x = 0.21; g.add(b);
  // an unseen card behind both, so a tap in the gap between the frames counts too
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.47), new THREE.MeshBasicMaterial({ visible: false })); hit.position.z = 0.003; g.add(hit);
  g.position.set(1.42, 1.62, -ROOM.hz + 0.004); // on the north wall, centred between the window and the corner
  return { group: g, center: g.position.clone().add(new THREE.Vector3(0, 0, 0.015)), isPrints: inside(g) };
}

// --- 6 · Il cestino delle bozze ---------------------------------------------------------------------------
/** A ball of crumpled paper: an icosphere pushed in and out. */
function crumple(rad, seed) {
  const geo = new THREE.IcosahedronGeometry(rad, 2);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 140 + seed) * Math.sin(v.y * 170 + seed * 2) * Math.sin(v.z * 150 + seed * 3);
    v.multiplyScalar(1 + n * 0.22 + (Math.abs(Math.sin(v.x * 60 + v.z * 40 + seed)) - 0.5) * 0.12);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); // (an icosphere has its own vertices per face, so this keeps it faceted, like folds)
  return geo;
}
export function buildBin(room) {
  const g = new THREE.Group(); room.add(g);
  const r = A.rng(42);
  const R = 0.15, Rb = 0.12, H = 0.33;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(R, Rb, H, 40, 1, true), art(A.wicker(), { repeat: [3, 1.2], hatch: 0.5, wash: 0.85, side: THREE.DoubleSide, lift: 0 }));
  side.position.y = H / 2; g.add(side);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(Rb, Rb, 0.01, 30), paint('#8A5E2E')); bottom.position.y = 0.005; g.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 8, 40), paint('#9A6A34', { wood: 1, grain: new THREE.Vector3(1, 0, 0) }));
  rim.rotation.x = Math.PI / 2; rim.position.y = H; g.add(rim);
  const paper = paint('#F6F2E8', { wash: 0.4 });
  // full to the brim, and two that missed
  const balls = [[0.03, 0.31, 0.02], [-0.06, 0.3, -0.04], [0.06, 0.32, -0.06], [-0.03, 0.35, 0.05], [0.0, 0.37, -0.01], [0.07, 0.34, 0.06]];
  balls.forEach(([x, y, z], i) => { const m = new THREE.Mesh(crumple(0.045 + r() * 0.01, i * 3.1), paper); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, r() * 3); g.add(m); });
  for (const [x, z] of [[0.24, 0.12], [-0.05, 0.27]]) { const m = new THREE.Mesh(crumple(0.045, x * 99), paper); m.position.set(x, 0.042, z); g.add(m); }
  // the one draft that got flattened out again, lying on the floor, still creased
  const sheet = new THREE.PlaneGeometry(0.21, 0.28, 14, 18);
  const p = sheet.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.abs(Math.sin(x * 40 + y * 13)) * 0.006 + Math.abs(Math.sin(y * 31 - x * 9)) * 0.005 + (Math.abs(x) > 0.09 ? 0.008 : 0)); }
  sheet.computeVertexNormals();
  const sm = new THREE.Mesh(sheet, art(A.draftSheet(), { hatch: 0.3, wash: 0.9, side: THREE.DoubleSide }));
  sm.rotation.x = -Math.PI / 2; sm.rotation.z = 0.5; sm.position.set(-0.14, 0.003, 0.32); g.add(sm);
  shadowy(g);
  g.position.set(0.98, 0, -1.42); // right of the desk, by the wall
  return { group: g };
}

// --- 7 · Il tappeto -----------------------------------------------------------------------------------------
export function buildRug(room) {
  const g = new THREE.Group(); room.add(g);
  // from just short of the phone table (west) to the TV side, and from the desk side to the bookshelf
  const RUG = { x0: -1.57, x1: 1.05, z0: -0.97, z1: 1.44 };
  const L = RUG.x1 - RUG.x0, W = RUG.z1 - RUG.z0;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W, L), art(A.frazzata(Math.round(W * 790), Math.round(L * 790)), { hatch: 0.55, wash: 0.88, lift: -0.02, spacing: 0.009 }));
  top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.y = 0.007; g.add(top);
  box(L, 0.006, W, paint('#6A4A3A'), 0, 0.003, 0, g).castShadow = false;
  // the fringes: knotted warp ends at both short sides
  const pts = [], r = A.rng(5);
  for (const s of [-1, 1]) for (let z = -W / 2 + 0.01; z < W / 2; z += 0.018) { const len = 0.05 + r() * 0.02, sw = (r() - 0.5) * 0.02; pts.push(s * L / 2, 0.006, z, s * (L / 2 + len), 0.004, z + sw); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const fringe = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#CDBF9F' })); g.add(fringe);
  const under = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#7A6A50' })); under.position.set(0.002, 0.001, 0); g.add(under);
  // taps go through the fringes (a raycast counts a line as hit anywhere within a metre of it)
  fringe.raycast = under.raycast = () => {};
  g.position.set((RUG.x0 + RUG.x1) / 2, 0, (RUG.z0 + RUG.z1) / 2); g.rotation.y = 0.008;
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { group: g };
}
