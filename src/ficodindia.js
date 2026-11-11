// The ficu d'India (prickly pear, Opuntia ficus-indica) in its terracotta pot, on the floor just left of
// the TV cabinet. Drawn from photos of the plant (Wikimedia Commons): flattened obovate pads (cladodes),
// each narrowing to a neck where it grows from the edge of the one below, a little thicker towards the
// base and gently bowed; areoles in staggered diagonal rows on both faces and round the rim, each a felt
// cushion with its tuft of glochids and, here and there, one or two pale spines; a grey-green waxy bloom
// on the older pads, the youngest ones a fresher yellow-green, the oldest corked brown at the foot.
// Ripe fruits (tunas) stand along the top edges of two pads, orange, red and still greenish, with their
// dimpled tops; one flower is open, yellow with green stigma lobes, and another is still a bud. The pot
// is a rolled-rim terracotta pot with white mineral bloom on its foot, on a saucer, the soil top-dressed
// with grit.
//
// Built in the plant's own frame (y up, y = 0 on the floor, +x towards the wall behind it, +z towards
// the TV cabinet) and drawn in three draws: everything solid merged into one vertex-coloured mesh, the
// areoles as one instanced mesh, and the spines as lines.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { merge, rng, vnoise, lerp, sm } from './geo.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const SEED = 7;
// what the pads may not cross: the wall behind (+x), the TV cabinet (+z, lower down) and the room's side
const BOUNDS = { x: 0.2, zLow: 0.19, zHigh: 0.25, lowY: 0.6, zBack: -0.34, xFront: -0.34, top: 0.86 };
// most pads turn their faces towards the middle of the room, where you stand
const FACING = new THREE.Vector3(-0.8, 0, 0.6).normalize();

const C = {
  pads: ['#6C8A5E', '#76955E', '#8DAA58', '#A3BD5E'], // oldest → newest
  bloom: '#9CB2A0', rim: '#A8B064', cork: '#8A7B63', corkDark: '#6E6352', scar: '#B9A878',
  areole: '#4C3B2B', glochid: '#AE9363', spine: '#BDB59F', leaf: '#9DBA52',
  pot: '#B8653E', potDark: '#9C5233', salt: '#DCD0BD', soil: '#4A3628', soilDry: '#6E5644',
  grit: ['#B9B2A4', '#8F8A80', '#CFC4AE', '#A49A8A'],
};
const col = (h) => new THREE.Color(h);

/** Give a geometry a vertex colour from fn(position, colour out, index). */
function paint(geo, fn) {
  const p = geo.attributes.position, out = new Float32Array(p.count * 3), v = V(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, c, i); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return geo;
}

