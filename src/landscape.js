// The view from the window (design F11), as a real 3D landscape drawn with the same pen:
// a paddock falling away from the house, a valley of fields, olive groves, vineyards and cypresses,
// a casale with its dovecote on the left hill, a chapel on the right, a brick viaduct where the
// trains cross, far hills with a hill town, and a sky that slowly goes from golden hour to blue hour.
// Distances: `d` is metres north of the eye, x is metres east. Everything outside sits on layer 0
// (so it gets outlines), except the sky, clouds, smoke and far wires, which are on layer 1.
import * as THREE from 'three';
import { EYE } from './room.js';
import { makeInk, INK } from './ink.js';
import { rng, hash2, vnoise, fbm, sm, lerp, merge, lumpy, limb } from './geo.js';
import { Animals } from './creatures.js';

const LOOP = 600; // seconds: the sun sinks over ~9 minutes, then quietly comes back
export const SUN_AZ = -24;
const DECK = -9, VIA_D = 220;

export const Z = (d) => EYE.z - d;
const bump = (x, d, cx, cd, r, h) => h * Math.exp(-((x - cx) ** 2 + (d - cd) ** 2) / (r * r));

/** Ground height at (x, d). */
export function H(x, d) {
  const ax = Math.abs(x);
  let y = -0.15 - Math.max(0, Math.min(d, 32) - 3) * 0.13;          // the paddock falls away from the house
  y -= 26 * sm(32, 100, d);                                           // down to the valley floor, about -30
  y += 62 * sm(330, 900, d) + 48 * sm(900, 1500, d);                  // far hills
  y += sm(25 + d * 0.3, 110 + d * 0.55, ax) * sm(28, 80, d) * 46;      // the valley sides
  y += bump(x, d, -80, 125, 55, 30) + bump(x, d, 78, 178, 48, 22);    // casale hill, chapel hill
  y += bump(x, d, 170, 780, 120, 40);                                 // the hill town
  const amp = 0.22 + 2.6 * sm(30, 140, d) + 26 * sm(350, 1300, d);
  y += (fbm(x / (36 + d * 0.16) + 3.1, d / (36 + d * 0.16)) - 0.5) * 2 * amp;
  if (d > 600) y += (1 - Math.abs(vnoise(x / 260, d / 300) * 2 - 1)) * 34 * sm(600, 1100, d); // ridges
  return y;
}
export const ground = (x, d, lift = 0) => new THREE.Vector3(x, H(x, d) + lift, Z(d));

// --- what grows where ---------------------------------------------------------------
const PADDOCK = { x0: -13.5, x1: 13.5, d0: 4.6, d1: 28.5 };
const inPaddock = (x, d) => x > PADDOCK.x0 && x < PADDOCK.x1 && d > PADDOCK.d0 && d < PADDOCK.d1;
function field(x, d) {
  const a = 0.35, w = (vnoise(x / 90, d / 90) - 0.5) * 30;
  const u = (x * Math.cos(a) + d * Math.sin(a) + w) / 62, v = (-x * Math.sin(a) + d * Math.cos(a)) / 40;
  const i = Math.floor(u), j = Math.floor(v), h = hash2(i + 71, j + 13);
  const edge = Math.min(u - i, 1 - (u - i), (v - j) * 1.5, (1 - (v - j)) * 1.5);
  let type;
  if (h < 0.17) type = 'vines'; else if (h < 0.33) type = 'olives'; else if (h < 0.5) type = 'wheat';
  else if (h < 0.62) type = 'stubble'; else if (h < 0.74) type = 'green'; else if (h < 0.86) type = 'plough'; else type = 'sunflower';
  return { type, h, edge, i, j };
}
const COL = {
  grass: new THREE.Color('#A7A45E'), dry: new THREE.Color('#C4B47C'), bare: new THREE.Color('#B59872'),
  meadow: new THREE.Color('#98A057'), scrub: new THREE.Color('#6C7843'), far: new THREE.Color('#8F976E'),
  vines: new THREE.Color('#AE9068'), olives: new THREE.Color('#A8A074'), wheat: new THREE.Color('#DABD6A'),
  stubble: new THREE.Color('#D3BE8C'), green: new THREE.Color('#8E9C52'), plough: new THREE.Color('#A37B5A'),
  sunflower: new THREE.Color('#CDA63E'), hedge: new THREE.Color('#5F6E3C'), road: new THREE.Color('#E6D9BC'),
};

// --- materials ------------------------------------------------------------------------
const ext = (o = {}) => makeInk({ color: '#ffffff', vertexColors: true, wash: 0.88, auto: true, spacing: 0.02, lift: 0.06, ...o });

export class Countryside {
  constructor(scene, audio) {
    this.audio = audio;
    this.scene = scene;
    this.active = true; this.leaning = false;
    this.t0 = performance.now();
    this.group = new THREE.Group(); this.group.name = 'countryside';
    scene.add(this.group);
    this.mat = ext();
    this.glowMats = [];
    this.rand = rng(1912);
    this.buildSky();
    this.buildTerrain();
    this.buildRoad();
    this.buildVegetation();
    this.buildPaddock();
    this.buildWires();
    this.buildCasale();
    this.buildChapel();
    this.buildFarms();
    this.buildTown();
    this.buildViaduct();
    this.trains = []; this.nextTrain = performance.now() + 7000;
    this.buildSmoke();
    this.animals = new Animals(this.group, { H, Z, paddock: PADDOCK, roosterPost: this.roosterPost, wire: this.wire, audio });
    scene.fog = new THREE.Fog('#E9C9A0', 90, 1500);
    this.nextCrow = performance.now() + 2500;
    this.lastDusk = -1;
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  }

  // 0 = hero light (~20 min before sunset), 1 = blue hour
  get dusk() {
    if (this.fixedDusk != null) return this.fixedDusk;
    const t = ((performance.now() - this.t0) / 1000) % LOOP;
    const sink = LOOP * 0.9;
    return t < sink ? t / sink : 1 - (t - sink) / (LOOP - sink);
  }
  sunElevation() { return 17 - this.dusk * 12; }
  sunDir(out = new THREE.Vector3()) {
    const el = THREE.MathUtils.degToRad(this.sunElevation()), az = THREE.MathUtils.degToRad(SUN_AZ);
    return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }

