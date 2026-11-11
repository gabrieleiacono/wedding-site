// An old wooden tennis racket, hung on a nail on the bookshelf wall, in the stretch of wall between
// the shelf and the corner with the door (the viewer's right of the shelf).
//
// A 1970s laminated-wood racket of no particular make: a small oval head (about 23 × 31 cm outside),
// a frame of honey-coloured laminated ash that splits into two arms at the throat, with a darker
// walnut wedge filling the triangle between them, natural gut strings (16 mains, 19 crosses, woven),
// a red-and-navy painted band on the shaft, and a spiral-wrapped brown leather grip with a butt cap.
// 68.5 cm long overall.
//
// It hangs from a brass nail through the top of the string bed, so it can swing: a tap on it gives
// it a push and it rocks on the nail, back and forth against the wall, until it settles plumb again.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { ROOM } from './room.js';

// where it hangs: the nail, in world coordinates (on the south wall, x < the shelf's right side at -1.065)
const NAIL = { x: -1.6, y: 1.8 };

// the racket's own measurements (m): y up the racket from the butt, x across, z out of the string plane
const HEAD = { cy: 0.532, a: 0.114, b: 0.153, rim: 0.0135 }; // outer half-width / half-length, frame width in the plane
const DEPTH = 0.02; // the frame's thickness, across the string plane
const SHAFT = { w: 0.013, y0: 0.15, split: 0.288 }; // half-width; wood starts under the grip; where the arms split
const GRIP = { len: 0.175, r: 0.0172 }; // leather from the butt up, octagonal
const PIVOT_Y = HEAD.cy + HEAD.b - HEAD.rim - 0.016; // the nail goes through the string bed just under the top

// the push a tap gives, the swing's natural frequency (a wooden racket on a nail: ~1.3 s a swing),
// how fast it dies away, and the widest it may swing
const SWING = { push: 0.75, omega: 4.7, damp: 1.1, max: 0.45 };

const C = {
  ash: '#B57A3E', walnut: '#5A3119', leather: '#6B3A1E', leatherDark: '#4A2714',
  red: '#A8322A', navy: '#24395A', brass: '#C9A44C', cap: '#3A2A20',
};

const ellipse = (t, a = HEAD.a, b = HEAD.b) => new THREE.Vector2(a * Math.cos(t), HEAD.cy + b * Math.sin(t));

/** The frame's outline in the string plane: head, shoulders and shaft, with the string bed and the throat as holes. */
function frameShape() {
  const s = new THREE.Shape();
  const tj = -Math.PI / 2 + 0.75; // where the arms' outer edges run into the head
  const P = ellipse(tj);
  const tan = new THREE.Vector2(-HEAD.a * Math.sin(tj), HEAD.b * Math.cos(tj)).normalize();
  const c2 = P.clone().addScaledVector(tan, -0.05);
  s.moveTo(SHAFT.w, SHAFT.y0);
  s.lineTo(SHAFT.w, SHAFT.split);
  s.bezierCurveTo(SHAFT.w, SHAFT.split + 0.04, c2.x, c2.y, P.x, P.y);
  const n = 72;
  for (let i = 1; i <= n; i++) { const p = ellipse(tj + (Math.PI - 2 * tj) * (i / n)); s.lineTo(p.x, p.y); }
  // (the loop above runs from tj up over the top to π - tj, the mirror point on the left)
  s.bezierCurveTo(-c2.x, c2.y, -SHAFT.w, SHAFT.split + 0.04, -SHAFT.w, SHAFT.split);
  s.lineTo(-SHAFT.w, SHAFT.y0);
  s.closePath();
  // the string bed
  const bed = new THREE.Path();
  const ai = HEAD.a - HEAD.rim, bi = HEAD.b - HEAD.rim;
  for (let i = 0; i <= n; i++) { const p = ellipse((i / n) * Math.PI * 2, ai, bi); if (i) bed.lineTo(p.x, p.y); else bed.moveTo(p.x, p.y); }
  s.holes.push(bed);
  s.holes.push(throatPath());
  return s;
}

