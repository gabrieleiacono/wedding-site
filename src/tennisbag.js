// A tennis racket bag lying on the second shelf from the bottom of the bookshelf, under the books: a
// padded six-racket "thermo" bag in bottle green with cream piping, shaped from photos of real ones
// (wedding-site-shots/tennis-bag/refs in the project files). Its body is a superquadric, a rounded box
// with padded faces, taller at the end where the racket heads go and lower towards the handles. On it:
// the two main zips along the top with their pullers, a padded front pocket with its own zip, piping
// round the side panels and the pocket, two carry handles sewn on with box-and-cross stitching and
// joined by a wrapped grip, a shoulder strap clipped to D-rings at each end with its shoulder pad slipped
// over the front edge, and a plain badge with no logo.
//
// Built in the bag's own frame (x along it, +x the racket-head end; y up from the shelf; z across it,
// -z the front, which faces the room) in metres, and merged into one vertex-coloured mesh: one draw.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { merge, vnoise } from './geo.js';

// size of a six-racket bag, a little smaller than most so it fits under the shelf above (31.5 cm clear)
export const BAG = { len: 0.74, depth: 0.25, head: 0.265, foot: 0.215 };
const C = {
  body: '#1F4236', pocket: '#1B3A2F', piping: '#E6DDC6', zip: '#1E1E21', tape: '#2A2B2E', metal: '#B8BBBA',
  pull: '#E6DDC6', webbing: '#1D1D20', pad: '#1F4236', grip: '#2B2B2E', thread: '#D8CFB6', badge: '#E6DDC6', badgeRim: '#1F4034',
};

// --- the body: (|y|^P + |z|^P)^(Q/P) + |x|^Q = 1, then stretched to size --------------------------------
const P = 5.5, Q = 4.2; // P: the cross-section's corners; Q: how square the ends are
const S = (t, e) => Math.sign(t) * Math.pow(Math.abs(t), e);
const A = BAG.len / 2, CZ = BAG.depth / 2;
const heightAt = (X) => BAG.foot + (BAG.head - BAG.foot) * Math.pow((X + 1) / 2, 0.85);
/** A point of the unit shape (X, Y, Z in -1..1) to the bag's frame. */
function deform(X, Y, Z, out = new THREE.Vector3()) {
  const t = (X + 1) / 2, h = heightAt(X);
  const lump = (vnoise(X * 5 + 3, Y * 4 + Z * 3) - 0.5) * 0.004 * (1 - Math.abs(Y) ** 6); // the padding is never quite even
  return out.set(A * X, (Y + 1) / 2 * h, Z * CZ * (0.92 + 0.08 * t) * (1 + lump));
}
/** The body's surface by (th, ph): th round the cross-section (0 back, π/2 top, π front), ph along it (±π/2 the ends). */
function unit(th, ph) {
  const R = S(Math.cos(ph), 2 / Q);
  return [S(Math.sin(ph), 2 / Q), R * S(Math.sin(th), 2 / P), R * S(Math.cos(th), 2 / P)];
}
const body = (th, ph, out) => deform(...unit(th, ph), out);
const phAt = (X) => Math.asin(S(X, Q / 2)); // the ph of the cross-section at X
const CENTRE = new THREE.Vector3(0, BAG.head * 0.45, 0);

/** Outward normal of a surface fn(s, t) at (s, t), by finite differences. */
function normalOf(fn, s, t, hint) {
  const e = 1e-3, a = fn(s + e, t), b = fn(s - e, t), c = fn(s, t + e), d = fn(s, t - e);
  const n = new THREE.Vector3().crossVectors(a.sub(b), c.sub(d));
  if (n.lengthSq() < 1e-26) return hint(fn(s, t)).normalize();
  n.normalize();
  if (n.dot(hint(fn(s, t))) < 0) n.negate();
  return n;
}
const outward = (p) => p.clone().sub(CENTRE);
const bodyFn = (s, t) => body(s, t, new THREE.Vector3());

// --- geometry helpers ---------------------------------------------------------------------------------
const parts = [];
const add = (geo, col) => { parts.push([geo, col]); return geo; };