  // --- sky ----------------------------------------------------------------------------
  buildSky() {
    const u = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uInk: { value: INK },
    };
    this.skyU = u;
    const mat = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTop, uHorizon, uGlow, uSun, uSunDir, uInk;
        float h1(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        float n1(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          float t = smoothstep(-0.02, 0.75, h);
          vec3 c = mix(uHorizon, uTop, pow(t, 0.6));
          float s = max(dot(d, uSunDir), 0.0);
          c += uGlow * (pow(s, 6.0) * 0.55 + pow(s, 40.0) * 0.7) * (1.0 - t*0.5);
          c = mix(c, uSun, smoothstep(0.99985, 0.99992, s));
          // pen strokes across the upper sky, following the elevation, with gaps
          float e = asin(clamp(h, -1.0, 1.0)) * 57.3;
          float az = atan(d.x, -d.z) * 57.3;
          float k = e * 0.9 + (n1(vec2(az*0.05, e*0.2)) - 0.5) * 0.8;
          float fw = fwidth(k);
          float line = 1.0 - smoothstep(fw*0.4, fw*1.2, 0.5 - abs(fract(k) - 0.5));
          line *= step(0.55, n1(vec2(az*0.09 + floor(k)*3.7, floor(k)*1.3)));
          line *= smoothstep(0.25, 0.7, h) * 0.22 * (1.0 - smoothstep(0.4, 0.9, fw));
          c = mix(c, uInk, line);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1750, 64, 32), mat);
    sky.position.copy(EYE); sky.layers.set(1); sky.renderOrder = -20; sky.frustumCulled = false;
    this.group.add(sky);
    this.sky = sky;
    // clouds: drawn cards facing the house
    this.clouds = [];
    const R = rng(77);
    const specs = [
      [-38, 9, 1300, 360, 'cumulus'], [-8, 13, 1400, 420, 'streak'], [22, 7, 1250, 300, 'cumulus'], [48, 16, 1300, 380, 'streak'],
      [-58, 22, 1200, 420, 'streak'], [6, 28, 1100, 360, 'cumulus'], [-22, 36, 1000, 300, 'streak'], [34, 32, 1050, 340, 'cumulus'],
      [-12, 4.2, 1450, 260, 'streak'], [62, 6, 1350, 300, 'cumulus'],
    ];
    for (const [az, el, dist, w, kind] of specs) {
      const tex = cloudTexture(R, kind);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (kind === 'streak' ? 0.22 : 0.42)), m);
      const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
      mesh.position.set(EYE.x + Math.sin(a) * Math.cos(e) * dist, EYE.y + Math.sin(e) * dist, EYE.z - Math.cos(a) * Math.cos(e) * dist);
      mesh.lookAt(EYE);
      mesh.layers.set(1); mesh.renderOrder = -19;
      mesh.userData = { a, e, dist, drift: (R() - 0.3) * 0.0006 };
      this.group.add(mesh); this.clouds.push(mesh);
    }
  }

  // --- terrain ------------------------------------------------------------------------
  buildTerrain() {
    const COLS = 220, ROWS = 300;
    const pos = new Float32Array((COLS + 1) * (ROWS + 1) * 3);
    const xd = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
    let k = 0;
    for (let r = 0; r <= ROWS; r++) {
      const v = r / ROWS, d = 0.9 + 1550 * v * v * v;
      for (let c = 0; c <= COLS; c++) {
        const u = (c / COLS) * 2 - 1, x = u * Math.abs(u) ** 0.35 * (24 + d * 1.95);
        pos[k * 3] = x; pos[k * 3 + 1] = H(x, d); pos[k * 3 + 2] = Z(d);
        xd[k * 2] = x; xd[k * 2 + 1] = d; k++;
      }
    }
    const idx = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c, b = a + 1, cc = a + COLS + 1, dd = cc + 1;
      idx.push(a, b, cc, b, dd, cc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nrm = g.attributes.normal, col = new Float32Array(pos.length), c = new THREE.Color();
    for (let i = 0; i < k; i++) {
      const x = xd[i * 2], d = xd[i * 2 + 1], ny = nrm.getY(i);
      groundColour(c, x, d, ny, this);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const t = new THREE.Mesh(g, ext({ lift: -0.16 }));
    t.name = 'terrain'; t.frustumCulled = false;
    this.group.add(t);
  }

  // --- the white road up to the casale, with its cypress avenue ----------------------------
  buildRoad() {
    const pts = [[-16, 1], [-16.5, 10], [-19, 22], [-24, 34], [-31, 50], [-38, 66], [-46, 82], [-53, 96], [-60, 108], [-64, 116]]
      .map(([x, d]) => new THREE.Vector3(x, 0, d));
    const curve = new THREE.CatmullRomCurve3(pts);
    this.roadCurve = curve;
    const N = 160, W = 1.8, pos = [], col = [], idx = [], c = new THREE.Color();
    const edgeL = [], edgeR = [];
    for (let i = 0; i <= N; i++) {
      const p = curve.getPointAt(i / N), tg = curve.getTangentAt(i / N);
      const nx = -tg.z, nz = tg.x, l = Math.hypot(nx, nz);
      for (const s of [-1, 1]) {
        const x = p.x + (nx / l) * W * s, d = p.z + (nz / l) * W * s;
        const y = H(x, d) + 0.07;
        pos.push(x, y, Z(d));
        c.copy(COL.road).multiplyScalar(0.92 + 0.12 * vnoise(x * 0.7, d * 0.7));
        col.push(c.r, c.g, c.b);
        (s < 0 ? edgeL : edgeR).push(new THREE.Vector3(x, y + 0.02, Z(d)));
      }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = ext({ lift: 0.12 }); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    this.group.add(new THREE.Mesh(g, m));
    const lm = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 });
    for (const e of [edgeL, edgeR]) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(e), lm); line.layers.set(1); this.group.add(line); }
  }

  // --- trees, vines, hedges, bales ------------------------------------------------------
  buildVegetation() {
    const R = this.rand;
    const cypress = [], olives = [], pines = [], vines = [], shrubs = [], bales = [], tufts = [], pagliai = [];
    // cypress avenue along the upper road
    for (let t = 0.42; t < 0.97; t += 0.035) {
      const p = this.roadCurve.getPointAt(t), tg = this.roadCurve.getTangentAt(t);
      for (const s of [-1, 1]) cypress.push([p.x - tg.z * 4.2 * s, p.z + tg.x * 4.2 * s, 10 + R() * 3]);
    }
    // cypresses in twos and threes on the ridges, singles along field edges
    for (const [x, d, n] of [[-95, 140, 3], [-40, 150, 2], [62, 165, 3], [95, 190, 2], [120, 260, 3], [-140, 280, 2], [30, 340, 2], [-70, 420, 3], [90, 520, 2], [210, 560, 3], [-220, 640, 3], [140, 690, 4]]) {
      for (let i = 0; i < n; i++) cypress.push([x + (R() - 0.5) * 9, d + (R() - 0.5) * 9, 9 + R() * 6]);
    }
    for (let i = 0; i < 70; i++) {
      const x = (R() - 0.5) * 700, d = 90 + R() * 700;
      const f = field(x, d);
      if (f.edge < 0.12 && Math.abs(x) < d * 1.6) cypress.push([x, d, 8 + R() * 6]);
    }
    // umbrella pines near the chapel and the viaduct
    for (const [x, d] of [[40, 196], [47, 201], [-118, 205], [140, 300], [-30, 285], [18, 470]]) pines.push([x, d, 12 + R() * 4]);
    // fields: walk a grid over the valley and hills, and plant what each field grows
    for (let d = 34; d < 900; d += d < 200 ? 3.5 : d < 400 ? 6 : 10) {
      const half = 30 + d * 1.25;
      const step = d < 200 ? 3.5 : d < 400 ? 6 : 10;
      for (let x = -half; x < half; x += step) {
        const jx = x + (R() - 0.5) * step * 0.6, jd = d + (R() - 0.5) * step * 0.6;
        if (inPaddock(jx, jd) || Math.abs(jx) < 16 && jd < 34) continue;
        if (Math.abs(jd - VIA_D) < 6) continue;
        if (this.roadDist(jx, jd) < 3) continue;
        const f = field(jx, jd);
        if (f.edge < 0.035 && hash2(f.i * 3 + (f.edge < 0.02 ? 1 : 0), f.j) > 0.35) { if (R() < (d < 300 ? 0.55 : 0.3)) shrubs.push([jx, jd, 0.8 + R() * 0.9]); continue; }
        if (f.type === 'olives' && R() < (d < 300 ? 0.17 : 0.1)) olives.push([jx, jd, 0.8 + R() * 0.5]);
        else if (f.type === 'stubble' && d < 500 && R() < 0.012) bales.push([jx, jd, R() * Math.PI]);
        else if (f.type === 'stubble' && d < 260 && R() < 0.004) pagliai.push([jx, jd, 1]);
      }
    }
    // vineyards: rows on the valley sides
    for (const [cx, cd, w, len, ang] of [[-48, 62, 40, 36, 0.25], [52, 72, 46, 34, -0.3], [-110, 175, 50, 40, 0.1], [118, 150, 60, 40, -0.2], [-60, 330, 70, 50, 0.4], [60, 380, 80, 60, -0.1], [170, 300, 50, 50, 0.2]]) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let r = -w / 2; r <= w / 2; r += 2.6) {
        for (let s = -len / 2; s < len / 2; s += 2.2) {
          const x = cx + r * ca + s * sa, d = cd - r * sa + s * ca;
          if (inPaddock(x, d) || this.roadDist(x, d) < 3) continue;
          vines.push([x, d, ang]);
        }
      }
    }
    // tufts of tall grass along the paddock fence and under the tree
    for (let i = 0; i < 1400; i++) {
      const x = PADDOCK.x0 + R() * (PADDOCK.x1 - PADDOCK.x0), d = R() < 0.6 ? PADDOCK.d0 + Math.pow(R(), 2) * 6 : PADDOCK.d0 + R() * 24;
      if (R() < 0.4 && Math.abs(x) < 9 && d > 10) continue;
      tufts.push([x, d, 0.4 + R() * 0.5]);
    }
    for (let i = 0; i < 700; i++) { const x = (R() < 0.5 ? -1 : 1) * (14 + R() * 14), d = 2 + R() * 34; if (this.roadDist(x, d) < 2.2) continue; tufts.push([x, d, 0.8 + R()]); }

    this.cypress = cypress;
    const place = (geo, list, fn, mat = this.mat) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
      list.forEach((it, i) => { fn(it, p, q, s, c); m.compose(p, q, s); im.setMatrixAt(i, m); im.setColorAt(i, c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      this.group.add(im); return im;
    };
    const yaw = new THREE.Vector3(0, 1, 0);
    place(cypressGeo(), cypress, ([x, d, h], p, q, s, c) => { p.set(x, H(x, d) - 0.2, Z(d)); q.setFromAxisAngle(yaw, R() * 6.28); const w = 0.85 + R() * 0.3; s.set(h * w, h, h * w); c.setScalar(0.85 + R() * 0.25); });
    place(oliveGeo(), olives, ([x, d, k], p, q, s, c) => { p.set(x, H(x, d) - 0.1, Z(d)); q.setFromAxisAngle(yaw, R() * 6.28); s.setScalar(k); c.setScalar(0.88 + R() * 0.22); });
    place(pineGeo(), pines, ([x, d, h], p, q, s, c) => { p.set(x, H(x, d) - 0.2, Z(d)); q.setFromAxisAngle(yaw, R() * 6.28); s.setScalar(h / 12); c.setScalar(0.9 + R() * 0.2); });
    place(vineGeo(), vines, ([x, d, a], p, q, s, c) => { p.set(x, H(x, d) + 0.02, Z(d)); q.setFromAxisAngle(yaw, a); s.set(1, 0.85 + R() * 0.3, 1); c.setScalar(0.85 + R() * 0.3); });
    place(shrubGeo(), shrubs, ([x, d, k], p, q, s, c) => { p.set(x, H(x, d) - 0.2, Z(d)); q.setFromAxisAngle(yaw, R() * 6.28); s.set(k * (1 + R()), k * (0.7 + R() * 0.5), k * (1 + R())); c.setScalar(0.8 + R() * 0.35); });
    place(baleGeo(), bales, ([x, d, a], p, q, s, c) => { p.set(x, H(x, d) + 0.7, Z(d)); q.setFromAxisAngle(yaw, a); s.setScalar(1); c.setScalar(0.92 + R() * 0.15); });
    place(pagliaioGeo(), pagliai, ([x, d], p, q, s, c) => { p.set(x, H(x, d) - 0.1, Z(d)); q.setFromAxisAngle(yaw, R() * 6.28); s.setScalar(0.9 + R() * 0.3); c.setScalar(1); });
    place(tuftGeo(), tufts, ([x, d, k], p, q, s, c) => { p.set(x, H(x, d) - 0.03, Z(d)); q.setFromAxisAngle(yaw, R() * 6.28); s.set(k, k * (0.8 + R() * 0.5), k); c.setScalar(0.85 + R() * 0.3); });
  }
  roadDist(x, d) {
    if (!this.roadPts) this.roadPts = this.roadCurve.getSpacedPoints(120);
    let best = 1e9;
    for (const p of this.roadPts) { const dd = (p.x - x) ** 2 + (p.z - d) ** 2; if (dd < best) best = dd; }
    return Math.sqrt(best);
  }

  // --- the paddock: fence, shed, trough, the old fig tree -------------------------------------
  buildPaddock() {
    const R = rng(5);
    const P = PADDOCK, posts = [];
    const line = (x0, d0, x1, d1) => {
      const len = Math.hypot(x1 - x0, d1 - d0), n = Math.max(1, Math.round(len / 2.45));
      for (let i = 0; i <= n; i++) posts.push([x0 + (x1 - x0) * i / n, d0 + (d1 - d0) * i / n]);
      return n;
    };
    const runs = [];
    // the front fence has a gate gap on the left, where the road passes
    const startFront = posts.length; line(P.x0, P.d0, P.x1, P.d0); runs.push([startFront, posts.length - 1, new Set([1])]);
    const s1 = posts.length; line(P.x1, P.d0, P.x1, P.d1); runs.push([s1, posts.length - 1, new Set()]);
    const s2 = posts.length; line(P.x1, P.d1, P.x0, P.d1); runs.push([s2, posts.length - 1, new Set()]);
    const s3 = posts.length; line(P.x0, P.d1, P.x0, P.d0); runs.push([s3, posts.length - 1, new Set()]);
    const postGeo = merge([[(() => { const g = new THREE.CylinderGeometry(0.055, 0.07, 1.3, 7, 3); g.translate(0, 0.55, 0); return lumpy(g, 0.12, 9, 2); })(), '#7A6650'],
      [(() => { const g = new THREE.ConeGeometry(0.06, 0.06, 7); g.translate(0, 1.23, 0); return g; })(), '#6E5A46']]);
    const top = [];
    const postIM = new THREE.InstancedMesh(postGeo, this.mat, posts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    posts.forEach(([x, d], i) => {
      const y = H(x, d);
      e.set((R() - 0.5) * 0.08, R() * 6, (R() - 0.5) * 0.08); q.setFromEuler(e);
      const hs = 0.92 + R() * 0.16;
      m4.compose(new THREE.Vector3(x, y - 0.1, Z(d)), q, new THREE.Vector3(1, hs, 1));
      postIM.setMatrixAt(i, m4); postIM.setColorAt(i, c.setScalar(0.85 + R() * 0.3));
      top.push(new THREE.Vector3(x, y - 0.1 + 1.26 * hs, Z(d)));
    });
    this.group.add(postIM);
    // rails: two per bay, a little sag and twist
    const railGeo = merge([[lumpy(new THREE.BoxGeometry(1, 0.085, 0.05, 6, 1, 1), 0.08, 5, 1), '#8A7458']]);
    const rails = [];
    for (const [a, b, gaps] of runs) for (let i = a; i < b; i++) {
      if (gaps.has(i - a)) continue;
      for (const hgt of [0.5, 0.98]) rails.push([posts[i], posts[i + 1], hgt]);
    }
    const railIM = new THREE.InstancedMesh(railGeo, this.mat, rails.length);
    rails.forEach(([[x0, d0], [x1, d1], hgt], i) => {
      const y0 = H(x0, d0) + hgt + (R() - 0.5) * 0.05, y1 = H(x1, d1) + hgt + (R() - 0.5) * 0.05;
      const a = new THREE.Vector3(x0, y0, Z(d0)), b = new THREE.Vector3(x1, y1, Z(d1));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a); const len = dir.length();
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      m4.compose(mid, q, new THREE.Vector3(len + 0.12, 1, 1));
      railIM.setMatrixAt(i, m4); railIM.setColorAt(i, c.setScalar(0.85 + R() * 0.3));
    });
    this.group.add(railIM);
    // the rooster's post: on the front fence, a little right of centre
    let bi = startFront, bd = 1e9;
    for (let i = startFront; i <= runs[0][1]; i++) { const dd = Math.abs(posts[i][0] - 2.8); if (dd < bd) { bd = dd; bi = i; } }
    this.roosterPost = top[bi];

    // the shed: open front, plank walls, coppi roof
    const shed = new THREE.Group();
    const sx = 9.2, sd = 21, sy = H(sx, sd);
    shed.position.set(sx, sy, Z(sd)); shed.rotation.y = -0.35;
    const wood = '#7E6A52', plank = [];
    for (let i = 0; i < 16; i++) { const g = new THREE.BoxGeometry(0.22, 2.1 + (i / 15) * 0.5, 0.04); g.translate(-1.7 + i * 0.226, (2.1 + (i / 15) * 0.5) / 2, -1.25); plank.push([g, i % 3 ? wood : '#6E5B45']); }
    for (const sxx of [-1.8, 1.8]) for (let i = 0; i < 11; i++) { const hh = 2.1 + ((sxx + 1.8) / 3.6) * 0.5; const g = new THREE.BoxGeometry(0.04, hh - 0.05, 0.22); g.translate(sxx, hh / 2, -1.25 + i * 0.226); plank.push([g, i % 2 ? wood : '#6E5B45']); }
    for (const [px, pz] of [[-1.8, 1.25], [1.8, 1.25]]) { const g = new THREE.BoxGeometry(0.14, 2.6, 0.14); g.translate(px, 1.2 + (px > 0 ? 0.2 : 0), pz); plank.push([g, '#5E4C3A']); }
    const roofTilt = Math.atan2(0.5, 3.6);
    const roof = new THREE.BoxGeometry(4.2, 0.06, 3.2); roof.rotateZ(roofTilt); roof.translate(0, 2.42, 0); plank.push([roof, '#9E5A40']);
    for (let i = 0; i < 18; i++) {
      const g = new THREE.CylinderGeometry(0.1, 0.11, 3.3, 7, 1, false, Math.PI / 2, Math.PI); g.rotateX(Math.PI / 2); g.rotateZ(roofTilt);
      g.translate(-2 + i * 0.235, 2.47 + (-2 + i * 0.235) * Math.tan(roofTilt), 0); plank.push([g, i % 4 ? '#B8664A' : '#A55A40']);
    }
    const hay = lumpy(new THREE.BoxGeometry(2.4, 0.9, 1.2, 4, 2, 2), 0.12, 2, 4); hay.translate(-0.3, 0.45, -0.5); plank.push([hay, '#D4B46A']);
    const rack = new THREE.BoxGeometry(1.2, 0.08, 0.4); rack.translate(1, 1.0, -1.05); plank.push([rack, wood]);
    shed.add(new THREE.Mesh(merge(plank), this.mat));
    this.group.add(shed);
    // stone water trough
    const tr = []; const tx = 3.6, td = 15.5;
    const tg = new THREE.BoxGeometry(1.8, 0.55, 0.6, 3, 1, 1); lumpy(tg, 0.03, 4, 3); tg.translate(0, 0.27, 0); tr.push([tg, '#BDB4A0']);
    const water = new THREE.PlaneGeometry(1.6, 0.42); water.rotateX(-Math.PI / 2); water.translate(0, 0.5, 0); tr.push([water, '#8EA2A8']);
    const trough = new THREE.Mesh(merge(tr), this.mat); trough.position.set(tx, H(tx, td), Z(td)); trough.rotation.y = 0.15; this.group.add(trough);
    // rocks
    const rocks = []; for (let i = 0; i < 9; i++) { const x = -11 + R() * 22, d = 8 + R() * 18, s = 0.15 + R() * 0.35; const g = lumpy(new THREE.IcosahedronGeometry(s, 1), 0.3, 4 / s, i); g.scale(1.3, 0.6, 1); g.translate(x, H(x, d) + s * 0.2, Z(d)); rocks.push([g, '#B4AC9A']); }
    this.group.add(new THREE.Mesh(merge(rocks), this.mat));
    // the old fig tree in the paddock, and a cart wheel leaning on it
    const fig = treeGeo(rng(42), { h: 5.2, spread: 3.8, trunk: 0.3, leaves: '#6C7C42', bark: '#76675A', blobs: 13, blob: 1.3 });
    const figM = new THREE.Mesh(fig, this.mat); const fx = -8, fd = 22; figM.position.set(fx, H(fx, fd) - 0.1, Z(fd)); this.group.add(figM);
    this.figPos = new THREE.Vector3(fx, H(fx, fd), Z(fd));
    const wheel = merge([[new THREE.TorusGeometry(0.5, 0.04, 5, 24), '#6A5A48'], ...Array.from({ length: 6 }, (_, i) => { const g = new THREE.BoxGeometry(0.96, 0.03, 0.03); g.rotateZ(i * Math.PI / 6); return [g, '#6A5A48']; }), [new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10).rotateX(Math.PI / 2), '#5A4A3A']]);
    const wm = new THREE.Mesh(wheel, this.mat); wm.position.set(fx + 0.6, H(fx + 0.6, fd - 0.3) + 0.5, Z(fd - 0.3)); wm.rotation.set(-0.25, 0.4, 0); this.group.add(wm);
  }

  // --- telegraph poles and wires, with swallows perching ----------------------------------
  buildWires() {
    const poles = [[-46, 7.5], [-17, 9.5], [16, 11.5], [46, 12.5]];
    const parts = [], tops = [];
    for (const [x, d] of poles) {
      const y = H(x, d), h = 7.2;
      const g = lumpy(new THREE.CylinderGeometry(0.1, 0.14, h, 8, 6), 0.06, 3, x); g.translate(x, y + h / 2 - 0.3, Z(d)); parts.push([g, '#6E5E4C']);
      const arm = new THREE.BoxGeometry(1.5, 0.1, 0.1); arm.translate(x, y + h - 0.8, Z(d)); parts.push([arm, '#6E5E4C']);
      for (const ox of [-0.6, 0.6]) { const ins = new THREE.CylinderGeometry(0.04, 0.06, 0.16, 8); ins.translate(x + ox, y + h - 0.66, Z(d)); parts.push([ins, '#DCE4E0']); }
      tops.push([new THREE.Vector3(x - 0.6, y + h - 0.58, Z(d)), new THREE.Vector3(x + 0.6, y + h - 0.58, Z(d))]);
    }
    this.group.add(new THREE.Mesh(merge(parts), this.mat));
    const wm = makeInk({ color: '#2A2622', wash: 0.95, auto: true, spacing: 0.02 });
    this.wire = null;
    for (let i = 0; i < tops.length - 1; i++) for (const s of [0, 1]) {
      const a = tops[i][s], b = tops[i + 1][s];
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.55;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 4), wm);
      this.group.add(mesh);
      if (i === 1 && s === 0) this.wire = curve;
    }
  }

  // --- buildings ----------------------------------------------------------------------
  buildCasale() {
    const g = new THREE.Group();
    const cx = -66, cd = 120, base = Math.min(H(cx - 9, cd - 6), H(cx + 9, cd - 6), H(cx - 9, cd + 6), H(cx + 9, cd + 6));
    g.position.set(cx, base, Z(cd)); g.rotation.y = 0.22;
    const stone = '#D6C29C', stone2 = '#CDB48C', roofC = '#B4644A', shutter = '#6F8A62';
    const parts = [];
    const add = (geo, c) => parts.push([geo, c]);
    const blk = (w, h, d, x, y, z, c = stone) => { const b = new THREE.BoxGeometry(w, h, d, Math.ceil(w / 2), Math.ceil(h / 2), Math.ceil(d / 2)); lumpy(b, 0.004, 0.6, x); b.translate(x, y + h / 2, z); add(b, c); };
    // main block (sunk 3 m into the slope), annex, tower
    blk(16, 10, 9, 0, -3, 0); blk(7, 7, 6.5, 10.5, -3, 1); blk(5, 15, 5, -7.2, -3, -0.5, stone2);
    add(hipRoof(16.8, 9.8, 2.6, 0, 7, 0), roofC);
    add(shedRoof(7.6, 7, 1.4, 10.6, 4, 1), roofC);
    add(pyramidRoof(5.8, 2.4, -7.2, 12, -0.5), roofC);
    // dovecote openings and string course on the tower
    blk(5.4, 0.25, 5.4, -7.2, 10.2, -0.5, '#E2D2B0');
    for (const ox of [-1.4, 0, 1.4]) { const o = new THREE.BoxGeometry(0.45, 0.6, 0.2); o.translate(-7.2 + ox, 11, 2.02); add(o, '#2A2420'); }
    // chimney
    blk(0.9, 2.2, 0.9, 4.5, 7.6, -1.5, stone2); blk(1.3, 0.3, 1.3, 4.5, 9.8, -1.5, roofC);
    this.chimney = new THREE.Vector3(4.5, 10.3, -1.5);
    // a loggia of three arches on the ground floor
    for (let i = 0; i < 3; i++) {
      const x = -3 + i * 2.6;
      const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(-0.95, 1.9); sh.absarc(0, 1.9, 0.95, Math.PI, 0, true); sh.lineTo(0.95, 0); sh.lineTo(-0.95, 0);
      const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false, curveSegments: 8 }); ag.translate(x, 0, 4.0);
      add(ag, '#3A302A');
    }
    // windows with green shutters, two floors on the front, one on the annex
    const wins = [];
    for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) wins.push([x, 4.2, 4.52]);
    for (const x of [5.6]) wins.push([x, 1.4, 4.52]);
    for (const x of [9, 12.4]) wins.push([x, 1.6, 4.27]);
    wins.push([-7.2, 6.5, 2.02]);
    const winParts = [];
    for (const [x, y, z] of wins) {
      const w = new THREE.BoxGeometry(0.85, 1.25, 0.1); w.translate(x, y + 0.62, z); winParts.push([w, '#2A2420']);
      for (const s of [-1, 1]) { const sh = new THREE.BoxGeometry(0.44, 1.32, 0.06); sh.translate(x + s * 0.68, y + 0.64, z + 0.04); add(sh, shutter); }
      const sill = new THREE.BoxGeometry(1.05, 0.1, 0.25); sill.translate(x, y - 0.03, z + 0.08); add(sill, '#E6D8BA');
    }
    // door with stone surround, a stair, a pergola with a vine on the annex front
    blk(1.8, 2.6, 0.2, 10.5, 0, 4.3, '#E6D8BA'); { const dg = new THREE.BoxGeometry(1.3, 2.3, 0.1); dg.translate(10.5, 1.15, 4.42); add(dg, '#5A3E2E'); }
    for (let i = 0; i < 6; i++) { const p = new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6); p.translate(14.5 + (i % 3) * 1.6, 1.3, 5 + Math.floor(i / 3) * 3); add(p, '#7A6650'); }
    { const vine = lumpy(new THREE.BoxGeometry(3.8, 0.5, 3.6, 6, 1, 6), 0.25, 1.3, 7); vine.translate(16.1, 2.85, 6.5); add(vine, '#6E8040'); }
    const mesh = new THREE.Mesh(merge(parts), this.mat);
    const glow = glowMat('#FFC56A');
    this.glowMats.push(glow);
    g.add(mesh, new THREE.Mesh(merge(winParts), glow));
    // two cypresses beside it and a haystack
    this.group.add(g);
    this.casale = g;
    const cyp = new THREE.InstancedMesh(cypressGeo(), this.mat, 3);
    [[-76, 113, 12], [-74.5, 116, 10], [-52, 112, 11]].forEach(([x, d, h], i) => { cyp.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, d) - 0.2, Z(d)), new THREE.Quaternion(), new THREE.Vector3(h * 0.95, h, h * 0.95))); });
    this.group.add(cyp);
  }

  buildChapel() {
    const g = new THREE.Group();
    const cx = 74, cd = 176;
    g.position.set(cx, H(cx, cd) - 1.5, Z(cd)); g.rotation.y = -0.4;
    const st = '#E2D2B2', parts = [];
    const nave = new THREE.BoxGeometry(6.5, 7.5, 11); nave.translate(0, 3.75, 0); parts.push([nave, st]);
    parts.push([gableRoof(7.2, 11.6, 2.3, 0, 7.5, 0), '#B4644A']);
    // facade gable, bell-cote with an arch and a bell
    const fs = new THREE.Shape(); fs.moveTo(-3.4, 0); fs.lineTo(3.4, 0); fs.lineTo(3.4, 7.6); fs.lineTo(0, 10.2); fs.lineTo(-3.4, 7.6); fs.lineTo(-3.4, 0);
    const fac = new THREE.ExtrudeGeometry(fs, { depth: 0.5, bevelEnabled: false }); fac.translate(0, 0, 5.45); parts.push([fac, '#E9DCC0']);
    const bc = new THREE.Shape(); bc.moveTo(-1, 0); bc.lineTo(1, 0); bc.lineTo(1, 2.4); bc.lineTo(0, 3.1); bc.lineTo(-1, 2.4); bc.lineTo(-1, 0);
    const hole = new THREE.Path(); hole.moveTo(-0.5, 0.4); hole.lineTo(0.5, 0.4); hole.lineTo(0.5, 1.5); hole.absarc(0, 1.5, 0.5, 0, Math.PI, false); hole.lineTo(-0.5, 0.4); bc.holes.push(hole);
    const bell = new THREE.ExtrudeGeometry(bc, { depth: 0.4, bevelEnabled: false, curveSegments: 8 }); bell.translate(0, 10.0, 5.5); parts.push([bell, '#E9DCC0']);
    const b = new THREE.CylinderGeometry(0.18, 0.32, 0.5, 10); b.translate(0, 10.85, 5.7); parts.push([b, '#7A6248']);
    const door = new THREE.BoxGeometry(1.4, 2.6, 0.1); door.translate(0, 1.3, 5.97); parts.push([door, '#4A3428']);
    const rose = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16); rose.rotateX(Math.PI / 2); rose.translate(0, 5.3, 5.97); parts.push([rose, '#2A2420']);
    const step = new THREE.BoxGeometry(3, 0.3, 1.2); step.translate(0, 1.6, 6.4); parts.push([step, '#D8CCB0']);
    g.add(new THREE.Mesh(merge(parts), this.mat));
    this.group.add(g);
    const cyp = new THREE.InstancedMesh(cypressGeo(), this.mat, 3);
    [[66, 170, 13], [82, 172, 11], [84, 178, 14]].forEach(([x, d, h], i) => cyp.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, d) - 0.2, Z(d)), new THREE.Quaternion(), new THREE.Vector3(h * 0.95, h, h * 0.95))));
    this.group.add(cyp);
  }

  buildFarms() {
    const R = rng(19), parts = [], wins = [];
    for (const [x, d, w, dep, h, rot] of [[-150, 260, 12, 8, 7, 0.4], [40, 300, 10, 7, 6, -0.2], [-30, 420, 14, 9, 8, 0.1], [110, 440, 9, 7, 6, 0.5], [-180, 520, 12, 8, 7, -0.3], [260, 460, 11, 8, 7, 0.2], [-60, 640, 12, 8, 7, 0.6], [30, 260, 8, 6, 5, 0.9]]) {
      const y = H(x, d) - 1.5, m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, Z(d)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
      const body = new THREE.BoxGeometry(w, h + 1.5, dep); body.translate(0, (h + 1.5) / 2, 0); body.applyMatrix4(m); parts.push([body, R() < 0.5 ? '#DCC8A2' : '#E2D0AE']);
      const r = hipRoof(w + 0.8, dep + 0.8, 2, 0, h + 1.5, 0); r.applyMatrix4(m); parts.push([r, '#B4644A']);
      for (let i = 0; i < Math.floor(w / 3); i++) for (let f = 0; f < 2; f++) { const wg = new THREE.BoxGeometry(0.8, 1.1, 0.1); wg.translate(-w / 2 + 1.5 + i * 3, 2 + f * 3, dep / 2 + 0.02); wg.applyMatrix4(m); wins.push([wg, '#2A2420']); }
      if (R() < 0.6) { const t = new THREE.BoxGeometry(3.5, h + 5, 3.5); t.translate(w / 2 - 1.5, (h + 5) / 2, 0); t.applyMatrix4(m); parts.push([t, '#D2BC94']); const pr = pyramidRoof(4.2, 1.8, w / 2 - 1.5, h + 5, 0); pr.applyMatrix4(m); parts.push([pr, '#B4644A']); }
    }
    this.group.add(new THREE.Mesh(merge(parts), this.mat));
    const glow = glowMat('#FFC56A'); this.glowMats.push(glow);
    this.group.add(new THREE.Mesh(merge(wins), glow));
  }

  buildTown() {
    const R = rng(23), parts = [], wins = [];
    const cx = 175, cd = 780;
    for (let i = 0; i < 46; i++) {
      const a = R() * 6.28, r = Math.sqrt(R()) * 70;
      const x = cx + Math.cos(a) * r, d = cd + Math.sin(a) * r * 0.6;
      const w = 7 + R() * 9, dep = 6 + R() * 7, h = 8 + R() * 10 - r * 0.05;
      const y = H(x, d) - 2;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, Z(d)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (R() - 0.5) * 0.6), new THREE.Vector3(1, 1, 1));
      const body = new THREE.BoxGeometry(w, h, dep); body.translate(0, h / 2, 0); body.applyMatrix4(m); parts.push([body, ['#DCC6A0', '#E4D2B0', '#D4B890', '#E8D8BC'][Math.floor(R() * 4)]]);
      const rf = R() < 0.6 ? hipRoof(w + 0.6, dep + 0.6, 2, 0, h, 0) : gableRoof(w + 0.6, dep + 0.6, 2.2, 0, h, 0); rf.applyMatrix4(m); parts.push([rf, R() < 0.5 ? '#B4644A' : '#A85E46']);
      for (let k = 0; k < 3; k++) if (R() < 0.6) { const wg = new THREE.BoxGeometry(1, 1.3, 0.1); wg.translate(-w / 3 + k * w / 3, h * 0.5 + (R() - 0.5) * h * 0.4, dep / 2 + 0.05); wg.applyMatrix4(m); wins.push([wg, '#2A2420']); }
    }
    // walls, the campanile and a dome
    const ty = H(cx, cd);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.28; const x = cx + Math.cos(a) * 82, d = cd + Math.sin(a) * 50; const wg = new THREE.BoxGeometry(24, 8, 2.5); wg.rotateY(-a + Math.PI / 2); wg.translate(x, H(x, d) + 1, Z(d)); parts.push([wg, '#CDB48E']); }
    const tw = new THREE.BoxGeometry(6, 38, 6); tw.translate(cx - 12, ty + 19, Z(cd + 10)); parts.push([tw, '#D8C29C']);
    const pr = pyramidRoof(7, 6, cx - 12, ty + 38, Z(cd + 10)); parts.push([pr, '#A85E46']);
    const dome = new THREE.SphereGeometry(9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(cx + 14, ty + 18, Z(cd + 18)); parts.push([dome, '#B86A4E']);
    const drum = new THREE.CylinderGeometry(9.2, 9.2, 8, 16); drum.translate(cx + 14, ty + 14, Z(cd + 18)); parts.push([drum, '#E2D0AE']);
    const lantern = new THREE.CylinderGeometry(1.5, 1.5, 4, 8); lantern.translate(cx + 14, ty + 28, Z(cd + 18)); parts.push([lantern, '#E2D0AE']);
    this.group.add(new THREE.Mesh(merge(parts), this.mat));
    const glow = glowMat('#FFD27A'); this.glowMats.push(glow);
    this.group.add(new THREE.Mesh(merge(wins), glow));
  }

  // --- the viaduct ------------------------------------------------------------------------
  buildViaduct() {
    const X0 = -280, X1 = 280, SPAN = 16, R0 = 6.1, SPRING = DECK - 2.4 - R0, BOTTOM = -48;
    const sh = new THREE.Shape(); sh.moveTo(X0, BOTTOM); sh.lineTo(X1, BOTTOM); sh.lineTo(X1, DECK); sh.lineTo(X0, DECK); sh.lineTo(X0, BOTTOM);
    const centres = [];
    for (let x = X0 + SPAN / 2; x < X1; x += SPAN) {
      centres.push(x);
      const hl = new THREE.Path(); hl.moveTo(x - R0, BOTTOM + 1); hl.lineTo(x + R0, BOTTOM + 1); hl.lineTo(x + R0, SPRING); hl.absarc(x, SPRING, R0, 0, Math.PI, false); hl.lineTo(x - R0, BOTTOM + 1);
      sh.holes.push(hl);
    }
    const depth = 6.4, z = Z(VIA_D);
    const body = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 14 }); body.translate(0, 0, z - depth / 2);
    // give the brick faces a slightly irregular tone in vertex colour
    const parts = [[body, '#BA7052']];
    const box = (w, h, d, x, y, zz, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, zz); parts.push([g, c]); };
    box(X1 - X0, 0.7, depth + 0.8, 0, DECK - 0.35, z, '#C88A6A');       // cornice
    box(X1 - X0, 0.45, depth + 0.5, 0, SPRING, z, '#C88A6A');             // string course at the springing
    for (const s of [-1, 1]) box(X1 - X0, 1.1, 0.35, 0, DECK + 0.55, z + s * (depth / 2 + 0.1), '#B46A4C'); // parapets
    for (let i = 0; i <= centres.length; i++) {
      const px = X0 + i * SPAN;
      for (const s of [-1, 1]) box(2.2, SPRING - BOTTOM, 0.5, px, (SPRING + BOTTOM) / 2, z + s * (depth / 2 + 0.25), '#B0684A'); // pilasters
    }
    // arch rings, standing proud of the face
    const ring = new THREE.Shape(); ring.absarc(0, 0, R0 + 0.75, 0, Math.PI, false); ring.lineTo(-R0, 0); ring.absarc(0, 0, R0, Math.PI, 0, true); ring.lineTo(R0 + 0.75, 0);
    const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: depth + 0.5, bevelEnabled: false, curveSegments: 14 });
    for (const x of centres) { const g = ringGeo.clone(); g.translate(x, SPRING, z - depth / 2 - 0.25); parts.push([g, '#C99072']); }
    // catenary masts
    const masts = [];
    for (let x = X0 + 8; x < X1; x += 32) { const g = new THREE.BoxGeometry(0.35, 7, 0.35); g.translate(x, DECK + 3.5, z - depth / 2 + 0.6); masts.push([g, '#6A6A66']); const a = new THREE.BoxGeometry(0.15, 0.15, 3.4); a.translate(x, DECK + 6.4, z - depth / 2 + 2.2); masts.push([a, '#6A6A66']); }
    const via = new THREE.Mesh(merge([...parts, ...masts]), this.mat);
    via.name = 'viaduct';
    this.group.add(via);
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X0, DECK + 6.1, z - depth / 2 + 3.6), new THREE.Vector3(X1, DECK + 6.1, z - depth / 2 + 3.6)]),
      new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.5 }));
    wire.layers.set(1); this.group.add(wire);
    this.rail = { y: DECK + 0.25, z: z + 0.2, x0: X0, x1: X1 };
    this.trainMats = { regionale: trainMats('regionale'), intercity: trainMats('intercity') };
  }

  spawnTrain(now) {
    const dir = Math.random() < 0.5 ? 1 : -1, intercity = Math.random() < 0.3;
    const n = intercity ? 7 : 3 + Math.floor(Math.random() * 2);
    const g = new THREE.Group(); g.name = 'train';
    const mats = this.trainMats[intercity ? 'intercity' : 'regionale'];
    for (let i = 0; i < n; i++) {
      const car = makeCar(mats, i === 0 ? 'front' : i === n - 1 && !intercity ? 'back' : 'mid', intercity && i === 0);
      car.position.x = -i * 25.2 * dir; car.rotation.y = dir > 0 ? 0 : Math.PI;
      g.add(car);
    }
    const len = n * 25.2;
    const start = dir > 0 ? this.rail.x0 - 30 : this.rail.x1 + 30;
    g.position.set(start, this.rail.y, this.rail.z);
    this.group.add(g);
    this.trains.push({ g, dir, speed: intercity ? 34 : 22, end: dir > 0 ? this.rail.x1 + len + 30 : this.rail.x0 - len - 30 });
    this.audio?.train(intercity);
  }

  buildSmoke() {
    const tex = puffTexture();
    this.puffs = [];
    this.casale.updateWorldMatrix(true, false);
    const origin = this.casale.localToWorld(this.chimney.clone());
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.6 }));
      s.layers.set(1); s.renderOrder = -5;
      s.userData.phase = i / 9;
      this.group.add(s); this.puffs.push(s);
    }
    this.smokeOrigin = origin;
  }

  // --- per frame ------------------------------------------------------------------------
  setDusk(dusk) {
    const u = this.skyU;
    const top = new THREE.Color('#7FA2C2').lerp(new THREE.Color('#34406E'), dusk);
    const hor = new THREE.Color('#F3C892').lerp(new THREE.Color('#D88E7E'), dusk);
    u.uTop.value.copy(top); u.uHorizon.value.copy(hor);
    u.uGlow.value.set('#FFB25A').lerp(new THREE.Color('#E86A50'), dusk).multiplyScalar(1 - dusk * 0.4);
    u.uSun.value.set('#FFF2D0').lerp(new THREE.Color('#FF9A62'), dusk);
    this.sunDir(u.uSunDir.value);
    this.scene.fog.color.set('#E8C9A2').lerp(new THREE.Color('#A493A8'), dusk);
    const cloudTint = new THREE.Color('#FFFFFF').lerp(new THREE.Color('#D8A0A8'), dusk);
    for (const c of this.clouds) c.material.color.copy(cloudTint);
    const glow = THREE.MathUtils.smoothstep(dusk, 0.45, 0.85) * 1.4;
    for (const m of this.glowMats) m.emissiveIntensity = glow;
    for (const k of ['regionale', 'intercity']) this.trainMats[k].win.emissiveIntensity = glow;
  }

  update(now, dt) {
    const dusk = this.dusk;
    if (Math.abs(dusk - this.lastDusk) > 0.002) { this.lastDusk = dusk; this.setDusk(dusk); }
    if (!this.active) return;
    dt = Math.min(dt, 0.1);
    for (const c of this.clouds) {
      c.userData.a += c.userData.drift * dt;
      const { a, e, dist } = c.userData;
      c.position.set(EYE.x + Math.sin(a) * Math.cos(e) * dist, EYE.y + Math.sin(e) * dist, EYE.z - Math.cos(a) * Math.cos(e) * dist);
      c.lookAt(EYE);
    }
    if (now > this.nextTrain) { this.spawnTrain(now); this.nextTrain = now + 40000 + Math.random() * 50000; }
    for (const t of this.trains) t.g.position.x += t.dir * t.speed * dt;
    this.trains = this.trains.filter((t) => { const done = t.dir > 0 ? t.g.position.x > t.end : t.g.position.x < t.end; if (done) { this.group.remove(t.g); } return !done; });
    // chimney smoke, leaning with the evening breeze
    for (const s of this.puffs) {
      const ph = (now / 14000 + s.userData.phase) % 1;
      s.position.copy(this.smokeOrigin).add(new THREE.Vector3(ph * 7 + Math.sin(ph * 6 + s.userData.phase * 9) * 0.6, ph * 12, -ph * 2));
      s.scale.setScalar(1.2 + ph * 6);
      s.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, ph * 1.4)) * (1 - ph);
    }
    this.animals.update(now, dt, this.leaning);
    if (now > this.nextCrow) { this.crow(); this.nextCrow = now + 120000 + Math.random() * 120000; }
  }

  /** Raycast the animals; returns 'donkey' | 'rooster' | null and makes it call. */
  pick(raycaster, maxDist = Infinity) {
    const hit = this.animals.pick(raycaster);
    if (!hit || hit.distance > maxDist) return null;
    if (hit.kind === 'rooster') this.crow(); else this.bray(hit.animal);
    return hit.kind;
  }
  crow() { this.animals.crow(); this.audio?.rooster(); }
  bray(a) { this.animals.bray(a); this.audio?.bray(); }
  setVisible(v) { this.group.visible = v; }
}

