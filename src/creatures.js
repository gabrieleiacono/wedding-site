// The animals in the view: two donkeys and two foals in the paddock, the rooster on the fence post,
// and swallows on the telegraph wire that swoop past the window now and then.
// Each animal is an articulated model (pivots for neck, head, ears, legs and tail) built from
// simple solids, shaded by the same pen material as everything else.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { EYE } from './room.js';
import { makeInk } from './ink.js';
import { rng, merge, limb, lumpy } from './geo.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const mesh = (parts, mat) => new THREE.Mesh(merge(parts), mat);
const sphere = (r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const approach = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// --- donkey -----------------------------------------------------------------------------
const DONKEY = { coat: '#8A7C6E', light: '#E6DAC6', dark: '#3A302A', mid: '#6E6258' };
const FOAL = { coat: '#B2A28C', light: '#EEE4D2', dark: '#5A4C40', mid: '#968672' };

function buildDonkey(mat, pal, foal) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const col = (hex) => new THREE.Color(hex);
  const coat = col(pal.coat), light = col(pal.light);
  // barrel: a lathe along x, sagging a little at the belly, higher at the rump; the belly is pale
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.3 * Math.pow(Math.sin(Math.PI * (0.05 + 0.9 * t)), 0.42), -0.62 + t * 1.24)); }
  const barrel = new THREE.LatheGeometry(pts, 18); barrel.rotateZ(-Math.PI / 2); barrel.scale(1, 1, 0.9);
  const bp = barrel.attributes.position, bcol = [];
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i); let y = bp.getY(i);
    if (y < 0) y -= 0.045 * (1 - (x / 0.62) ** 2);
    if (x < 0) y += 0.04 * (-x / 0.62) * (y > 0 ? 1 : 0.3);
    bp.setY(i, y + 0.82);
    const k = THREE.MathUtils.smoothstep(-y / 0.3, 0.35, 0.85);
    const c = coat.clone().lerp(light, k * 0.85); bcol.push(c.r, c.g, c.b);
  }
  barrel.setAttribute('color', new THREE.Float32BufferAttribute(bcol, 3));
  barrel.computeVertexNormals();
  const parts = [[barrel, '#ffffff'],
    [sphere(0.26, 0.47, 0.85, 0, 1, 1.05, 0.86), pal.coat],      // chest and shoulders
    [sphere(0.27, -0.46, 0.9, 0, 1.05, 1, 0.9), pal.coat],      // rump
  ];
  // thighs and forearms, so the legs grow out of the body instead of hanging from it
  for (const z of [-1, 1]) {
    parts.push([sphere(0.15, -0.43, 0.72, z * 0.13, 1.1, 1.45, 0.62), pal.coat]);
    parts.push([sphere(0.1, 0.42, 0.66, z * 0.12, 1, 1.6, 0.75), pal.coat]);
  }
  // the dark stripe down the back and the cross over the shoulders
  for (let i = 0; i < 12; i++) { const x = -0.6 + i * 0.1; const g = new THREE.BoxGeometry(0.11, 0.02, 0.05); g.rotateZ(-0.05 * (x > 0 ? 1 : -1)); g.translate(x, 1.1 + (x < 0 ? 0.035 * (-x / 0.62) : 0) - Math.abs(x) * 0.02, 0); parts.push([g, pal.dark]); }
  for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.045, 0.02, 0.26); g.translate(0, 0, s * 0.13); g.rotateX(s * 0.75); g.translate(0.38, 1.07, 0); parts.push([g, pal.dark]); }
  body.add(mesh(parts, mat));

  // neck → head → ears
  const neck = new THREE.Group(); neck.position.set(0.52, 0.94, 0); body.add(neck);
  const nk = limb(V(-0.04, -0.04), V(0.36, 0.42), 0.19, 0.12, 10); nk.scale(1, 1, 0.7);
  const nparts = [[nk, pal.coat]];
  for (let i = 0; i < 9; i++) { const t = i / 8; const g = new THREE.BoxGeometry(0.07, 0.075, 0.035); g.rotateZ(0.85); g.translate(-0.05 + t * 0.37, 0.1 + t * 0.4, 0); nparts.push([g, pal.dark]); }
  neck.add(mesh(nparts, mat));
  const head = new THREE.Group(); head.position.set(0.36, 0.42, 0); neck.add(head);
  const hd = limb(V(0, 0), V(0.38, -0.27), 0.13, 0.1, 10); hd.scale(1, 1, 0.8);
  const hparts = [[hd, pal.coat], [sphere(0.135, 0, 0, 0, 1, 1, 0.82), pal.coat],
    [sphere(0.112, 0.39, -0.28, 0, 1.05, 0.95, 0.82), pal.light],        // pale muzzle
    [sphere(0.06, 0.1, -0.12, 0, 1.4, 1, 1.4).translate(0, 0, 0), pal.coat]];
  for (const s of [-1, 1]) {
    hparts.push([sphere(0.018, 0.48, -0.29, s * 0.04, 1, 1, 1, 6), pal.dark]);       // nostrils
    hparts.push([sphere(0.022, 0.07, 0.03, s * 0.1, 1, 1, 1, 8), '#1A1714']);        // eyes
    const ring = new THREE.TorusGeometry(0.026, 0.006, 4, 12); ring.translate(0.07, 0.03, s * 0.098); hparts.push([ring, pal.light]);
  }
  for (let i = 0; i < 4; i++) { const g = new THREE.BoxGeometry(0.03, 0.06, 0.05); g.rotateZ(0.6); g.translate(-0.02 + i * 0.025, 0.11, (i - 1.5) * 0.02); hparts.push([g, pal.dark]); }
  head.add(mesh(hparts, mat));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(-0.04, 0.09, s * 0.05); head.add(ear);
    const e = new THREE.ConeGeometry(0.058, 0.32, 8); e.scale(1, 1, 0.5); e.translate(0, 0.16, 0);
    const tip = new THREE.ConeGeometry(0.025, 0.08, 8); tip.scale(1, 1, 0.45); tip.translate(0, 0.29, 0);
    const inner = new THREE.ConeGeometry(0.03, 0.2, 6); inner.scale(1, 1, 0.3); inner.translate(0.012, 0.12, 0);
    ear.add(mesh([[e, pal.coat], [tip, pal.dark], [inner, pal.light]], mat));
    ear.rotation.set(s * 0.35, 0, -0.25); ear.userData.s = s;
    ears.push(ear);
  }

  // legs: hip/shoulder pivot → knee pivot → hoof
  const legs = [];
  for (const [lx, front] of [[0.4, true], [-0.42, false]]) for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(lx, 0.72, s * 0.12); body.add(hip);
    const upper = limb(V(0, 0.1), V(front ? 0.02 : -0.04, -0.34), front ? 0.1 : 0.12, 0.058, 8);
    hip.add(mesh([[upper, pal.coat]], mat));
    const knee = new THREE.Group(); knee.position.set(front ? 0.02 : -0.04, -0.34, 0); hip.add(knee);
    const lower = limb(V(0, 0.02), V(0, -0.3), 0.05, 0.04, 7);
    const fetlock = sphere(0.045, 0, -0.27, 0, 1, 0.9, 1, 8);
    const hoof = new THREE.CylinderGeometry(0.044, 0.054, 0.06, 8); hoof.translate(0, -0.33, 0);
    knee.add(mesh([[lower, pal.mid], [fetlock, pal.mid], [hoof, pal.dark]], mat));
    legs.push({ hip, knee, front, phase: (front ? 0 : 0.5) + (s > 0 ? 0.5 : 0) });
  }
  // tail with a dark tuft
  const tail = new THREE.Group(); tail.position.set(-0.64, 0.98, 0); body.add(tail);
  const tl = limb(V(0, 0), V(-0.07, -0.42), 0.03, 0.018, 6);
  const tuft = lumpy(new THREE.ConeGeometry(0.055, 0.2, 7), 0.15, 20, 1); tuft.rotateZ(Math.PI); tuft.translate(-0.075, -0.5, 0);
  tail.add(mesh([[tl, pal.coat], [tuft, pal.dark]], mat));

  if (foal) { root.scale.setScalar(0.62); body.scale.set(0.95, 0.92, 0.95); for (const l of legs) l.hip.scale.set(1, 1.28, 1); head.scale.setScalar(1.18); ears.forEach((e) => e.scale.set(1, 0.85, 1)); }
  return { root, body, neck, head, ears, legs, tail };
}