/** Triangles between two rails of points (each an array of Vector3), facing (b - a) × (a[i+1] - a[i]). */
function strip(a, b) {
  const pos = [];
  for (let i = 0; i < a.length - 1; i++) {
    for (const v of [a[i], b[i], a[i + 1], b[i], b[i + 1], a[i + 1]]) pos.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
/** Smooth the normals of a non-indexed strip across its shared points. */
function smooth(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, key = (i) => `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`;
  const acc = new Map();
  for (let i = 0; i < p.count; i++) { const k = key(i); const v = acc.get(k) ?? new THREE.Vector3(); v.x += n.getX(i); v.y += n.getY(i); v.z += n.getZ(i); acc.set(k, v); }
  for (let i = 0; i < p.count; i++) { const v = acc.get(key(i)).clone().normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
/** A flat band (webbing, zip tape, a strap) along points `pts` with up-normals `nrm`: `w` wide, `th` thick,
 *  `lift` off the surface; w, th and lift may be functions of the position along it (0..1). */
function band(pts, nrm, w, th, lift, col) {
  const f = (v, u) => (typeof v === 'function' ? v(u) : v);
  const n = pts.length, c = [[], [], [], []];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const T = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    const N = nrm[i].clone().addScaledVector(T, -nrm[i].dot(T)).normalize();
    const B = new THREE.Vector3().crossVectors(N, T).normalize();
    const base = pts[i].clone().addScaledVector(N, f(lift, u)), hw = f(w, u) / 2, t = f(th, u);
    c[0].push(base.clone().addScaledVector(B, -hw)); c[1].push(base.clone().addScaledVector(B, hw));
    c[2].push(c[1][i].clone().addScaledVector(N, t)); c[3].push(c[0][i].clone().addScaledVector(N, t));
  }
  add(smooth(strip(c[2], c[3])), col); add(smooth(strip(c[0], c[1])), col);
  add(smooth(strip(c[1], c[2])), col); add(smooth(strip(c[3], c[0])), col);
  const cap = (i, flip) => { const q = [c[0][i], c[1][i], c[2][i], c[3][i]]; if (flip) q.reverse(); add(strip([q[0], q[3]], [q[1], q[2]]), col); };
  cap(0, false); cap(n - 1, true);
  return c;
}
/** Points and normals along a path (s(u), t(u)) on a surface fn. */
function trace(fn, path, n, hint) {
  const pts = [], nrm = [];
  for (let i = 0; i <= n; i++) { const [s, t] = path(i / n); pts.push(fn(s, t)); nrm.push(normalOf(fn, s, t, hint)); }
  return { pts, nrm };
}
/** A round cord (piping, the zip's teeth) through points. */
const cord = (pts, r, col, closed = false, seg = 6) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), pts.length * 2, r, seg, closed), col);
/** A small part built in a local frame (x along T, y along N, z along B) at point p. */
function placed(geo, p, T, N) {
  const t = T.clone().addScaledVector(N, -N.dot(T)).normalize(), b = new THREE.Vector3().crossVectors(t, N).normalize();
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(t, N, b).setPosition(p));
  return geo;
}
/** Box-and-cross stitching (how webbing is sewn on) on a band's end: square `l` along T, `w` across. */
function boxStitch(p, T, N, l, w) {
  const segs = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]], [[-1, -1], [1, 1]], [[-1, 1], [1, -1]]];
  for (const [[x0, z0], [x1, z1]] of segs) {
    const a = new THREE.Vector3(x0 * l / 2, 0, z0 * w / 2), b = new THREE.Vector3(x1 * l / 2, 0, z1 * w / 2), len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(len, 0.0008, 0.0011).rotateY(-Math.atan2(b.z - a.z, b.x - a.x)).translate((a.x + b.x) / 2, 0.0004, (a.z + b.z) / 2);
    add(placed(g, p, T, N), C.thread);
  }
}
/** A dashed line of stitches along points, `off` out along the normals. */
function stitches(pts, nrm, off = 0.0006, dash = 0.004, gap = 0.003) {
  let run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b), T = b.clone().sub(a).normalize();
    for (let s = (dash + gap) - run; s < len; s += dash + gap) {
      const p = a.clone().addScaledVector(T, Math.min(len, s + dash / 2)).addScaledVector(nrm[i], off);
      add(placed(new THREE.BoxGeometry(dash, 0.0008, 0.0011), p, T, nrm[i]), C.thread);
    }
    run = (run + len) % (dash + gap);
  }
}
/** A zip slider with its pull tab and cord, at p facing out along N, pointing along T. */
function puller(p, T, N, side = 1) {
  const g = (geo, col) => add(placed(geo, p, T, N), col);
  g(new THREE.BoxGeometry(0.016, 0.006, 0.012).translate(0, 0.004, 0), C.metal); // slider
  g(new THREE.BoxGeometry(0.006, 0.004, 0.006).translate(0.006 * side, 0.008, 0), C.metal); // the bridge the tab hangs from
  g(new THREE.BoxGeometry(0.028, 0.0025, 0.009).rotateZ(-0.12 * side).translate(0.02 * side, 0.009, 0), C.metal); // tab, lying down
  const loop = new THREE.TorusGeometry(0.009, 0.0022, 5, 12); loop.scale(1.6, 1, 0.7).rotateX(Math.PI / 2).translate(0.046 * side, 0.008, 0);
  g(loop, C.pull); // the cord pull through the tab
}