// --- ground colour ------------------------------------------------------------------------
function groundColour(c, x, d, ny, self) {
  const n = vnoise(x * 0.35, d * 0.35), n2 = fbm(x / 9, d / 9, 3);
  if (inPaddock(x, d)) {
    c.copy(COL.grass).lerp(COL.dry, sm(0.35, 0.75, n2));
    const worn = Math.max(sm(5, 1.5, Math.hypot(x - 9.2, d - 19.5)), sm(3, 1, Math.hypot(x - 3.6, d - 15.5)), sm(3.2, 1.2, Math.hypot(x + 8, d - 22)) * 0.6);
    c.lerp(COL.bare, worn * 0.8);
  } else if (d < 34) {
    c.copy(COL.meadow).lerp(COL.dry, sm(0.4, 0.8, n2) * 0.7);
  } else {
    const f = field(x, d);
    c.copy(COL[f.type]);
    // ploughed and planted fields get furrow stripes of tone
    if (f.type === 'plough' || f.type === 'wheat' || f.type === 'sunflower') c.multiplyScalar(0.94 + 0.1 * Math.sin((x * 0.9 + d * 0.4) * 1.3));
    if (f.edge < 0.04) c.lerp(COL.hedge, 0.6);
    c.lerp(COL.scrub, sm(0.92, 0.78, ny) * 0.7);
    c.lerp(COL.far, sm(450, 1100, d));
  }
  c.multiplyScalar(0.92 + 0.14 * n);
  return c;
}

