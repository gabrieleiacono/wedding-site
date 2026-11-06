// The desk lamp, back left of the desk: a Sicilian majolica baluster from Caltagirone, painted with
// lemon branches, under a pleated linen shade. Its origin is the foot on the desk top. The shade and
// bulb glow as the room drifts into the blue hour (see setGlow).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';

const V2 = (r, y) => new THREE.Vector2(r, y);
function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
const lathe = (pts, mat, parent, seg = 40, y = 0) => mesh(new THREE.LatheGeometry(pts.map(([r, h]) => V2(r, h)), seg), mat, parent, 0, y, 0);
const cylr = (rt, rb, h, mat, parent, x, y, z, seg = 20, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, parent, x, y, z);
const sph = (r, mat, parent, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), mat, parent, x, y, z);
function tube(points, r, mat, parent, seg = 64, rs = 8) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(c, seg, r, rs, false), mat, parent);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/** the flex running from the foot back to the wall socket, with an inline rocker switch */
function cord(parent, from, mat, switchMat) {
  const [x, y, z] = from;
  tube([[x, y, z], [x - 0.02, 0.004, z - 0.03], [x - 0.05, 0.003, z - 0.08], [x - 0.02, 0.003, z - 0.11], [x + 0.03, 0.004, -0.13]], 0.0028, mat, parent, 48, 6);
  if (switchMat) {
    const s = mesh(new THREE.BoxGeometry(0.03, 0.012, 0.016), switchMat, parent, x - 0.045, 0.006, z - 0.075);
    s.rotation.y = 0.9;
    const r = mesh(new THREE.BoxGeometry(0.012, 0.004, 0.009), switchMat, s, 0, 0.007, 0); r.rotation.z = 0.2;
  }
}