// --- the parts -----------------------------------------------------------------------------------------
function buildBody() {
  const nth = 72, nph = 80, pos = [], col = [], idx = [], c = new THREE.Color(), base = new THREE.Color(C.body), v = new THREE.Vector3();
  for (let j = 0; j <= nph; j++) {
    const ph = phAt(Math.sin(Math.PI * (j / nph - 0.5))); // even along the bag, closer together round the ends
    for (let i = 0; i <= nth; i++) {
      const th = -Math.PI / 2 + 2 * Math.PI * i / nth; // the seam runs under the bag
      body(th, ph, v); pos.push(v.x, v.y, v.z);
      // a touch darker low down (scuffs) and on the creases of the padding
      const k = 0.94 + 0.08 * vnoise(v.x * 40, v.y * 40 + v.z * 30) - 0.12 * (1 - Math.min(1, v.y / 0.03));
      c.copy(base).multiplyScalar(k); col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < nph; j++) for (let i = 0; i < nth; i++) {
    const a = j * (nth + 1) + i, b = a + nth + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // wound so the faces look outwards
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // the poles and the seam under the bag: point the normals the same way across the shared points
  const ng = g.toNonIndexed(); smooth(ng);
  add(ng, '#ffffff');
}

/** The side panels' piping: the loop where the front (or back) face turns into the top, ends and bottom. */
function piping(zs, k = 0.86) {
  const pts = [];
  for (let i = 0; i < 120; i++) {
    const a = 2 * Math.PI * i / 120, ca = Math.cos(a), sa = Math.sin(a);
    let lo = 0, hi = 1.2;
    for (let it = 0; it < 30; it++) { // the radius at which this ray leaves the shape, in the plane Z = zs·k
      const r = (lo + hi) / 2, X = r * ca, Y = r * sa;
      const f = Math.pow(Math.pow(Math.abs(Y), P) + Math.pow(k, P), Q / P) + Math.pow(Math.abs(X), Q);
      if (f < 1) lo = r; else hi = r;
    }
    pts.push(deform(lo * ca, lo * sa, zs * k));
  }
  cord(pts, 0.0034, C.piping, true, 6);
}

/** The two main zips along the top, the front one with two pullers that meet near the head end. */
function mainZips() {
  for (const [th, pulls] of [[Math.PI / 2 + 0.1, [0.42, 0.5]], [Math.PI / 2 - 0.11, [-0.55]]]) {
    const ph0 = phAt(-0.84), ph1 = phAt(0.84);
    const { pts, nrm } = trace(bodyFn, (u) => [th, ph0 + (ph1 - ph0) * u], 80, outward);
    band(pts, nrm, 0.026, 0.0012, 0.0004, C.tape);
    cord(pts.map((p, i) => p.clone().addScaledVector(nrm[i], 0.0026)), 0.0022, C.zip, false, 5);
    // a fabric tab over each end of the zip
    for (const [i0, i1] of [[0, 4], [76, 80]]) band(pts.slice(i0, i1 + 1), nrm.slice(i0, i1 + 1), 0.032, 0.0025, 0.0006, C.body);
    for (const X of pulls) {
      const ph = phAt(X), p = body(th, ph, new THREE.Vector3()), N = normalOf(bodyFn, th, ph, outward);
      const T = body(th, ph + 0.01, new THREE.Vector3()).sub(p).normalize();
      puller(p.addScaledVector(N, 0.003), T.multiplyScalar(Math.sign(X - 0.46) || 1), N, 1);
    }
  }
}

// The front pocket: a padded panel on the front face, (u, v) in -1..1 across it.
const PK = { x: -0.1, w: 0.56, y: -0.08, h: 0.6, th: 0.01 };
function pocketBase(u, v) {
  const X = PK.x + u * PK.w, Y = PK.y + v * PK.h;
  const Z = -Math.pow(Math.max(0, Math.pow(1 - Math.pow(Math.abs(X), Q), P / Q) - Math.pow(Math.abs(Y), P)), 1 / P);
  return deform(X, Y, Z);
}
const pocketBump = (u, v) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 5) - Math.pow(Math.abs(v), 5)), 0.3);
const front = () => new THREE.Vector3(0, 0, -1);
function pocketFn(u, v) {
  const p = pocketBase(u, v), n = normalOf(pocketBase, u, v, front);
  return p.addScaledVector(n, (PK.th + 0.008) * pocketBump(u, v) - 0.008); // its edge tucks in under the piping
}
function frontPocket() {
  const nu = 48, nv = 32, pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = pocketFn(-1 + 2 * i / nu, -1 + 2 * j / nv); pos.push(p.x, p.y, p.z); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  add(g, C.pocket);
  // piping round its top edge, with the gusset below it
  const edge = [];
  for (let i = 0; i < 96; i++) {
    const a = 2 * Math.PI * i / 96, r = Math.pow(Math.pow(Math.abs(Math.cos(a)), 5) + Math.pow(Math.abs(Math.sin(a)), 5), -1 / 5) * 0.95;
    edge.push(pocketFn(r * Math.cos(a), r * Math.sin(a)));
  }
  cord(edge, 0.003, C.piping, true, 6);
  // a row of stitches just inside the piping
  const st = trace(pocketFn, (s) => { const a = 2 * Math.PI * s, r = Math.pow(Math.pow(Math.abs(Math.cos(a)), 5) + Math.pow(Math.abs(Math.sin(a)), 5), -1 / 5) * 0.9; return [r * Math.cos(a), r * Math.sin(a)]; }, 160, front);
  stitches(st.pts, st.nrm);
  // its zip, across the top and curving down at each end
  const zipPath = (s) => { const u = -0.9 + 1.8 * s, e = Math.max(0, (Math.abs(u) - 0.7) / 0.2); return [u, 0.74 - 0.22 * e * e]; };
  const z = trace(pocketFn, zipPath, 60, front);
  band(z.pts, z.nrm, 0.022, 0.0012, 0.0003, C.tape);
  cord(z.pts.map((p, i) => p.clone().addScaledVector(z.nrm[i], 0.0024)), 0.002, C.zip, false, 5);
  const [ps, pt] = zipPath(0.78), p = pocketFn(ps, pt), N = normalOf(pocketFn, ps, pt, front);
  // the puller hangs down the pocket
  puller(p.addScaledVector(N, 0.0028), new THREE.Vector3(0.08, -1, 0).normalize(), N, 1);
  // a plain badge, cream with a green rim, stitched on
  const bp = pocketFn(0.5, -0.25), bn = normalOf(pocketFn, 0.5, -0.25, front);
  const rounded = (w, h, r) => { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; };
  const slab = (w, h, r, d, col, out) => {
    const g = new THREE.ExtrudeGeometry(rounded(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 5 });
    g.rotateX(-Math.PI / 2); // extrude along +y, the badge's normal in the local frame
    add(placed(g.translate(0, out, 0), bp, new THREE.Vector3(1, 0, 0), bn), col);
  };
  slab(0.082, 0.04, 0.009, 0.0015, C.badgeRim, -0.0004);
  slab(0.072, 0.031, 0.006, 0.0015, C.badge, 0.0016);
}