// --- one pad ---------------------------------------------------------------------------------------
// In its own frame: x across, y along (0 at the neck), z through its thickness. A point is given by
// (ρ, φ): ρ from the middle (0) to the rim (1), φ round from the tip (0) via the right (π/2) to the neck (π).
class Pad {
  constructor(o) {
    Object.assign(this, o); // L, W, T, base, up, normal, age (0 oldest .. 1 newest), seed
    this.Lb = this.L * 0.58; this.Lt = this.L - this.Lb;
    const r = rng(this.seed * 977 + 13);
    this.asym = (r() - 0.5) * 0.16; this.bowX = (r() - 0.5) * 1.2; this.bowY = (r() - 0.5) * 0.7;
    this.neck = 0.2 + r() * 0.08;
    const up = this.up.clone().normalize();
    const n = this.normal.clone().addScaledVector(up, -this.normal.dot(up)).normalize();
    this.right = up.clone().cross(n);
    this.up = up; this.normal = n;
    this.m = new THREE.Matrix4().makeBasis(this.right, up, n).setPosition(this.base);
    this.used = []; // φ along the rim already taken by a child pad, a fruit or a flower
  }
  /** The rim's offset from the pad's middle at φ (in the pad's plane). */
  outline(phi) {
    const ux = Math.sin(phi), uy = Math.cos(phi);
    let ox, oy;
    if (uy >= 0) { ox = this.W / 2 * ux; oy = this.Lt * uy; }
    else { oy = this.Lb * uy; ox = this.W / 2 * ux * (1 - (1 - this.neck) * Math.pow(-uy, 1.7)); }
    ox *= 1 + this.asym * ux;
    const f = 1 + (vnoise(uy * 1.8 + this.seed * 3.1, ux * 1.8 + this.seed) - 0.5) * 0.1;
    return [ox * f, oy * f];
  }
  /** A point of the surface: side +1 front face, -1 back, 0 the rim's middle plane. */
  local(rho, phi, side) {
    const [ox, oy] = this.outline(phi);
    const x = rho * ox, y = this.Lb + rho * oy;
    const h = this.T / 2 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (1.18 - 0.4 * y / this.L);
    const bow = this.bowX * x * x + this.bowY * (y - this.L * 0.5) ** 2 - this.bowY * (this.L * 0.5) ** 2;
    return V(x, y, side * h + bow);
  }
  world(v) { return v.clone().applyMatrix4(this.m); }
  dir(v) { return v.clone().transformDirection(this.m); }
  /** The normal of the surface at (ρ, φ, side), in the pad's frame. */
  localNormal(rho, phi, side) {
    const e = 0.004;
    const r0 = Math.min(rho, 0.985);
    const a = this.local(r0, phi, side), b = this.local(r0 + e, phi, side), c = this.local(r0, phi + e, side);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    if (n.z * side < 0) n.negate();
    return n;
  }
  /** (ρ, φ) for a point (x, y) of the pad's plane: φ found by bisection on the outline's direction. */
  polar(x, y) {
    const target = Math.atan2(x, y - this.Lb);
    let lo = -Math.PI, hi = Math.PI;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2, [ox, oy] = this.outline(mid);
      if (Math.atan2(ox, oy) < target) lo = mid; else hi = mid;
    }
    const phi = (lo + hi) / 2, [ox, oy] = this.outline(phi);
    return [Math.hypot(x, y - this.Lb) / Math.hypot(ox, oy), phi];
  }
  /** The rim point at φ and the outward direction there, in the plant's frame. */
  rimAt(phi) {
    const p = this.local(1, phi, 0);
    const q = this.local(0.9, phi, 0);
    return { at: this.world(p), out: this.dir(p.clone().sub(q).setZ(0).normalize()) };
  }
  geometry() {
    const N = 8, M = 36, pos = [], rhos = [], idx = [];
    const ringR = (i) => Math.sin(i / N * Math.PI / 2);
    const push = (rho, phi, side) => { const v = this.local(rho, phi, side); pos.push(v.x, v.y, v.z); rhos.push(rho); return pos.length / 3 - 1; };
    const phiOf = (j) => -Math.PI + (j / M) * Math.PI * 2;
    const rim = []; for (let j = 0; j < M; j++) rim.push(push(1, phiOf(j), 0));
    for (const side of [1, -1]) {
      const rings = [];
      for (let i = 1; i < N; i++) { const ring = []; for (let j = 0; j < M; j++) ring.push(push(ringR(i), phiOf(j), side)); rings.push(ring); }
      rings.push(rim);
      const ctr = push(0, 0, side);
      for (let j = 0; j < M; j++) {
        const j1 = (j + 1) % M;
        if (side > 0) idx.push(ctr, rings[0][j1], rings[0][j]); else idx.push(ctr, rings[0][j], rings[0][j1]);
        for (let i = 0; i < rings.length - 1; i++) {
          const a = rings[i][j], b = rings[i + 1][j], c = rings[i + 1][j1], d = rings[i][j1];
          if (side > 0) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // colour: the pad's age, mottled with waxy bloom, yellower at the rim; the oldest corked at the foot
    const base = col(C.pads[Math.min(3, Math.round(this.age * 3))]).lerp(col(C.pads[Math.min(3, Math.ceil(this.age * 3))]), (this.age * 3) % 1);
    const bloom = col(C.bloom), rimC = col(C.rim), cork = col(C.cork), corkD = col(C.corkDark), scar = col(C.scar), s = this.seed;
    paint(geo, (v, c, i) => {
      c.copy(base);
      const n = vnoise(v.x * 34 + s, v.y * 34 - s), n2 = vnoise(v.x * 90 - s * 2, v.y * 90 + s);
      c.lerp(bloom, (1 - this.age) * 0.32 * n);
      c.multiplyScalar(0.93 + 0.12 * n2);
      c.lerp(rimC, sm(0.82, 1, rhos[i]) * 0.35);
      if (this.age < 0.5) { // sun scars on the older pads
        const sp = vnoise(v.x * 22 + s * 5, v.y * 22 + 9);
        c.lerp(scar, sm(0.72, 0.8, sp) * 0.5);
      }
      if (this.cork) { // the oldest pad turns to bark from the soil up
        const k = sm(this.cork, this.cork * 0.35, v.y) * (0.65 + 0.35 * vnoise(v.x * 60, v.y * 40 + s));
        c.lerp(n2 > 0.5 ? cork : corkD, Math.min(1, k * 1.2));
      }
    });
    return geo.applyMatrix4(this.m);
  }
  /** Areoles: staggered diagonal rows on both faces, and a row round the rim. Calls fn(rho, phi, side). */
  areoles(fn) {
    const d = 0.0175 * Math.sqrt(this.L / 0.24), dy = d * 0.86;
    const r = rng(this.seed * 31 + 5);
    for (const side of [1, -1]) {
      const off = side > 0 ? 0 : d / 2;
      for (let row = 0, y = d * 0.6; y < this.L; y += dy, row++) {
        for (let x = -this.W; x < this.W; x += d) {
          const xx = x + (row % 2 ? d / 2 : 0) + off + (r() - 0.5) * d * 0.18, yy = y + (r() - 0.5) * d * 0.18;
          const [rho, phi] = this.polar(xx, yy);
          if (rho < 0.88 && !(Math.abs(phi) > 2.7 && rho > 0.5)) fn(rho, phi, side);
        }
      }
    }
    // round the rim, by arc length, leaving the neck bare
    let phi = -2.55, prev = this.local(1, phi, 0);
    while (phi < 2.55) {
      phi += 0.01;
      const p = this.local(1, phi, 0);
      if (p.distanceTo(prev) >= d * 0.85) { fn(1, phi, 0); prev = p; }
    }
  }
}

// --- fruits and flowers ------------------------------------------------------------------------------
/** The profile of a tuna (or a flower's ovary), lathed: narrow where it sits on the pad, a dimpled top. */
function fruitProfile(len, R) {
  const pts = [new THREE.Vector2(0, -0.001)];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = t < 0.62 ? R * (0.22 + 0.78 * Math.sin(Math.min(1, t / 0.62) * Math.PI / 2) ** 0.8) : R * (1 - 0.32 * ((t - 0.62) / 0.38) ** 2);
    pts.push(new THREE.Vector2(r, t * len));
  }
  pts.push(new THREE.Vector2(R * 0.52, len * 1.012), new THREE.Vector2(R * 0.36, len * 0.975), new THREE.Vector2(0, len * 0.955));
  return pts;
}
const fruitR = (t, R) => t < 0.62 ? R * (0.22 + 0.78 * Math.sin(Math.min(1, t / 0.62) * Math.PI / 2) ** 0.8) : R * (1 - 0.32 * ((t - 0.62) / 0.38) ** 2);

/** One petal along +y, cupped across, its tip curling back; w = width, l = length. */
function petal(w, l, cup, curl) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i) + 0.5;
    const wid = v < 0.7 ? 0.32 + 0.68 * Math.sin(v / 0.7 * Math.PI / 2) : Math.sqrt(Math.max(0, 1 - ((v - 0.7) / 0.32) ** 2));
    const x = u * w * wid, y = v * l;
    p.setXYZ(i, x, y, cup * (u * 2) ** 2 * w * wid * 0.5 - curl * v * v * l);
  }
  g.computeVertexNormals();
  return g;
}