// --- tree and object geometry -------------------------------------------------------------
function cypressGeo() {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = t < 0.06 ? 0.55 + (t / 0.06) * 0.45 : Math.pow(1 - t, 0.78) * (1 + 0.12 * Math.sin(t * 9));
    pts.push(new THREE.Vector2(Math.max(0.004, r * 0.105), 0.05 + t * 0.95));
  }
  const g = new THREE.LatheGeometry(pts, 11);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (vnoise(x * 60 + y * 7, z * 60 + y * 31) - 0.5) * 0.55;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  const trunk = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6); trunk.translate(0, 0.035, 0);
  return merge([[g, '#4A5A33'], [trunk, '#5E4A36']]);
}
function oliveGeo() {
  const parts = [];
  const tr = new THREE.CylinderGeometry(0.13, 0.24, 1.5, 6, 3, true);
  const p = tr.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 2.2) * 0.12); p.setZ(i, p.getZ(i) + Math.cos(y * 1.7) * 0.08); }
  tr.computeVertexNormals(); tr.translate(0, 0.75, 0); parts.push([tr, '#6E5E4E']);
  parts.push([limb(new THREE.Vector3(0.05, 1.3, 0), new THREE.Vector3(0.8, 2.2, 0.2), 0.1, 0.05), '#6E5E4E']);
  parts.push([limb(new THREE.Vector3(-0.05, 1.3, 0), new THREE.Vector3(-0.7, 2.1, -0.3), 0.1, 0.05), '#6E5E4E']);
  const R = rng(3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28, r = i === 0 ? 0 : 0.85;
    const b = lumpy(new THREE.IcosahedronGeometry(0.7 + R() * 0.35, 0), 0.18, 2.4, i);
    b.scale(1.1, 0.75, 1.1); b.translate(Math.cos(a) * r, 2.35 + R() * 0.45 + (i === 0 ? 0.35 : 0), Math.sin(a) * r);
    parts.push([b, i % 2 ? '#8E977A' : '#7F8A6A']);
  }
  return merge(parts);
}
function pineGeo() {
  const parts = [];
  parts.push([limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 9.5, 0.2), 0.32, 0.2, 7), '#6A5646']);
  parts.push([limb(new THREE.Vector3(0.5, 8.4, 0.15), new THREE.Vector3(-1.8, 10, 0.4), 0.15, 0.08), '#6A5646']);
  parts.push([limb(new THREE.Vector3(0.55, 9, 0.18), new THREE.Vector3(2.4, 10.2, -0.6), 0.14, 0.08), '#6A5646']);
  const R = rng(9);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28, r = i === 0 ? 0 : 2.1 + R() * 0.8;
    const b = lumpy(new THREE.IcosahedronGeometry(1.6 + R() * 0.5, 1), 0.2, 1.4, i);
    b.scale(1.2, 0.45, 1.2); b.translate(0.5 + Math.cos(a) * r, 10.3 + R() * 0.6, Math.sin(a) * r);
    parts.push([b, '#52633A']);
  }
  return merge(parts);
}
function vineGeo() {
  const g = lumpy(new THREE.BoxGeometry(0.55, 1.05, 2.25, 1, 1, 2), 0.14, 2.2, 1); g.translate(0, 0.62, 0);
  return merge([[g, '#6E8343']]);
}
function shrubGeo() { const g = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.25, 1.6, 2); g.translate(0, 0.7, 0); return merge([[g, '#5E6E3C']]); }
function baleGeo() {
  const g = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 16, 1); g.rotateX(Math.PI / 2);
  const rings = []; for (const z of [-0.61, 0.61]) for (const r of [0.25, 0.5]) { const t = new THREE.TorusGeometry(r, 0.03, 3, 18); t.translate(0, 0, z); rings.push([t, '#B89A58']); }
  return merge([[g, '#D9BA70'], ...rings]);
}
function pagliaioGeo() {
  const g = lumpy(new THREE.LatheGeometry([0, 0.6, 0.85, 0.75, 0.45, 0.02].map((r, i) => new THREE.Vector2(r * 2.4, i * 1.0)), 12), 0.05, 1.5, 3);
  const pole = new THREE.CylinderGeometry(0.05, 0.06, 6.6, 5); pole.translate(0, 3.3, 0);
  return merge([[g, '#CDAE64'], [pole, '#6A5A48']]);
}
function tuftGeo() {
  const parts = [], R = rng(8);
  for (let i = 0; i < 6; i++) {
    const h = 0.18 + R() * 0.2, c = new THREE.ConeGeometry(0.011, h, 3);
    c.translate(0, h / 2, 0); c.rotateZ((R() - 0.5) * 0.9); c.rotateY(R() * 6.28); c.translate((R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.12);
    parts.push([c, ['#8F9450', '#A3A15E', '#B8AE6C'][i % 3]]);
  }
  return merge(parts);
}
/** A broad tree: a branching trunk with leafy clumps at the ends. */
function treeGeo(R, o) {
  const parts = [];
  const ends = [];
  const grow = (a, dir, len, r, depth) => {
    const b = a.clone().addScaledVector(dir, len);
    parts.push([limb(a, b, r, r * 0.7, 6), o.bark]);
    if (depth === 0) { ends.push(b); return; }
    const n = depth > 2 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(new THREE.Vector3((R() - 0.5) * 1.8, 0.1 + R() * 0.3, (R() - 0.5) * 1.8)).normalize();
      grow(b, nd, len * (0.62 + R() * 0.15), r * 0.68, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.18, 1, 0.08).normalize(), o.h * 0.3, o.trunk, 3);
  // leafy clumps: a few around every branch tip, lighter on top
  const leaf = new THREE.Color(o.leaves), top = leaf.clone().lerp(new THREE.Color('#C8C890'), 0.25);
  for (const e of ends) {
    for (let k = 0; k < 3; k++) {
      const r = o.blob * (0.45 + R() * 0.35);
      const b = lumpy(new THREE.IcosahedronGeometry(r, 2), 0.28, 3 / r, R() * 9);
      b.scale(1.2, 0.75, 1.2);
      b.translate(e.x + (R() - 0.5) * o.blob, e.y + 0.2 + (R() - 0.3) * o.blob * 0.6, e.z + (R() - 0.5) * o.blob);
      const p = b.attributes.position, nrm = b.attributes.normal, cols = [];
      for (let i = 0; i < p.count; i++) { const c = leaf.clone().lerp(top, Math.max(0, nrm.getY(i))); cols.push(c.r, c.g, c.b); }
      b.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      parts.push([b, '#ffffff']);
    }
  }
  return merge(parts);
}
function hipRoof(w, d, h, x, y, z) {
  const hw = w / 2, hd = d / 2, ridge = Math.max(0, hw - hd);
  const v = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [-ridge, h, 0], [ridge, h, 0]];
  const f = [[0, 1, 5], [0, 5, 4], [1, 2, 5], [2, 3, 4], [2, 4, 5], [3, 0, 4]];
  return polyGeo(v, f, x, y, z, 0.3);
}
function gableRoof(w, d, h, x, y, z) {
  const hw = w / 2, hd = d / 2;
  const v = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, h, -hd], [0, h, hd]];
  const f = [[0, 4, 1], [3, 2, 5], [1, 4, 5], [1, 5, 2], [0, 3, 5], [0, 5, 4]];
  return polyGeo(v, f, x, y, z, 0.3);
}
function shedRoof(w, d, h, x, y, z) {
  const hw = w / 2, hd = d / 2;
  const v = [[-hw, h, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, h, hd]];
  return polyGeo(v, [[0, 1, 2], [0, 2, 3]], x, y, z, 0.25);
}
function pyramidRoof(w, h, x, y, z) {
  const s = w / 2;
  const v = [[-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s], [0, h, 0]];
  return polyGeo(v, [[0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]], x, y, z, 0.25);
}
/** Faces from a vertex list (as both sides, so winding never matters), with a thin eave slab under it. */
function polyGeo(v, faces, x, y, z, thick) {
  const pos = [];
  for (const f of faces) {
    const [a, b, c] = f.map((i) => v[i]);
    pos.push(...a, ...b, ...c, ...a, ...c, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.translate(x, y + thick * 0, z);
  return g;
}
function glowMat(col) { const m = ext(); m.emissive = new THREE.Color(col); m.emissiveIntensity = 0; return m; }

// --- trains -------------------------------------------------------------------------------
function trainMats(kind) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = 1024; e.height = 128;
  const ex = e.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, 1024, 128);
  if (kind === 'regionale') {
    x.fillStyle = '#ECEAE2'; x.fillRect(0, 0, 1024, 128);
    x.fillStyle = '#2F7A4A'; x.fillRect(0, 92, 1024, 22);
    x.fillStyle = '#2F4E8A'; x.fillRect(0, 114, 1024, 14);
  } else {
    x.fillStyle = '#B9BDBF'; x.fillRect(0, 0, 1024, 128);
    x.fillStyle = '#5A6066'; x.fillRect(0, 36, 1024, 44);
    x.fillStyle = '#B8342E'; x.fillRect(0, 96, 1024, 10);
  }
  // windows and doors
  for (let i = 0; i < 12; i++) {
    const wx = 60 + i * 76; if (i === 0 || i === 11) continue;
    x.fillStyle = '#2C2E34'; x.fillRect(wx, 40, 56, 36); ex.fillStyle = '#fff'; ex.fillRect(wx, 40, 56, 36);
  }
  for (const dx of [30, 950]) { x.fillStyle = '#3A3E44'; x.fillRect(dx, 30, 40, 84); x.strokeStyle = '#1A1714'; x.strokeRect(dx, 30, 40, 84); }
  x.strokeStyle = '#1A1714'; x.lineWidth = 2; x.strokeRect(1, 1, 1022, 126);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(e);
  const body = makeInk({ color: kind === 'regionale' ? '#ECEAE2' : '#B9BDBF', wash: 0.8, auto: true, spacing: 0.02, lift: 0.08 });
  const win = makeInk({ color: '#ffffff', map, wash: 0.92, auto: true, spacing: 0.02, lift: 0.08, emissiveMap: em, emissive: 0, emissiveColor: '#FFD890' });
  const dark = makeInk({ color: '#3A3A3C', wash: 0.9, auto: true, spacing: 0.02 });
  return { body, win, dark, kind };
}
function makeCar(m, role, loco) {
  const g = new THREE.Group();
  const L = 24.6, W = 2.9, Hh = 3.7;
  const prof = new THREE.Shape();
  prof.moveTo(-W / 2, 0.9); prof.lineTo(W / 2, 0.9); prof.lineTo(W / 2, Hh - 0.5); prof.quadraticCurveTo(W / 2, Hh, 0, Hh + 0.05); prof.quadraticCurveTo(-W / 2, Hh, -W / 2, Hh - 0.5); prof.lineTo(-W / 2, 0.9);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: L, bevelEnabled: false, curveSegments: 6 }), m.body);
  body.geometry.translate(0, 0, -L / 2); body.rotation.y = Math.PI / 2;
  g.add(body);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.4, Hh - 1.2), m.win);
    side.position.set(0, 0.9 + (Hh - 1.2) / 2 + 0.1, s * (W / 2 + 0.01)); side.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(side);
  }
  for (const bx of [-8.5, 8.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.75, 2.4), m.dark); b.position.set(bx, 0.45, 0); g.add(b); }
  const ac = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 1.6), m.dark); ac.position.set(4, Hh + 0.15, 0); g.add(ac);
  if (role === 'front' || role === 'back') {
    // cab end: windscreen and a sloped nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, Hh - 1.4, W - 0.1), m.body); nose.position.set((role === 'front' ? 1 : -1) * (L / 2 + 0.5), 0.9 + (Hh - 1.4) / 2, 0); g.add(nose);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, W - 0.5), m.dark); ws.position.set((role === 'front' ? 1 : -1) * (L / 2 + 1.12), Hh - 0.9, 0); ws.rotation.z = (role === 'front' ? -1 : 1) * 0.35; g.add(ws);
    if (role === 'front' || loco) {
      const pan = new THREE.Group();
      for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), m.dark); a.position.set(s * 0.6, 0.7, 0); a.rotation.z = s * 0.6; pan.add(a); }
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.8), m.dark); shoe.position.y = 1.35; pan.add(shoe);
      pan.position.set((role === 'front' ? 1 : -1) * (L / 2 - 3.5), Hh + 0.1, 0); g.add(pan);
    }
  }
  return g;
}