/** The carry handles: two webbing loops sewn to the front and back panels, flopped onto the top and
 *  held together by a wrapped grip. */
function handles() {
  const xs = [-0.2, 0.2], grip = { x: 0.085, lift: 0.014 };
  for (const f of [1, -1]) { // f = 1 the front handle
    const thA = Math.PI / 2 + f * 0.78, thG = Math.PI / 2 + f * 0.05;
    // from one stitched end up over the top, along under the grip, and down to the other
    const path = (u) => {
      const X = u < 0.3 ? xs[0] + (-grip.x - xs[0]) * (u / 0.3) : u > 0.7 ? grip.x + (xs[1] - grip.x) * ((u - 0.7) / 0.3) : -grip.x + 2 * grip.x * ((u - 0.3) / 0.4);
      const e = u < 0.3 ? u / 0.3 : u > 0.7 ? (1 - u) / 0.3 : 1, k = e * e * (3 - 2 * e);
      return [thA + (thG - thA) * k, phAt(X)];
    };
    const { pts, nrm } = trace(bodyFn, path, 60, outward);
    const lift = (u) => { const e = u < 0.3 ? u / 0.3 : u > 0.7 ? (1 - u) / 0.3 : 1; return 0.0008 + grip.lift * Math.pow(Math.sin(Math.PI / 2 * e), 1.5); };
    band(pts, nrm, 0.03, 0.0024, lift, C.webbing);
    // the sewn-down ends, each with its box-and-cross
    for (const [i, s] of [[2, 1], [58, -1]]) {
      const T = pts[i + 1].clone().sub(pts[i - 1]).normalize().multiplyScalar(s);
      boxStitch(pts[i].clone().addScaledVector(nrm[i], 0.0034), T, nrm[i], 0.024, 0.024);
    }
  }
  // the grip: a padded wrap round both handles, closed with a strip of velcro
  const top = body(Math.PI / 2, 0, new THREE.Vector3()), gx = grip.x * 0.92;
  const g = new THREE.CapsuleGeometry(0.0125, 2 * gx, 4, 14).rotateZ(Math.PI / 2).scale(1, 0.62, 1.15);
  add(g.translate(0, top.y + grip.lift + 0.009, top.z + 0.003), C.grip);
  for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.0128, 0.0016, 5, 16).rotateY(Math.PI / 2).scale(1, 0.62, 1.15).translate(s * gx * 0.9, top.y + grip.lift + 0.009, top.z + 0.003), C.thread);
}