class Donkey {
  constructor(mat, pal, foal, x, d, yaw, world, seed) {
    this.m = buildDonkey(mat, pal, foal);
    this.foal = foal; this.world = world;
    this.x = x; this.d = d; this.yaw = yaw;
    this.state = 'graze'; this.until = 0; this.ph = 0; this.speed = 0;
    this.R = rng(seed);
    this.target = null; this.t = 0;
    this.neckZ = 0; this.headZ = 0; this.neckY = 0; this.bodyZ = 0; this.lift = 0;
    this.m.root.userData = { kind: 'donkey', animal: this };
    this.place();
  }
  place() {
    const { H, Z } = this.world;
    this.m.root.position.set(this.x, H(this.x, this.d) + this.lift, Z(this.d));
    this.m.root.rotation.y = this.yaw;
  }
  pickTarget() {
    const p = this.world.paddock, R = this.R;
    for (let i = 0; i < 20; i++) {
      const x = p.x0 + 1.8 + R() * (p.x1 - p.x0 - 3.6), d = p.d0 + 3 + R() * (p.d1 - p.d0 - 5);
      if (Math.hypot(x - 9.2, d - 21) < 3.4 || Math.hypot(x + 8, d - 22) < 1.6 || Math.hypot(x - 3.6, d - 15.5) < 1.6) continue;
      return { x, d };
    }
    return { x: 0, d: 15 };
  }
  decide(now, herd) {
    const R = this.R;
    if (this.foal) {
      const r = R();
      if (r < 0.3) { this.state = 'trot'; this.target = this.pickTarget(); this.until = now + 6000; }
      else if (r < 0.5) { this.state = 'chase'; this.until = now + 5000 + R() * 3000; }
      else if (r < 0.62) { this.state = 'buck'; this.until = now + 900; }
      else if (r < 0.75) { this.state = 'lie'; this.until = now + 9000 + R() * 9000; }
      else if (r < 0.9) { this.state = 'graze'; this.until = now + 4000 + R() * 4000; }
      else { this.state = 'follow'; this.until = now + 8000; }
    } else {
      const r = R();
      if (r < 0.5) { this.state = 'graze'; this.until = now + 6000 + R() * 9000; }
      else if (r < 0.82) { this.state = 'walk'; this.target = this.pickTarget(); this.until = now + 15000; }
      else { this.state = 'stand'; this.until = now + 3000 + R() * 4000; }
    }
  }
  update(now, dt, herd, leaning) {
    const { Z } = this.world, m = this.m;
    if (this.state === 'bray') { if (now > this.until) this.state = 'stand'; }
    else if (leaning && this.state !== 'lie' && this.state !== 'stare') { this.prev = this.state; this.state = 'stare'; }
    else if (this.state === 'stare' && !leaning) { this.state = 'stand'; this.until = now + 1500; }
    else if (now > this.until && this.state !== 'stare') this.decide(now, herd);

    // where to go
    let goal = null, speed = 0;
    if (this.state === 'walk' || this.state === 'trot') { goal = this.target; speed = this.state === 'trot' ? 1.7 : 0.55; }
    if (this.state === 'chase' && herd.other(this)) { const o = herd.other(this); goal = { x: o.x + Math.sin(now / 700) * 1.2, d: o.d + Math.cos(now / 900) * 1.2 }; speed = 1.9; }
    if (this.state === 'follow') { const mum = herd.mother(this); goal = { x: mum.x - Math.cos(mum.yaw) * 1.2 + 0.6, d: mum.d + Math.sin(mum.yaw) * 1.2 }; speed = 0.9; }
    let turnTo = null;
    if (goal) {
      const dx = goal.x - this.x, dz = Z(goal.d) - Z(this.d), dist = Math.hypot(dx, dz);
      if (dist < 0.5) { if (this.state === 'walk' || this.state === 'trot') { this.state = 'graze'; this.until = now + 5000 + this.R() * 6000; } speed = 0; }
      else turnTo = Math.atan2(-dz, dx);
    }
    if (this.state === 'stare') {
      const dx = EYE.x - this.x, dz = EYE.z - Z(this.d);
      turnTo = Math.atan2(-dz, dx);
    }
    if (turnTo != null) {
      const dy = wrapA(turnTo - this.yaw);
      const rate = this.state === 'stare' ? 0.5 : 1.2;
      this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), rate * dt);
      if (Math.abs(dy) > 0.7) speed *= 0.2;
      if (this.state === 'stare') { m.neck.rotation.y = approach(m.neck.rotation.y, THREE.MathUtils.clamp(dy, -0.6, 0.6), 2, dt); }
    } else m.neck.rotation.y = approach(m.neck.rotation.y, 0, 2, dt);
    this.speed = approach(this.speed, speed, 3, dt);
    const fx = Math.cos(this.yaw), fz = -Math.sin(this.yaw);
    this.x += fx * this.speed * dt; this.d -= fz * this.speed * dt;
    const p = this.world.paddock;
    this.x = THREE.MathUtils.clamp(this.x, p.x0 + 1, p.x1 - 1); this.d = THREE.MathUtils.clamp(this.d, p.d0 + 1.2, p.d1 - 1);

    // pose
    const moving = this.speed > 0.08, trot = this.speed > 1.0;
    this.ph += dt * this.speed * (trot ? 1.6 : 1.9) / (this.foal ? 0.7 : 1);
    let neckZ = 0, headZ = 0, lift = 0, bodyZ = 0;
    if (this.state === 'graze' && !moving) { neckZ = -1.9; headZ = 0.8; }
    if (this.state === 'stare') { neckZ = 0.12; headZ = -0.05; }
    if (this.state === 'bray') { neckZ = 0.35; headZ = -0.75 + Math.sin(now / 90) * 0.06; }
    if (moving && !trot) { neckZ = -0.35; headZ = 0.1; }
    if (trot) { neckZ = 0.05; headZ = -0.1; }
    const buck = this.state === 'buck' ? Math.sin(Math.PI * THREE.MathUtils.clamp(1 - (this.until - now) / 900, 0, 1)) : 0;
    bodyZ = buck * 0.28;
    const lie = this.state === 'lie' ? 1 : 0;
    this.lieK = approach(this.lieK ?? 0, lie, 1.5, dt);
    lift = -0.5 * this.lieK + (moving ? Math.abs(Math.sin(this.ph * Math.PI * 2)) * (trot ? 0.05 : 0.015) : 0);
    if (this.lieK > 0.5) { neckZ = -0.3; headZ = 0.2; }
    this.neckZ = approach(this.neckZ, neckZ, 2.2, dt); this.headZ = approach(this.headZ, headZ, 2.5, dt);
    m.neck.rotation.z = this.neckZ; m.head.rotation.z = this.headZ;
    m.body.rotation.z = approach(m.body.rotation.z, bodyZ, 10, dt);
    this.lift = lift * (this.foal ? 1 : 1);
    for (const l of m.legs) {
      const a = (this.ph + l.phase) * Math.PI * 2;
      let hip = 0, knee = 0;
      if (moving) {
        const amp = trot ? 0.5 : 0.32;
        hip = Math.sin(a) * amp;
        knee = -Math.max(0, Math.cos(a)) * (trot ? 1.0 : 0.6) * (l.front ? 1 : -0.7);
      }
      if (!l.front && buck > 0) { hip = -buck * 1.0; knee = buck * 0.6; }
      if (this.lieK > 0.01) { hip = THREE.MathUtils.lerp(hip, l.front ? -1.4 : 1.3, this.lieK); knee = THREE.MathUtils.lerp(knee, l.front ? 2.5 : -2.4, this.lieK); }
      l.hip.rotation.z = approach(l.hip.rotation.z, hip, 14, dt); l.knee.rotation.z = approach(l.knee.rotation.z, knee, 14, dt);
    }
    // ears: forward when staring, back when braying, the odd flick otherwise
    for (const e of m.ears) {
      let back = -0.25, side = e.userData.s * 0.35;
      if (this.state === 'stare') { back = 0.25; side = e.userData.s * 0.15; }
      if (this.state === 'bray') { back = -0.9; }
      const flick = Math.sin(now / 160 + e.userData.s * 3 + this.x) > 0.985 ? -0.5 : 0;
      e.rotation.z = approach(e.rotation.z, back + flick, 8, dt); e.rotation.x = approach(e.rotation.x, side, 6, dt);
    }
    const swish = Math.sin(now / 1800 + this.x) > 0.6 ? Math.sin(now / 160) * 0.5 : 0;
    m.tail.rotation.x = approach(m.tail.rotation.x, swish, 8, dt);
    m.tail.rotation.z = trot ? 0.6 : 0;
    this.place();
  }
}