/** The throat: the triangle between the arms and under the bridge of the head (the wedge fills it). */
function throatPath(inset = 0) {
  const p = new THREE.Path();
  const xc = 0.05 - inset, apex = SHAFT.split + 0.03 + inset * 1.6;
  const yAt = (x) => HEAD.cy - HEAD.b * Math.sqrt(1 - (x / HEAD.a) ** 2) - inset;
  p.moveTo(0, apex);
  p.quadraticCurveTo(xc * 0.35, apex + 0.03, xc, yAt(xc));
  for (let i = 1; i <= 12; i++) { const x = xc - (2 * xc * i) / 12; p.lineTo(x, yAt(x)); }
  p.quadraticCurveTo(-xc * 0.35, apex + 0.03, 0, apex);
  return p;
}

/** Natural gut, woven: 16 mains and 19 crosses, drawn into a texture that covers the string bed. */
function stringTexture() {
  const W = 512, H = Math.round(W * HEAD.b / HEAD.a);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const mains = 16, crosses = 19, sw = 7;
  const mx = (i) => W * (0.5 + (i - (mains - 1) / 2) * 0.058);
  const cy = (j) => H * (0.5 + (j - (crosses - 1) / 2) * 0.047 + 0.02);
  const strand = (x0, y0, x1, y1, dark) => {
    g.strokeStyle = dark ? '#DDCB9A' : '#F3E7C4'; g.lineWidth = sw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(90,60,30,0.55)'; g.lineWidth = 1.2;
    const vx = x1 === x0 ? sw / 2 : 0, vy = y1 === y0 ? sw / 2 : 0;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x0 + s * vx, y0 + s * vy); g.lineTo(x1 + s * vx, y1 + s * vy); g.stroke(); }
  };
  for (let i = 0; i < mains; i++) strand(mx(i), 0, mx(i), H, false);
  // the crosses go over and under the mains, alternately
  for (let j = 0; j < crosses; j++) {
    strand(0, cy(j), W, cy(j), true);
    for (let i = 0; i < mains; i++) if ((i + j) % 2) strand(mx(i), cy(j) - sw * 0.9, mx(i), cy(j) + sw * 0.9, false);
  }
  // only inside the oval
  g.globalCompositeOperation = 'destination-in';
  g.beginPath(); g.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// The frame's face, as it shows the edges of its laminations: thin plies of light ash, darker beech