/** The shoulder strap, clipped to a D-ring near each end and slipped over the front edge in the middle,
 *  where its pad is. */
function shoulderStrap() {
  const X0 = -0.66, X1 = 0.66, thBack = Math.PI / 2 - 0.3;
  const drape = (u) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.8))), 1.6);
  const path = (u) => [thBack + 1.25 * drape(u), phAt(X0 + (X1 - X0) * u)];
  const { pts, nrm } = trace(bodyFn, path, 120, outward);
  // the webbing rides over the handles where it crosses the top
  band(pts, nrm, 0.036, 0.0022, (u) => 0.0055 + 0.015 * Math.max(0, 1 - Math.abs(u - 0.5) / 0.22), C.webbing);
  // the shoulder pad, a padded sleeve over the middle of the strap with piped edges
  const i0 = 42, i1 = 78, pp = pts.slice(i0, i1 + 1), pn = nrm.slice(i0, i1 + 1);
  const padW = (u) => 0.062 * (0.75 + 0.25 * Math.sin(Math.PI * u)), padT = (u) => 0.011 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0.04, u))), 0.35);
  const padLift = (u) => 0.0055 + 0.015 * Math.max(0, 1 - Math.abs((i0 + u * (i1 - i0)) / 120 - 0.5) / 0.22) + 0.0018;
  const rails = band(pp, pn, padW, padT, padLift, C.pad);
  for (const k of [2, 3]) cord(rails[k].slice(1, -1), 0.0018, C.piping, false, 5);
  // the D-rings and snap hooks at each end, on short tabs sewn to the top
  for (const [i, X, s] of [[0, X0, 1], [120, X1, -1]]) {
    const p = pts[i], N = nrm[i], T = pts[i + s].clone().sub(p).normalize();
    const tab = trace(bodyFn, (u) => [thBack, phAt(X + s * (-0.02 + 0.06 * u))], 8, outward);
    band(tab.pts, tab.nrm, 0.03, 0.0022, 0.0008, C.webbing);
    boxStitch(tab.pts[6].clone().addScaledVector(tab.nrm[6], 0.003), T, tab.nrm[6], 0.016, 0.022);
    const ring = new THREE.TorusGeometry(0.014, 0.0022, 6, 14, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).translate(-0.004, 0.003, 0);
    add(placed(ring, p.clone().addScaledVector(T, -0.012), T, N), C.metal);
    add(placed(new THREE.BoxGeometry(0.04, 0.007, 0.024).translate(0.008, 0.0062, 0), p, T, N), C.metal); // the snap hook's body
    add(placed(new THREE.BoxGeometry(0.03, 0.0025, 0.036).translate(0.028, 0.0062, 0), p, T, N), C.webbing); // the strap doubled back through it
    boxStitch(p.clone().addScaledVector(N, 0.0076).addScaledVector(T, 0.03), T, N, 0.018, 0.028);
  }
}

/** The bag, ready to put on a shelf: origin at the middle of its foot, +x the head end, -z the front. */
export function buildTennisBag() {
  parts.length = 0;
  buildBody(); piping(-1); piping(1); mainZips(); frontPocket(); handles(); shoulderStrap();
  const geo = merge(parts);
  for (const [g] of parts) g.dispose();
  parts.length = 0;
  const mat = makeInk({ color: '#ffffff', vertexColors: true, wash: 0.8, spacing: 0.0045, hatch: 0.6 });
  const bag = new THREE.Mesh(geo, mat);
  bag.castShadow = bag.receiveShadow = true;
  bag.name = 'tennis-bag';
  return bag;
}