// --- rooster ----------------------------------------------------------------------------------
function buildRooster(mat, fmat) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = [
    [sphere(0.13, 0, 0.25, 0, 1.2, 1.0, 0.82), '#8A3A22'],
    [sphere(0.105, 0.08, 0.22, 0, 1, 1.1, 0.8), '#2A2420'],         // dark breast
    [sphere(0.08, -0.08, 0.3, 0, 1.4, 0.7, 0.8), '#C0702E'],        // saddle hackles
    [sphere(0.06, -0.06, 0.15, 0, 1.6, 0.8, 0.85), '#2A2420'],      // fluff under the tail
  ];
  for (const s of [-1, 1]) {
    parts.push([limb(V(0.01, 0.16, s * 0.045), V(0.02, 0.06, s * 0.05), 0.03, 0.022, 6), '#2A2420']);   // thighs
    parts.push([limb(V(0.02, 0.07, s * 0.05), V(0.025, 0.0, s * 0.05), 0.012, 0.011, 5), '#D8A840']);
    for (const a of [-0.5, 0, 0.5]) { const t = new THREE.BoxGeometry(0.05, 0.008, 0.01); t.translate(0.025, 0, 0); t.rotateY(a); t.translate(0.025, 0.004, s * 0.05); parts.push([t, '#D8A840']); }
  }
  body.add(mesh(parts, mat));
  // the tail: a fan of sickle feathers arching up and spilling back, drawn as thin crescents
  const feathers = [];
  for (let i = 0; i < 7; i++) {
    const k = i / 6, len = 0.22 + 0.12 * Math.sin(Math.PI * k), w = 0.03 + 0.012 * Math.sin(Math.PI * k);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(-0.02, len * 0.8, -len * 0.55, len * 1.05, -len * 0.95, len * 0.35);
    sh.bezierCurveTo(-len * 0.6, len * 0.85 - w, -0.03 + w * 0.3, len * 0.6, w, 0);
    sh.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(sh, 10);
    g.rotateZ(0.35 - k * 0.75); g.rotateX((k - 0.5) * 0.5); g.translate(-0.12, 0.27, (k - 0.5) * 0.05);
    feathers.push([g, i % 3 === 1 ? '#6E4220' : '#1C2A26']);
  }
  body.add(mesh(feathers, fmat));
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(0.02, 0.27, s * 0.09); body.add(w);
    w.add(mesh([[sphere(0.1, -0.04, -0.03, 0, 1.3, 0.62, 0.22), '#5E2A1C'], [sphere(0.05, -0.12, -0.06, 0, 1.3, 0.5, 0.2), '#1C2A26']], mat));
    w.userData.s = s; wings.push(w);
  }
  const neck = new THREE.Group(); neck.position.set(0.1, 0.32, 0); body.add(neck);
  const hackle = new THREE.ConeGeometry(0.075, 0.2, 10); hackle.rotateZ(-0.2); hackle.translate(0.0, 0.07, 0);
  neck.add(mesh([[hackle, '#D49A3A'], [sphere(0.055, 0.0, 0.0, 0, 1.2, 1.1, 1.2), '#C47A30']], mat));
  const head = new THREE.Group(); head.position.set(0.025, 0.17, 0); neck.add(head);
  const hp = [[sphere(0.042, 0, 0, 0, 1.15, 1, 0.9), '#B0442A']];
  for (let i = 0; i < 5; i++) { const a = -0.7 + i * 0.32; hp.push([sphere(0.02 + (i === 2 ? 0.005 : 0), Math.sin(a) * 0.032, 0.038 + Math.cos(a) * 0.014, 0, 1, 1.3, 0.45, 8), '#C8322A']); }
  for (const s of [-1, 1]) { hp.push([sphere(0.018, 0.035, -0.05, s * 0.01, 0.8, 1.4, 0.6, 8), '#C8322A']); hp.push([sphere(0.008, 0.02, 0.008, s * 0.035, 1, 1, 1, 6), '#1A1714']); hp.push([sphere(0.013, 0.012, -0.006, s * 0.035, 1, 1, 0.5, 6), '#E8D8B8']); }
  const beak = new THREE.ConeGeometry(0.014, 0.048, 6); beak.rotateZ(-Math.PI / 2 - 0.25); beak.translate(0.06, -0.008, 0); hp.push([beak, '#E0B040']);
  head.add(mesh(hp, mat));
  return { root, body, neck, head, wings };
}