// --- the pot ----------------------------------------------------------------------------------------
const SAUCER_H = 0.008, POT_H = 0.24;
const SOIL_Y = SAUCER_H + 0.205;

function buildPot(parts, pads, r) {
  // the saucer
  const sau = new THREE.LatheGeometry([[0, 0], [0.148, 0], [0.156, 0.003], [0.161, 0.024], [0.157, 0.027], [0.152, 0.025], [0.148, SAUCER_H], [0, SAUCER_H]].map(([a, b]) => new THREE.Vector2(a, b)), 44);
  const potC = col(C.pot), dark = col(C.potDark), salt = col(C.salt);
  const terracotta = (v, c, stains) => {
    const a = Math.atan2(v.z, v.x);
    c.copy(potC).lerp(dark, vnoise(a * 4 + 3, v.y * 18) * 0.45);
    c.multiplyScalar(0.94 + 0.1 * vnoise(a * 20, v.y * 60));
    if (stains) { // white mineral bloom wicked up from the saucer, and under the rim
      const n = vnoise(Math.cos(a) * 3 + 11, Math.sin(a) * 3 + v.y * 22);
      const low = sm(0.075, 0.02, v.y - SAUCER_H), rim = sm(0.19, 0.205, v.y - SAUCER_H) * sm(0.235, 0.22, v.y - SAUCER_H);
      c.lerp(salt, Math.min(0.85, (low * 0.9 + rim * 0.5) * sm(0.35, 0.7, n)));
    }
  };
  parts.push([paint(sau, (v, c) => terracotta(v, c, false)), null]);
  // the pot: tapered, a rolled rim, its inner wall down to the soil
  const prof = [[0, 0], [0.09, 0], [0.095, 0.005], [0.123, 0.196], [0.126, 0.199], [0.138, 0.201], [0.141, 0.207], [0.141, 0.232], [0.138, 0.238], [0.131, POT_H],
    [0.123, POT_H], [0.12, 0.234], [0.117, 0.205], [0.112, 0.2]];
  const pot = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 48).translate(0, SAUCER_H, 0);
  parts.push([paint(pot, (v, c) => terracotta(v, c, true)), null]);
  // the soil: a lumpy disc just under the rim, dark and damp with drier patches
  {
    const pos = [], idx = [], RN = 7, AN = 40, R0 = 0.118;
    pos.push(0, SOIL_Y + 0.004, 0);
    for (let i = 1; i <= RN; i++) for (let j = 0; j < AN; j++) {
      const rr = R0 * i / RN, a = j / AN * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, SOIL_Y + 0.004 * (1 - (i / RN) ** 2) + (vnoise(x * 70, z * 70) - 0.5) * 0.006 - (i === RN ? 0.004 : 0), z);
    }
    for (let j = 0; j < AN; j++) idx.push(0, 1 + (j + 1) % AN, 1 + j);
    for (let i = 1; i < RN; i++) for (let j = 0; j < AN; j++) {
      const a = 1 + (i - 1) * AN + j, b = 1 + (i - 1) * AN + (j + 1) % AN, c2 = a + AN, d = b + AN;
      idx.push(a, b, d, a, d, c2);
    }
    const soil = new THREE.BufferGeometry();
    soil.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); soil.setIndex(idx); soil.computeVertexNormals();
    const sc = col(C.soil), dry = col(C.soilDry);
    parts.push([paint(soil, (v, c) => c.copy(sc).lerp(dry, sm(0.45, 0.75, vnoise(v.x * 40 + 5, v.z * 40)))), null]);
  }
  // grit on top, kept off the stems
  for (let k = 0, tries = 0; k < 34 && tries < 400; tries++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.108, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (pads.some((p) => p.cork !== undefined && Math.hypot(x - p.base.x, z - p.base.z) < p.T * 0.8 + 0.012)) continue;
    const s = 0.004 + r() * 0.006;
    const g = new THREE.IcosahedronGeometry(s, 0).scale(1, 0.55 + r() * 0.3, 0.7 + r() * 0.4).rotateY(r() * 6).translate(x, SOIL_Y + s * 0.3, z);
    parts.push([g, C.grit[k % 4]]);
    k++;
  }
}