// --- drawn textures -----------------------------------------------------------------------
function cloudTexture(R, kind) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = kind === 'streak' ? 256 : 420;
  const x = c.getContext('2d'), W = c.width, Hc = c.height;
  const blobs = [];
  if (kind === 'streak') {
    for (let i = 0; i < 9; i++) blobs.push([120 + R() * 780, Hc * 0.5 + (R() - 0.5) * 50, 80 + R() * 120, 14 + R() * 18]);
  } else {
    const base = Hc * 0.78;
    for (let i = 0; i < 11; i++) { const bx = 160 + (i / 10) * 700 + (R() - 0.5) * 60, r = 50 + R() * 70 * Math.sin(Math.PI * (0.15 + 0.7 * i / 10)); blobs.push([bx, base - r * (0.55 + R() * 0.4), r * 1.15, r]); }
    blobs.push([W / 2, base - 20, 380, 30]);
  }
  const ell = (b, grow) => { x.beginPath(); x.ellipse(b[0], b[1], b[2] + grow, b[3] + grow, 0, 0, Math.PI * 2); };
  // ink outline: stroke all, then cover the insides
  x.strokeStyle = 'rgba(26,23,20,0.75)'; x.lineWidth = 2.2;
  for (const b of blobs) { ell(b, 0); x.stroke(); }
  const grad = x.createLinearGradient(0, 0, 0, Hc);
  grad.addColorStop(0, '#FFF6EA'); grad.addColorStop(0.55, '#FBE2C4'); grad.addColorStop(1, '#F2B38E');
  x.fillStyle = grad;
  for (const b of blobs) { ell(b, -1.6); x.fill(); }
  // hatch the shaded undersides, clipped to the cloud
  x.save();
  x.beginPath(); for (const b of blobs) { x.moveTo(b[0] + b[2] - 2, b[1]); x.ellipse(b[0], b[1], b[2] - 2, b[3] - 2, 0, 0, Math.PI * 2); } x.clip();
  x.strokeStyle = 'rgba(120,80,70,0.32)'; x.lineWidth = 1.3;
  const top = kind === 'streak' ? Hc * 0.5 : Hc * 0.55;
  for (let i = -Hc; i < W; i += 9) { if (R() < 0.25) continue; x.beginPath(); x.moveTo(i, Hc); x.lineTo(i + (Hc - top) * 0.8, top + R() * 30); x.stroke(); }
  x.restore();
  // a soft edge so the card never shows
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 60); g.addColorStop(0, 'rgba(236,228,220,0.9)'); g.addColorStop(1, 'rgba(236,228,220,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(26,23,20,0.35)'; x.lineWidth = 2;
  x.beginPath(); x.arc(64, 64, 40, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