// --- swallow ---------------------------------------------------------------------------------
function buildSwallow(mat) {
  const root = new THREE.Group();
  const parts = [[sphere(0.028, 0, 0, 0, 2.7, 1, 1, 10), '#1E2238'], [sphere(0.022, 0.01, -0.01, 0, 2.2, 0.8, 0.9, 8), '#EDE2CC'], [sphere(0.012, 0.065, -0.004, 0, 1, 1, 1, 6), '#A8402E']];
  for (const s of [-1, 1]) { const t = new THREE.ConeGeometry(0.008, 0.11, 4); t.rotateZ(Math.PI / 2); t.rotateY(s * 0.25); t.translate(-0.11, 0, s * 0.012); parts.push([t, '#1E2238']); }
  root.add(mesh(parts, mat));
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(0.01, 0.01, s * 0.02); root.add(w);
    const sh = new THREE.Shape(); sh.moveTo(0.02, 0); sh.quadraticCurveTo(0.03, s * 0.09, -0.05, s * 0.17); sh.quadraticCurveTo(-0.03, s * 0.07, -0.035, 0); sh.lineTo(0.02, 0);
    const g = new THREE.ShapeGeometry(sh, 6); g.rotateX(Math.PI / 2);
    w.add(mesh([[g, '#1E2238']], mat));
    w.userData.s = s; wings.push(w);
  }
  root.userData.wings = wings;
  return root;
}