/** The tin-glaze painting: blue bands and scallops, four lemon branches, a running scroll. */
function majolica() {
  return canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#F4ECD8'; c.fillRect(0, 0, w, h); // tin glaze
    const blue = '#1F4E8C', yellow = '#E3A21A', green = '#3C7A3A', manganese = '#5B3A2A';
    // v runs bottom (0) to top (1) along the lathe; canvas y=0 is the top of the vase
    const band = (y, hh, col) => { c.fillStyle = col; c.fillRect(0, y, w, hh); };
    band(0, 18, blue); band(22, 6, yellow); band(h - 18, 18, blue); band(h - 28, 6, yellow);
    // shoulder band: blue scallops
    c.strokeStyle = blue; c.lineWidth = 5;
    for (let x = 0; x < w; x += 64) { c.beginPath(); c.arc(x + 32, 60, 26, 0, Math.PI); c.stroke(); }
    // belly: four lemons on a leafy branch, yellow and green with manganese outlines
    for (let k = 0; k < 4; k++) {
      const cx = k * 256 + 128, cy = 270;
      c.strokeStyle = green; c.lineWidth = 8; c.beginPath();
      c.moveTo(cx - 120, cy + 40); c.bezierCurveTo(cx - 60, cy - 60, cx + 60, cy + 70, cx + 120, cy - 30); c.stroke();
      for (const [lx, ly, a] of [[-80, 0, -0.6], [-20, 10, 0.5], [40, 20, -0.4], [95, -10, 0.7], [-50, 40, 2.4], [70, 40, 2.6]]) {
        c.save(); c.translate(cx + lx, cy + ly); c.rotate(a); c.fillStyle = green; c.beginPath(); c.ellipse(0, -22, 11, 26, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = manganese; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -44); c.stroke(); c.restore();
      }
      for (const [lx, ly] of [[-40, -30], [30, -50], [10, 50]]) {
        c.save(); c.translate(cx + lx, cy + ly); c.rotate(0.4); c.fillStyle = yellow; c.beginPath(); c.ellipse(0, 0, 34, 26, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = manganese; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#F7D36A'; c.beginPath(); c.ellipse(-10, -8, 10, 6, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    // lower band: a blue running scroll
    c.strokeStyle = blue; c.lineWidth = 6; c.beginPath();
    for (let x = 0; x <= w; x += 4) { const y = 420 + Math.sin(x / 40) * 14; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.fillStyle = yellow; for (let x = 20; x < w; x += 80) { c.beginPath(); c.arc(x, 420 + Math.sin(x / 40) * 14 - 22, 7, 0, Math.PI * 2); c.fill(); }
  });
}
/** The lamp, with its foot at the origin. setGlow(k): 0 = off (daylight) … 1 = fully on (blue hour). */
export function buildLamp() {
  const g = new THREE.Group();
  const glaze = makeInk({ color: '#ffffff', wash: 0.9, map: majolica(), hatch: 0.7 });
  const blue = makeInk({ color: '#1F4E8C', wash: 0.88 });
  const brass = makeInk({ color: '#C9A44C', wash: 0.72 });
  const linen = makeInk({ color: '#F2E6CC', wash: 0.45, side: THREE.DoubleSide, emissive: 0.01, emissiveColor: '#FFD9A0' });
  const trim = makeInk({ color: '#A8452E', wash: 0.8 });
  const flex = makeInk({ color: '#C9B48A', wash: 0.7 });
  // turned wooden plinth
  lathe([[0, 0], [0.072, 0], [0.074, 0.004], [0.074, 0.014], [0.068, 0.018], [0.064, 0.022], [0, 0.022]], makeInk({ color: '#6A3E22', wash: 0.75, wood: 1, grain: new THREE.Vector3(1, 0, 0) }), g, 40);
  // the baluster: foot, belly, waist, shoulder, neck
  const prof = [[0.0, 0.022], [0.05, 0.022], [0.052, 0.03], [0.042, 0.04], [0.05, 0.06], [0.072, 0.1], [0.08, 0.14], [0.076, 0.18], [0.06, 0.215], [0.04, 0.235], [0.028, 0.25], [0.026, 0.262], [0.034, 0.268], [0.034, 0.275], [0.0, 0.275]];
  lathe(prof, glaze, g, 56);
  // blue glazed collar and the brass cap and neck
  lathe([[0.034, 0.268], [0.037, 0.272], [0.034, 0.278], [0, 0.278]], blue, g, 32);
  lathe([[0, 0.278], [0.018, 0.278], [0.016, 0.285], [0.009, 0.29], [0.008, 0.33], [0.012, 0.334], [0, 0.338]], brass, g, 20);
  // the bulb holder with a little brass turn-switch
  lathe([[0, 0.338], [0.017, 0.338], [0.017, 0.37], [0.014, 0.374], [0, 0.374]], brass, g, 20);
  mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.02, 8), brass, g, 0.024, 0.35, 0).rotation.z = Math.PI / 2;
  cylr(0.006, 0.006, 0.006, brass, g, 0.036, 0.35, 0, 10).rotation.z = Math.PI / 2;
  // harp and finial
  const topY = 0.52;
  for (const s of [-1, 1]) tube([[s * 0.017, 0.345, 0], [s * 0.06, 0.4, 0], [s * 0.05, 0.47, 0], [s * 0.012, topY - 0.005, 0]], 0.0022, brass, g, 24, 6);
  lathe([[0, topY], [0.012, topY], [0.012, topY + 0.004], [0.006, topY + 0.008], [0.009, topY + 0.016], [0.006, topY + 0.024], [0, topY + 0.028]], brass, g, 16);
  sph(0.006, blue, g, 0, topY + 0.03, 0, 10);
  // the pleated empire shade: radius tapers 0.145 → 0.085, and ripples round the rim for the pleats
  const NP = 64, rows = 8, y0 = 0.36, y1 = topY, rb = 0.145, rt = 0.085;
  const geo = new THREE.CylinderGeometry(rt, rb, y1 - y0, NP * 2, rows, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.035 * Math.abs(((a / (Math.PI * 2)) * NP % 1 + 1) % 1 - 0.5) * 2;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  mesh(geo, linen, g, 0, (y0 + y1) / 2, 0);
  // terracotta piping on the top and bottom rims
  for (const [y, r] of [[y0, rb * 1.035], [y1, rt * 1.035]]) { const t = mesh(new THREE.TorusGeometry(r, 0.0035, 6, 72), trim, g, 0, y, 0); t.rotation.x = Math.PI / 2; }
  // the bulb inside
  const bulbMat = makeInk({ color: '#FFE7B0', wash: 0.4, emissive: 0.1, emissiveColor: '#FFE2A0' });
  lathe([[0, 0.374], [0.012, 0.378], [0.026, 0.4], [0.03, 0.42], [0.024, 0.44], [0, 0.448]], bulbMat, g, 18);
  cord(g, [-0.03, 0.01, -0.06], flex, makeInk({ color: '#F4F0E6', wash: 0.3 }));
  const setGlow = (k) => { linen.emissiveIntensity = 0.02 + k * 0.9; bulbMat.emissiveIntensity = 0.1 + k * 0.9; };
  setGlow(0);
  return { group: g, bulb: new THREE.Vector3(0, 0.42, 0), setGlow };
}