// --- the plant ------------------------------------------------------------------------------------
export function buildPricklyPear() {
  const r = rng(SEED);
  const rv = () => V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(2);
  const pads = [];
  const outlineOK = (pad) => {
    for (let k = 0; k < 20; k++) {
      const p = pad.world(pad.local(1, -Math.PI + k / 20 * Math.PI * 2, 0));
      if (p.x > BOUNDS.x || p.x < BOUNDS.xFront || p.z < BOUNDS.zBack || p.y > BOUNDS.top) return false;
      if (p.z > (p.y < BOUNDS.lowY ? BOUNDS.zLow : BOUNDS.zHigh)) return false;
      if (pad.cork === undefined && p.y < SOIL_Y + 0.07 && Math.hypot(p.x, p.z) > 0.11) return false; // over the pot's rim
    }
    const mid = pad.world(pad.local(0, 0, 0));
    for (const o of pads) if (mid.distanceTo(o.world(o.local(0, 0, 0))) < 0.36 * (pad.L + o.L)) return false;
    return true;
  };

  // the old trunk pad, its flat face to the room, and a smaller one from the soil beside it
  const trunk = new Pad({ L: 0.27, W: 0.165, T: 0.027, base: V(0.012, SOIL_Y - 0.035, 0.005), up: V(-0.07, 1, 0.04), normal: V(-0.8, 0, 0.6), age: 0, seed: 1, cork: 0.12 });
  pads.push(trunk);
  const pup = new Pad({ L: 0.13, W: 0.085, T: 0.018, base: V(-0.05, SOIL_Y - 0.02, -0.04), up: V(-0.45, 1, -0.25), normal: V(-0.3, 0, -0.95), age: 0.55, seed: 2, cork: 0.03 });
  pads.push(pup);

  const grow = (pad, depth) => {
    const n = depth === 0 ? 3 : depth === 1 ? (r() < 0.85 ? 2 : 1) : depth === 2 ? (r() < 0.6 ? 1 : 0) : 0;
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 18; t++) {
        const phi = lerp(-1.45, 1.45, n === 1 ? 0.5 + (r() - 0.5) * 0.9 : (k + 0.5) / n) + (r() - 0.5) * 0.4;
        if (pad.used.some((u) => Math.abs(u - phi) < 0.5)) continue;
        const { at, out } = pad.rimAt(phi);
        const up = out.clone().multiplyScalar(0.75).addScaledVector(UP, 0.48).addScaledVector(rv(), 0.15).normalize();
        if (up.y < 0.25) continue;
        const turn = (0.25 + r() * 0.75) * (r() < 0.5 ? -1 : 1);
        const normal = pad.normal.clone().applyAxisAngle(up, turn);
        if (Math.abs(normal.dot(FACING)) < 0.5 && t < 14) continue;
        const L = pad.L * (0.82 + r() * 0.12);
        const child = new Pad({ L, W: L * (0.58 + r() * 0.1), T: pad.T * 0.9, base: at.clone().addScaledVector(out, -0.012), up, normal, age: Math.min(0.9, (depth + 1) * 0.3), seed: pads.length + 3 + t * 50 });
        if (!outlineOK(child)) continue;
        pad.used.push(phi); child.depth = depth + 1; child.parent = pad;
        pads.push(child);
        grow(child, depth + 1);
        break;
      }
    }
  };
  trunk.depth = 0; grow(trunk, 0);

  const parts = [];   // [geometry, colour] for the one merged mesh
  const dots = [];    // areole instances: [position, normal, size]
  const spines = [];  // line end points

  // a new pad just breaking from the top of a high one, with its little conical leaves
  const highest = pads.filter((p) => p.depth >= 2).sort((a, b) => b.world(b.local(0, 0, 0)).y - a.world(a.local(0, 0, 0)).y);
  const sproutOn = highest[0];
  if (sproutOn) {
    for (const phi of [0.15, -0.6, 0.8, -1.1]) {
      if (sproutOn.used.some((u) => Math.abs(u - phi) < 0.4)) continue;
      const { at, out } = sproutOn.rimAt(phi);
      const up = out.clone().addScaledVector(UP, 0.8).normalize();
      const s = new Pad({ L: 0.06, W: 0.036, T: 0.012, base: at.clone().addScaledVector(out, -0.006), up, normal: sproutOn.normal.clone().applyAxisAngle(up, 0.4), age: 1, seed: 99, sprout: true });
      if (!outlineOK(s)) continue;
      sproutOn.used.push(phi); pads.push(s);
      break;
    }
  }

  // pads, their areoles and spines (the sprout has leaves instead of spines)
  for (const pad of pads) {
    parts.push([pad.geometry(), null]);
    const pr = rng(pad.seed * 53 + 1);
    pad.areoles((rho, phi, side) => {
      const at = pad.world(pad.local(rho, phi, side));
      const n = side ? pad.dir(pad.localNormal(rho, phi, side)) : pad.rimAt(phi).out;
      const size = (0.0021 + pr() * 0.0008) * (pad.sprout ? 0.6 : Math.sqrt(pad.L / 0.24) * 0.6 + 0.4);
      if (pad.sprout) { // a fleshy leaf, pointing up and out
        const dir = n.clone().addScaledVector(pad.up, 0.9).normalize();
        const l = 0.004 + pr() * 0.002;
        const g = new THREE.ConeGeometry(0.0011, l, 5).translate(0, l / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)).translate(at.x, at.y, at.z);
        parts.push([g, C.leaf]);
        return;
      }
      dots.push([at, n, size]);
      const count = side === 0 ? (pr() < 0.7 ? 1 + (pr() < 0.4) : 0) : (pr() < (rho > 0.5 ? 0.3 : 0.12) ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const dir = n.clone().addScaledVector(pad.up, -0.45).add(rv().multiplyScalar(0.35)).normalize();
        const l = side === 0 ? 0.009 + pr() * 0.014 : 0.005 + pr() * 0.008;
        const s0 = at.clone().addScaledVector(n, 0.0008);
        spines.push(s0, s0.clone().addScaledVector(dir, l));
      }
    });
  }

  // fruits along the top edges of the two highest grown pads
  const palette = [['#9DAA4F', '#D58A36'], ['#C9792F', '#D9532C'], ['#A44038', '#B32D45'], ['#B6B04E', '#E0A53C'], ['#CF8A3A', '#E06A2E']];
  const placeOnRim = (pad, phi, len, R, build) => {
    const { at, out } = pad.rimAt(phi);
    const axis = out.clone().multiplyScalar(0.8).addScaledVector(pad.up, 0.45).addScaledVector(pad.normal, (r() - 0.5) * 0.5).normalize();
    const base = at.clone().addScaledVector(out, -0.004);
    const top = base.clone().addScaledVector(axis, len + 0.02);
    if (top.x > BOUNDS.x + 0.02 || top.z > BOUNDS.zHigh || top.y > BOUNDS.top + 0.03) return false;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, axis).multiply(new THREE.Quaternion().setFromAxisAngle(UP, r() * 6.28));
    build(base, q, axis);
    pad.used.push(phi);
    return true;
  };
  const tuna = (base, q, len, R, cols, dotScale) => {
    const g = new THREE.LatheGeometry(fruitProfile(len, R), 12);
    const c0 = col(cols[0]), c1 = col(cols[1]), s = r() * 50;
    paint(g, (v, c) => {
      const t = Math.min(1, Math.max(0, v.y / len));
      c.copy(c0).lerp(c1, sm(0.1, 0.95, t + (vnoise(Math.atan2(v.z, v.x) * 2 + s, t * 4) - 0.5) * 0.35));
      if (v.y > len * 0.96 && Math.hypot(v.x, v.z) < R * 0.45) c.multiplyScalar(0.6); // the dried scar of the flower
    });
    parts.push([g.applyQuaternion(q).translate(base.x, base.y, base.z), null]);
    // its areoles: rows round the fruit, every other row turned half a step
    for (let row = 0; row < 6; row++) {
      const t = 0.14 + row * 0.15, rr = fruitR(t, R), n0 = 7;
      for (let k = 0; k < n0; k++) {
        const a = (k + (row % 2) * 0.5) / n0 * Math.PI * 2 + row * 0.2;
        const p = V(Math.cos(a) * rr, t * len, Math.sin(a) * rr).applyQuaternion(q).add(base);
        const n = V(Math.cos(a), 0.15, Math.sin(a)).normalize().applyQuaternion(q);
        dots.push([p, n, 0.0013 * dotScale]);
      }
    }
  };
  const fruitPads = pads.filter((p) => p.depth >= 1 && !p.sprout && p !== sproutOn)
    .sort((a, b) => b.world(b.local(0, 0.5, 0)).y - a.world(a.local(0, 0.5, 0)).y);
  let fi = 0;
  for (const pad of fruitPads.slice(0, 2)) {
    for (const phi of [-1.0, -0.4, 0.2, 0.8, 1.3]) {
      if (pad.used.some((u) => Math.abs(u - phi) < 0.45)) continue;
      const len = 0.05 + r() * 0.012, R = 0.019 + r() * 0.004;
      placeOnRim(pad, phi, len, R, (base, q) => tuna(base, q, len, R, palette[fi++ % palette.length], 1));
    }
  }

  // one open flower and one bud, on the next pad down
  const flowerPad = fruitPads[2] ?? fruitPads[0];
  const flower = (base, q, open) => {
    const len = open ? 0.032 : 0.028, R = 0.012;
    tuna(base, q, len, R, ['#7E9C4E', '#9DB458'], 0.75);
    const at = (v) => v.applyQuaternion(q).add(base);
    const whorls = open
      ? [{ n: 8, w: 0.027, l: 0.032, tilt: 0.95, c0: '#B9A23E', c1: '#E9B83A', cup: 0.5, curl: 0.16 }, { n: 10, w: 0.03, l: 0.036, tilt: 0.62, c0: '#E7C23F', c1: '#F6D84E', cup: 0.6, curl: 0.1 }]
      : [{ n: 6, w: 0.012, l: 0.018, tilt: 0.16, c0: '#A8A047', c1: '#D0793A', cup: 0.6, curl: -0.05 }];
    for (const wh of whorls) {
      const c0 = col(wh.c0), c1 = col(wh.c1);
      for (let k = 0; k < wh.n; k++) {
        const a = (k + (wh === whorls[1] ? 0.5 : 0)) / wh.n * Math.PI * 2 + (r() - 0.5) * 0.2;
        const g = petal(wh.w, wh.l * (0.92 + r() * 0.16), wh.cup, wh.curl);
        paint(g, (v, c) => c.copy(c0).lerp(c1, sm(0, wh.l * 0.6, v.y)));
        g.rotateX(-(wh.tilt + (r() - 0.5) * 0.12)).translate(0, len * 0.97, R * 0.55).rotateY(a);
        g.applyQuaternion(q).translate(base.x, base.y, base.z);
        parts.push([g, null]);
      }
    }
    if (open) { // the stamens' crowd, and the style with its green stigma lobes standing out of it
      parts.push([new THREE.CylinderGeometry(0.0095, 0.0065, 0.009, 16).translate(0, len * 0.97 + 0.0045, 0).applyQuaternion(q).translate(base.x, base.y, base.z), '#EDDC93']);
      parts.push([new THREE.CylinderGeometry(0.0016, 0.002, 0.016, 6).translate(0, len * 0.97 + 0.008, 0).applyQuaternion(q).translate(base.x, base.y, base.z), '#E9E2B4']);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        const p = at(V(Math.cos(a) * 0.0022, len * 0.97 + 0.0165, Math.sin(a) * 0.0022));
        parts.push([new THREE.SphereGeometry(0.0017, 6, 4).scale(1, 1.6, 1).translate(p.x, p.y, p.z), '#93B13F']);
      }
    }
  };
  if (flowerPad) {
    let opened = false;
    for (const phi of [0.2, -0.35, 0.7, -0.8, 1.1]) {
      if (flowerPad.used.some((u) => Math.abs(u - phi) < 0.42)) continue;
      if (placeOnRim(flowerPad, phi, 0.06, 0.02, (base, q) => flower(base, q, !opened))) { if (opened) break; opened = true; }
    }
  }

  buildPot(parts, pads, r);

  // --- the draws -----------------------------------------------------------------------------------
  const group = new THREE.Group();
  const geo = merge(parts);
  for (const [g] of parts) g.dispose();
  const body = new THREE.Mesh(geo, makeInk({ color: '#ffffff', vertexColors: true, wash: 0.8, spacing: 0.005, side: THREE.DoubleSide }));
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // areoles: a felt cushion, dark at its foot, with the tan tuft of glochids on top
  const cushion = new THREE.CylinderGeometry(0.6, 1, 0.65, 5, 1).translate(0, 0.2, 0);
  { const gr = cushion.groups[1]; cushion.setIndex(Array.from(cushion.index.array.slice(0, gr.start + gr.count))); cushion.clearGroups(); } // no bottom: it sits in the skin
  const brown = col(C.areole), tan = col(C.glochid);
  paint(cushion, (v, c) => c.copy(brown).lerp(tan, sm(0.2, 0.52, v.y)));
  const dotsMesh = new THREE.InstancedMesh(cushion, makeInk({ color: '#ffffff', vertexColors: true, wash: 0.85, spacing: 0.005 }), dots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V();
  dots.forEach(([p, n, size], i) => {
    q.setFromUnitVectors(UP, n);
    m.compose(p, q, s.set(size, size, size));
    dotsMesh.setMatrixAt(i, m);
  });
  dotsMesh.receiveShadow = true;
  dotsMesh.raycast = () => {}; // far too many little things to test every tap against
  group.add(dotsMesh);

  const spineLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spines), new THREE.LineBasicMaterial({ color: C.spine }));
  spineLines.raycast = () => {};
  group.add(spineLines);

  group.userData.stats = { pads: pads.length, areoles: dots.length, spines: spines.length / 2, vertices: geo.attributes.position.count };
  return group;
}