// --- the cast -----------------------------------------------------------------------------
export class Animals {
  constructor(parent, world) {
    this.world = world;
    this.group = new THREE.Group(); parent.add(this.group);
    const mat = makeInk({ color: '#ffffff', vertexColors: true, wash: 0.88, auto: true, spacing: 0.012, lift: 0.08 });
    this.mat = mat;
    this.donkeys = [new Donkey(mat, DONKEY, false, -3.5, 15, 0.3, world, 11), new Donkey(mat, DONKEY, false, 4.5, 21, 2.6, world, 12)];
    this.foals = [new Donkey(mat, FOAL, true, -1.5, 13.5, -0.4, world, 13), new Donkey(mat, FOAL, true, 1.2, 17.5, 3.6, world, 14)];
    this.donkeys[1].state = 'walk'; this.donkeys[1].target = { x: -2, d: 19 }; this.donkeys[1].until = performance.now() + 20000;
    this.foals[0].state = 'chase'; this.foals[0].until = performance.now() + 7000;
    this.herd = {
      other: (a) => this.foals.find((f) => f !== a) ?? this.donkeys[0],
      mother: (a) => this.donkeys[this.foals.indexOf(a) === 1 ? 1 : 0],
    };
    for (const a of [...this.donkeys, ...this.foals]) this.group.add(a.m.root);
    // the rooster on its post
    const smat = makeInk({ color: '#ffffff', vertexColors: true, wash: 0.9, auto: true, spacing: 0.012, side: THREE.DoubleSide });
    this.rooster = buildRooster(mat, smat);
    this.rooster.root.position.copy(world.roosterPost).add(V(0, -0.03, 0));
    this.rooster.root.rotation.y = 0.55;
    this.rooster.root.userData = { kind: 'rooster' };
    this.group.add(this.rooster.root);
    this.crowUntil = 0; this.nextLook = 0; this.lookY = 0;
    // swallows: some perched on the wire, some in the air
    this.perched = [0.32, 0.38, 0.71].map((t) => {
      const b = buildSwallow(smat);
      const p = world.wire.getPoint(t);
      b.position.copy(p).add(V(0, 0.035, 0)); b.rotation.y = t > 0.5 ? Math.PI * 0.9 : 0.15;
      for (const w of b.userData.wings) w.rotation.x = w.userData.s * 0.9;
      this.group.add(b);
      return { b, home: b.position.clone(), away: 0, t };
    });
    this.flyers = [];
    for (let i = 0; i < 5; i++) { const b = buildSwallow(smat); b.visible = false; this.group.add(b); this.flyers.push({ b, path: null }); }
    this.nextSwoop = performance.now() + 3500;
    this.pickables = [...this.donkeys, ...this.foals].map((a) => a.m.root).concat([this.rooster.root]);
  }