// and a hair of mahogany running all round the head and down the arms. Drawn as bands centred on the
// frame's centre line (stroked narrower and narrower), clipped to the frame, in the frame's own x/y
// metres: the ExtrudeGeometry cap UVs are exactly those, so the texture is placed with repeat/offset.
const FACE = { x0: -0.125, y0: 0.14, w: 0.25, h: 0.56 };
function laminateTexture() {
  const PX = 1600, W = Math.round(FACE.w * PX), H = Math.round(FACE.h * PX);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const X = (x) => (x - FACE.x0) * PX, Y = (y) => (FACE.y0 + FACE.h - y) * PX;
  g.fillStyle = '#C88E4E'; g.fillRect(0, 0, W, H);
  const am = HEAD.a - HEAD.rim / 2, bm = HEAD.b - HEAD.rim / 2; // the head's centre line
  const tj = -Math.PI / 2 + 0.75;
  const centre = () => {
    g.beginPath(); g.ellipse(X(0), Y(HEAD.cy), am * PX, bm * PX, 0, 0, Math.PI * 2);
    for (const sx of [-1, 1]) {
      // each arm's centre line, from inside the shaft up into the head's
      const p = new THREE.Vector2(am * Math.cos(tj), HEAD.cy + bm * Math.sin(tj));
      g.moveTo(X(sx * SHAFT.w / 2), Y(SHAFT.y0));
      g.lineTo(X(sx * SHAFT.w / 2), Y(SHAFT.split));
      g.bezierCurveTo(X(sx * SHAFT.w / 2), Y(SHAFT.split + 0.045), X(sx * (p.x - 0.03)), Y(p.y - 0.035), X(sx * p.x), Y(p.y));
    }
  };
  // [width in mm across the band, colour], widest first
  const plies = [[14, '#C88E4E'], [11.5, '#9C5E2C'], [10.6, '#D39A58'], [8, '#5E321A'], [7.2, '#CC9150'], [5, '#985A2A'], [3.6, '#D8A262'], [1.2, '#7A4220']];
  g.lineJoin = 'round';
  for (const [mm, c] of plies) { centre(); g.strokeStyle = c; g.lineWidth = mm / 1000 * PX; g.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.repeat.set(1 / FACE.w, 1 / FACE.h); tex.offset.set(-FACE.x0 / FACE.w, -FACE.y0 / FACE.h);
  return tex;
}

export function buildRacket(room) {
  const outer = new THREE.Group(); room.add(outer);
  outer.position.set(NAIL.x, NAIL.y, ROOM.hz - DEPTH / 2 - 0.002);
  outer.rotation.y = Math.PI; // its front faces into the room (-z)
  const swing = new THREE.Group(); outer.add(swing); // turns about the nail
  // the leather grip is thicker than the frame, so the racket leans out from the wall a little at the bottom
  const lean = new THREE.Group(); lean.rotation.x = -0.009; swing.add(lean);
  const r = new THREE.Group(); r.position.y = -PIVOT_Y; lean.add(r); // the racket, butt at y = 0
  const add = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; r.add(m); return m; };

  const mats = {
    face: makeInk({ color: '#ffffff', wash: 0.88, map: laminateTexture(), hatch: 0.55 }), // the laminations, front and back
    ash: makeInk({ color: C.ash, wash: 0.78, wood: 1, grain: new THREE.Vector3(0, 1, 0), grainScale: 0.6 }), // the rim, all round
    walnut: makeInk({ color: C.walnut, wash: 0.82, wood: 1, grain: new THREE.Vector3(0, 1, 0), grainScale: 0.5 }),
    leather: makeInk({ color: C.leather, wash: 0.88 }),
    leatherDark: makeInk({ color: C.leatherDark, wash: 0.9 }),
    red: makeInk({ color: C.red, wash: 0.88 }), navy: makeInk({ color: C.navy, wash: 0.88 }),
    cap: makeInk({ color: C.cap, wash: 0.8 }),
    brass: makeInk({ color: C.brass, wash: 0.8 }),
    gut: makeInk({ color: '#ffffff', wash: 0.8, map: stringTexture(), transparent: true, opacity: 1, side: THREE.DoubleSide, hatch: 0.35 }),
  };

  // --- the frame and the throat wedge ---------------------------------------------------------
  // (enough bevel segments that the ink outlines don't draw a line along each step of the rounding)
  const ext = (shape, depth, bevel) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 12 });
    geo.translate(0, 0, -depth / 2 + bevel); return geo;
  };
  add(ext(frameShape(), DEPTH, 0.003), [mats.face, mats.ash]); // ExtrudeGeometry: group 0 the faces, 1 the sides
  const wedge = new THREE.Shape(throatPath(0.0005).getPoints(12));
  add(ext(wedge, DEPTH - 0.004, 0.0015), mats.walnut);
  // a painted band round the shaft, just above the grip: red between two navy lines
  for (const [y, h, m] of [[GRIP.len + 0.012, 0.004, mats.navy], [GRIP.len + 0.022, 0.012, mats.red], [GRIP.len + 0.032, 0.004, mats.navy]]) {
    const b = add(new THREE.BoxGeometry(SHAFT.w * 2 + 0.0012, h, DEPTH + 0.0012), m); b.position.y = y;
  }

  // --- the strings: a woven bed in the middle of the frame, and the nail through them --------------
  const bed = add(new THREE.PlaneGeometry((HEAD.a - HEAD.rim) * 2 + 0.002, (HEAD.b - HEAD.rim) * 2 + 0.002), mats.gut, false);
  bed.position.y = HEAD.cy;
  bed.renderOrder = 1;

  // --- the grip: octagonal leather, wrapped in a spiral, with a flared butt and a cap ------------
  const grip = new THREE.CylinderGeometry(GRIP.r, GRIP.r * 1.04, GRIP.len - 0.012, 8, 1);
  grip.rotateY(Math.PI / 8); grip.translate(0, 0.012 + (GRIP.len - 0.012) / 2, 0);
  add(grip, mats.leather);
  // the edges of the wrap, overlapping as it spirals up
  const turns = 9, pts = [];
  for (let i = 0; i <= turns * 32; i++) {
    const t = i / (turns * 32), a = t * turns * Math.PI * 2, y = 0.016 + t * (GRIP.len - 0.026);
    // on the octagon's faces: the apothem over the cosine of the angle from the nearest face's normal
    const rr = (GRIP.r * (1.04 - 0.04 * t) * Math.cos(Math.PI / 8)) / Math.cos(((a + Math.PI / 8) % (Math.PI / 4)) - Math.PI / 8) + 0.0006;
    pts.push(new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr));
  }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 32, 0.0011, 4), mats.leatherDark);
  // the flare and the cap at the butt, and the tapered collar where the leather ends
  const flare = new THREE.CylinderGeometry(GRIP.r * 1.05, GRIP.r * 1.16, 0.012, 8); flare.rotateY(Math.PI / 8); flare.translate(0, 0.006, 0);
  add(flare, mats.leather);
  const cap = new THREE.CylinderGeometry(GRIP.r * 1.1, GRIP.r * 1.1, 0.003, 8); cap.rotateY(Math.PI / 8); cap.translate(0, 0.0015, 0);
  add(cap, mats.cap);
  const collar = new THREE.CylinderGeometry(SHAFT.w * 1.05, GRIP.r * 1.01, 0.014, 8); collar.rotateY(Math.PI / 8); collar.translate(0, GRIP.len + 0.004, 0);
  add(collar, mats.leatherDark);

  // --- the nail: fixed in the wall, so not part of the swing -----------------------------------
  const nail = new THREE.Group(); outer.add(nail);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, DEPTH + 0.02, 8), mats.brass);
  shank.rotation.x = Math.PI / 2; shank.position.z = 0.002; nail.add(shank);
  const nhead = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.005, 0.0025, 12), mats.brass);
  nhead.rotation.x = Math.PI / 2; nhead.position.z = DEPTH / 2 + 0.012; nail.add(nhead);
  for (const m of [shank, nhead]) { m.castShadow = true; m.receiveShadow = true; }

  // --- the swing ----------------------------------------------------------------------------------
  let angle = 0, vel = 0, lastT = null;
  const hooks = { knock: null }; // main.js sets this to a sound
  const tap = () => {
    // push it the way it is already going (or a random way when it hangs still), so taps add up
    const dir = Math.abs(vel) > 0.05 ? Math.sign(vel) : (Math.random() < 0.5 ? -1 : 1);
    vel += dir * SWING.push;
    hooks.knock?.(Math.min(1, 0.4 + Math.abs(angle) * 1.5));
  };
  const tick = (now) => {
    const dt = lastT === null ? 0 : Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (!dt || (angle === 0 && vel === 0)) return;
    // a damped pendulum, in small steps so a long frame can't make it explode
    const n = Math.ceil(dt / 0.008), h = dt / n;
    for (let i = 0; i < n; i++) {
      vel += (-SWING.omega * SWING.omega * Math.sin(angle) - SWING.damp * vel) * h;
      angle += vel * h;
      if (Math.abs(angle) > SWING.max) { angle = Math.sign(angle) * SWING.max; vel *= -0.3; }
    }
    if (Math.abs(angle) < 0.0005 && Math.abs(vel) < 0.003) angle = vel = 0;
    swing.rotation.z = angle;
  };
  const isRacket = (o) => { for (; o; o = o.parent) if (o === swing) return true; return false; };
  return { group: outer, hooks, tap, tick, isRacket, state: () => ({ angle, vel }) };
}