  update(now, dt, leaning) {
    for (const a of [...this.donkeys, ...this.foals]) a.update(now, dt, this.herd, leaning && this.foals.includes(a));
    this.updateRooster(now, dt);
    this.updateSwallows(now, dt);
  }

  updateRooster(now, dt) {
    const r = this.rooster;
    const crowing = now < this.crowUntil;
    const k = crowing ? Math.sin(Math.PI * THREE.MathUtils.clamp(1 - (this.crowUntil - now) / 1800, 0, 1)) : 0;
    if (!crowing && now > this.nextLook) { this.lookY = (Math.random() - 0.5) * 1.6; this.nextLook = now + 900 + Math.random() * 2500; }
    r.neck.rotation.z = approach(r.neck.rotation.z, k * 0.45, 8, dt);
    r.neck.rotation.y = approach(r.neck.rotation.y, crowing ? 0 : this.lookY, 10, dt);
    r.head.rotation.z = approach(r.head.rotation.z, k * 0.7, 8, dt);
    r.body.rotation.z = approach(r.body.rotation.z, k * 0.25, 6, dt);
    const flap = crowing ? Math.max(0, Math.sin(now / 50)) * 0.6 * (k > 0.3 ? 1 : 0) : 0;
    for (const w of r.wings) w.rotation.x = w.userData.s * -flap;
    r.body.position.y = Math.sin(now / 700) * 0.003;
  }

  updateSwallows(now, dt) {
    if (now > this.nextSwoop) {
      const n = 1 + Math.floor(Math.random() * 3), dir = Math.random() < 0.5 ? 1 : -1;
      const base = { d: 6 + Math.random() * 16, y: 1.5 + Math.random() * 5 };
      let used = 0;
      for (const f of this.flyers) {
        if (f.path || used >= n) continue;
        const dd = base.d + (Math.random() - 0.5) * 3, yy = base.y + (Math.random() - 0.5);
        const pts = [V(-dir * 45, yy + 3, EYE.z - dd - 8), V(-dir * 12, yy, EYE.z - dd), V(0, yy - 1.5 - Math.random() * 1.5, EYE.z - dd + 1.5), V(dir * 12, yy + 0.5, EYE.z - dd - 2), V(dir * 45, yy + 6, EYE.z - dd - 12)];
        f.path = new THREE.CatmullRomCurve3(pts); f.t0 = now + used * 240; f.dur = 2600 + Math.random() * 1400; f.seed = Math.random() * 9;
        used++;
      }
      // sometimes a perched one joins them, and comes back later
      const p = this.perched[Math.floor(Math.random() * this.perched.length)];
      if (Math.random() < 0.35) p.away = now + 9000;
      this.nextSwoop = now + 15000 + Math.random() * 15000;
    }
    for (const f of this.flyers) {
      if (!f.path) continue;
      const t = (now - f.t0) / f.dur;
      if (t < 0) continue;
      if (t > 1) { f.path = null; f.b.visible = false; continue; }
      f.b.visible = true;
      const p = f.path.getPointAt(t), tg = f.path.getTangentAt(t), ahead = f.path.getTangentAt(Math.min(1, t + 0.05));
      f.b.position.copy(p);
      const yaw = Math.atan2(-tg.z, tg.x), pitch = Math.asin(THREE.MathUtils.clamp(tg.y, -1, 1));
      const bank = wrapA(Math.atan2(-ahead.z, ahead.x) - yaw) * 6;
      f.b.rotation.set(bank, yaw, pitch, 'YZX');
      const glide = Math.sin(t * 9 + f.seed) > 0.4;
      for (const w of f.b.userData.wings) w.rotation.x = w.userData.s * (glide ? 0.15 : Math.sin(now / 28 + f.seed) * 0.8);
    }
    for (const p of this.perched) {
      p.b.visible = now > p.away;
      p.b.rotation.z = Math.sin(now / 400 + p.t * 20) * 0.04;
    }
  }

  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.pickables, true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && !o.userData.kind) o = o.parent;
    return o ? { kind: o.userData.kind, animal: o.userData.animal, distance: hit.distance } : null;
  }
  crow() { this.crowUntil = performance.now() + 1800; }
  bray(a) { a = a ?? this.donkeys[0]; a.state = 'bray'; a.until = performance.now() + 1700; }
}
