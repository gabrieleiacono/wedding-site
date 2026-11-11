// Lo Scrittoio con Vista — boot, lights, camera rig, hotspots and the frame loop.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { InkPost, makeScreen } from './ink.js';
import { buildRoom, EYE, ROOM, WINDOW } from './room.js';
import { buildTV } from './tv.js';
import { buildBookshelf } from './bookshelf.js';
import { buildBike } from './bike.js';
import { buildRacket } from './racket.js';
import { buildLeggimi } from './leggimi.js';
import { ShelfView } from './shelfview.js';
import { Typewriter } from './typewriter.js';
import { Teletext } from './teletext.js';
import { Countryside } from './landscape.js';
import { Overlays, calendarTexture } from './overlays.js';
import { Sound } from './audio.js';
import { createStore } from './store.js';
import { WEDDING } from './content.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
// the progress bar on the loading screen (index.html): each step says how far the room has got and
// where the next step will take it; `speed` is how much slower than a fast laptop this device builds
const boot = window.bootProgress || (() => Promise.resolve());
let speed = 1;

await boot(0.15, 0.18, 1500);
await Promise.race([
  Promise.all(['700 22px "IBM Plex Mono"', '400 20px "Courier Prime"', '700 20px Caveat', '800 30px "Bricolage Grotesque"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);

// --- renderer ------------------------------------------------------------------
const canvas = $('#scene');
// Ask for the fast GPU first; some phones (or a browser that just lost its GPU) refuse that, so
// fall back to whatever WebGL the browser will give.
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') }); }
catch (e) { console.warn('WebGL (high-performance) refused, retrying', e); renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: params.has('shot') }); }
// Pixel density: the screen's own (at most 2) while the frame keeps up; see adaptDensity() below.
const MAX_DPR = Math.min(2, window.devicePixelRatio || 1);
renderer.setPixelRatio(MAX_DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
// The sun's shadow map is redrawn only when something that casts a shadow moves (see shadowsMoved()),
// not on every render: each frame renders the scene twice (colour, then normals for the outlines),
// and three.js would otherwise redraw the shadow map for both.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.localClippingEnabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new InkPost(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 2000);
camera.layers.enable(1);

scene.matrixWorldAutoUpdate = false; // updated once per frame in drawFrame(), not once per render pass
const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
const WINDOW_BOX = new THREE.Box3(new THREE.Vector3(WINDOW.x0, WINDOW.y0, -ROOM.hz - 0.2), new THREE.Vector3(WINDOW.x1, WINDOW.y1, -ROOM.hz + 0.05));
const sound = new Sound();
const store = createStore();
const overlays = new Overlays();

// --- the room --------------------------------------------------------------------
await boot(0.18, 0.22, 300);
let bootT = performance.now();
const { room, anchors } = buildRoom(scene);
const teletext = new Teletext(store);
teletext.touch = matchMedia('(hover: none)').matches;
const tv = buildTV(room, teletext);
speed = Math.min(8, Math.max(0.5, (performance.now() - bootT) / 110));
await boot(0.22, 0.55, 4800 * speed); // the bookshelf is the long one: every spine is drawn by hand
const shelf = buildBookshelf(room);
await boot(0.55, 0.66, 450 * speed);
const bike = buildBike(room);
Object.assign(bike.hooks, { click: (d, v) => sound.ratchet(d, v), whirr: (v) => sound.whirr(v), snap: () => sound.snap(), clink: (d, v) => sound.clink(d, v) });
const racket = buildRacket(room); // the old wooden racket on the wall, right of the bookshelf
racket.hooks.knock = (v) => sound.racket(v);
const leggimi = buildLeggimi(room); // the glowing book, on the desk right of the typewriter
const shelfView = new ShelfView({ shelf: shelf.shelf, sound });
const typewriter = new Typewriter(room, sound);
const view = new Countryside(scene, sound);
if (params.has('dusk')) view.fixedDusk = +params.get('dusk');
const cal = calendarTexture();
const calFace = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), makeScreen(cal.tex));
calFace.position.set(0.004, 0, 0); calFace.rotation.y = Math.PI / 2; anchors.calendarGroup.add(calFace);
await boot(0.66, 0.7, 100 * speed);

// --- light: low sun through the window, sky fill, desk lamp, TV glow -----------------
const hemi = new THREE.HemisphereLight('#F4D2B0', '#6A4A3A', 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#FFC88A', 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 20 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
sun.target.position.set(0.3, 0.6, 0.2);
scene.add(sun, sun.target);
const lamp = new THREE.PointLight('#FFD9A0', 0, 2.6, 1.8);
lamp.position.copy(anchors.lampBulb);
scene.add(lamp);
// The lamp comes on by itself at the blue hour; a click on it turns it on or off by hand, and from
// then on it stays as you left it. lampK fades towards where it should be, like a bulb warming up.
const lampState = { hand: null, k: 0, t: performance.now() };
const isLamp = (o) => { for (; o; o = o.parent) if (o === anchors.lampGroup) return true; return false; };
function toggleLamp() {
  lampState.hand = lampState.k < 0.5;
  sound.lampSwitch();
}

function updateLight() {
  const dusk = view.dusk; // 0 hero bake … 1 blue hour
  const el = THREE.MathUtils.degToRad(17 - dusk * 12), az = THREE.MathUtils.degToRad(-24);
  const d = 9;
  sun.position.set(sun.target.position.x + Math.sin(az) * Math.cos(el) * d, sun.target.position.y + Math.sin(el) * d, sun.target.position.z - Math.cos(az) * Math.cos(el) * d);
  sun.intensity = 1.5 * (1 - THREE.MathUtils.smoothstep(dusk, 0.55, 0.95));
  sun.color.set('#FFC88A').lerp(new THREE.Color('#F08A7A'), dusk);
  hemi.intensity = 1.0 - dusk * 0.35;
  hemi.color.set('#F4D2B0').lerp(new THREE.Color('#8A86B8'), dusk);
  const now = performance.now(), dt = Math.min(0.1, (now - lampState.t) / 1000); lampState.t = now;
  const auto = THREE.MathUtils.smoothstep(dusk, 0.35, 0.8);
  const want = lampState.hand === null ? auto : lampState.hand ? 1 : 0;
  lampState.k = lampState.hand === null ? auto : lampState.k + (want - lampState.k) * (1 - Math.exp(-dt * 14));
  const lampOn = lampState.k;
  lamp.intensity = lampOn * 0.9;
  anchors.lampGlow(lampOn);
  tv.glow.intensity = 0.1 + dusk * 0.3;
}

// --- camera rig ------------------------------------------------------------------------
const WALLS = [
  { yaw: 0, name: 'A · La scrivania' }, { yaw: -Math.PI / 2, name: 'B · Il televisore' },
  { yaw: Math.PI, name: 'C · La libreria' }, { yaw: Math.PI / 2, name: 'D · La porta' },
];
// yaw/pitch is where you are looking; yawT/pitchT is where the drag (or a flick, or the compass) is
// taking you, and the view follows it a moment behind (see LOOK.ease).
const rig = { yaw: 0, pitch: -0.15, yawT: 0, pitchT: -0.15, vyaw: 0, vpitch: 0, feel: 'mouse', targetYaw: null, home: null, dragging: false, focus: null, t: 0, from: null,
  lens: { fov: 60, cx: innerWidth / 2, cy: innerHeight / 2 }, peek: { yaw: 0, pitch: 0 }, peekS: { yaw: 0, pitch: 0 }, peeking: false, kbBottom: innerHeight };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = THREE.MathUtils.degToRad;
// How looking round feels.
const LOOK = {
  // the room follows your finger both ways, as it already does side to side: drag up to look down
  // (and lean over the desk). ?look=tilt gives the old feel, where dragging down looks down.
  vsign: params.get('look') === 'tilt' ? -1 : 1,
  // how far the view turns per pixel dragged, as a multiple of how far the room under the pointer
  // moves: at 1 it would stick to your finger. Faster with a mouse, so a sweep or two turns you round.
  speed: { mouse: 2.0, touch: 1.5 },
  tilt: 0.8, // up and down a little slower than round, so leaning over the desk is a deliberate move
  // seconds the view takes to catch up with the drag: enough to give it weight, too little to feel late
  ease: { mouse: 0.09, touch: 0.055 },
  down: () => deg(innerWidth < 700 ? -46 : -50), up: deg(15),
  give: 0.07, // you can pull this far (radians) past a limit, against growing resistance, and it springs back
  coast: 4, // a flick's speed fades at this rate, so it carries on for about speed / 4
};
// Looking down is leaning over: from about 10° down you rise from the chair and lean in, so at the
// bottom of the tilt you see the desk from above (eye 30 cm higher, 20 cm further in).
const LEAN = { from: deg(10), to: deg(50), rise: 0.3, reach: 0.2 };
function leanIn(pos, yaw, pitch) {
  const s = THREE.MathUtils.smoothstep(-pitch, LEAN.from, LEAN.to);
  pos.y += LEAN.rise * s;
  pos.x -= Math.sin(yaw) * LEAN.reach * s; pos.z -= Math.cos(yaw) * LEAN.reach * s;
  return pos;
}
// past a limit, a drag meets growing resistance: it gives a little, never more than LOOK.give
function withGive(x) {
  const lo = LOOK.down(), hi = LOOK.up, g = LOOK.give;
  if (x < lo) return lo - g * (1 - Math.exp((x - lo) / g));
  if (x > hi) return hi + g * (1 - Math.exp((hi - x) / g));
  return x;
}
// radians per CSS pixel at which the room would stay under the pointer
const stickyRadPerPx = () => 2 * Math.atan(Math.tan(deg(rig.baseFov) / 2) * innerWidth / innerHeight) / innerWidth;
const nearestWall = () => WALLS.reduce((b, w) => (Math.abs(wrap(rig.yaw - w.yaw)) < Math.abs(wrap(rig.yaw - b.yaw)) ? w : b));
// The eye walks an oval track round the room. Each wall has a stop on the track, centred on the
// things you can touch there; turning carries you along the track from one stop to the next.
// Stops in wall order A (desk), B (TV), C (bookshelf), D (door), as [x, z].
const STOPS = [[0, -0.72], [0.53, -0.55], [0.15, 0.33], [-0.9, -0.37]];
function eyeAt(yaw, out = new THREE.Vector3()) {
  // yaw 0, -π/2, π, π/2 → t 0, 1, 2, 3; a closed Catmull-Rom loop through the stops
  const t = ((-yaw / (Math.PI / 2)) % 4 + 4) % 4, i = Math.floor(t), f = t - i;
  const P = (k) => STOPS[(i + k + 4) % 4];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f * f * f);
  return out.set(cr(P(-1)[0], P(0)[0], P(1)[0], P(2)[0]), EYE.y, cr(P(-1)[1], P(0)[1], P(1)[1], P(2)[1]));
}
function lookDir(yaw, pitch) { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
// the compass arrows and the arrow keys still step round to the next wall; dragging never does
function turn(dir) { const w = nearestWall(); rig.targetYaw = w.yaw + dir * Math.PI / 2; rig.vyaw = 0; }
function setFov() {
  const aspect = innerWidth / innerHeight;
  const base = innerWidth < 700 ? 70 : 60;
  // keep at least ~60° across on portrait phones
  const minV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) / aspect)) * 0.82;
  rig.baseFov = Math.min(95, Math.max(base, aspect < 1 ? minV : base));
}
setFov();

let down = null;
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: 0, trail: [] };
  if (shelfView.active) { shelfView.pointerDown(e); canvas.setPointerCapture(e.pointerId); return; }
  if (rig.focus) { if (rig.focus.peek) { rig.peeking = true; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); } return; }
  rig.dragging = true; rig.targetYaw = null; rig.vyaw = rig.vpitch = 0; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId);
  rig.feel = e.pointerType === 'mouse' ? 'mouse' : 'touch';
  down.pitch = rig.pitchT; // the pitch the drag asks for, before any give at the limits
});
canvas.addEventListener('pointermove', (e) => {
  if (shelfView.active) shelfView.pointerMove(e);
  if (!down) return;
  // deltas from the pointer's own position (movementX is 0 for touch in some browsers)
  const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
  down.moved = Math.max(down.moved + Math.abs(dx) + Math.abs(dy), Math.hypot(e.clientX - down.x, e.clientY - down.y));
  if (rig.peeking) { peekBy(dx * 0.004, LOOK.vsign * dy * 0.004); return; }
  if (!rig.dragging) return;
  const k = LOOK.speed[rig.feel] * stickyRadPerPx();
  rig.yawT += dx * k;
  down.pitch += LOOK.vsign * dy * k * LOOK.tilt;
  rig.pitchT = withGive(down.pitch);
  // the last tenth of a second of the drag, to know how fast you were turning when you let go
  const now = performance.now(); down.trail.push({ t: now, yaw: rig.yawT, pitch: rig.pitchT });
  while (down.trail.length > 2 && now - down.trail[0].t > 100) down.trail.shift();
  $('#hint').style.opacity = 0;
});
canvas.addEventListener('pointerup', (e) => {
  if (shelfView.active) shelfView.pointerUp(e);
  if (rig.dragging || rig.peeking) { rig.dragging = rig.peeking = false; canvas.classList.remove('dragging'); }
  if (down && down.moved < 8) clickAt(e.clientX, e.clientY);
  else if (!rig.focus && down) {
    // let go mid-turn and the room keeps turning, slowing down, then settles wherever it is: no snapping to a wall
    const tr = down.trail, a = tr[0], b = tr[tr.length - 1], now = performance.now();
    const moving = a && b !== a && now - b.t < 60, s = moving ? (b.t - a.t) / 1000 : 1;
    rig.vyaw = moving ? THREE.MathUtils.clamp(wrap(b.yaw - a.yaw) / s, -5, 5) : 0;
    rig.vpitch = moving ? THREE.MathUtils.clamp((b.pitch - a.pitch) / s, -3, 3) : 0;
  }
  down = null;
});
canvas.addEventListener('pointercancel', (e) => { if (shelfView.active) shelfView.pointerUp(e); down = null; rig.dragging = rig.peeking = false; rig.vyaw = rig.vpitch = 0; canvas.classList.remove('dragging'); });
// at the window you can look around a little (drag, or the arrow keys), but not turn your back on it
function peekBy(dyaw, dpitch) {
  rig.peek.yaw = THREE.MathUtils.clamp(rig.peek.yaw + dyaw, -0.9, 0.9);
  rig.peek.pitch = THREE.MathUtils.clamp(rig.peek.pitch + dpitch, -0.55, 0.35);
  $('#hint').style.opacity = 0;
}
canvas.addEventListener('wheel', (e) => { if (shelfView.active) shelfView.wheel(e); }, { passive: false });
$('#compass').addEventListener('click', (e) => { const b = e.target.closest('[data-turn]'); if (b) { sound.unlock(); unfocus(); turn(+b.dataset.turn); } });

// --- close-ups ---------------------------------------------------------------------------
// Each close-up names what has to be readable (a few world points), the direction you look at it
// from, and a lens; the camera then stands just far enough back for all of it to fit in the part of
// the screen the HUD leaves free (not under the remote, the help line or the phone keyboard). The lens
// is shifted with a view offset so the object sits in the middle of that free band.
const UP = new THREE.Vector3(0, 1, 0);
const narrowScreen = () => innerWidth < 700;
const portrait = () => innerWidth < innerHeight;
function freeBand({ keyboard = false } = {}) {
  const W = innerWidth, H = innerHeight;
  const b = { left: 14, right: W - 14, top: narrowScreen() ? 112 : 74, bottom: H - 62 };
  if (!remote.hidden) {
    const r = remote.getBoundingClientRect();
    if (narrowScreen()) b.bottom = Math.min(b.bottom, r.top - 10); else b.right = Math.min(b.right, r.left - 18);
  }
  // the phone keyboard covers the bottom of the page without resizing it: frame above it
  if (keyboard) b.bottom = Math.min(b.bottom, rig.kbBottom - 10);
  if (b.bottom - b.top < 120) b.top = Math.max(8, b.bottom - 120);
  return b;
}
/** Where to stand so every point lands inside the band, looking along `dir` at the middle of the points. */
function frameView({ pts, dir, fov, fill = 0.92, minDist = 0.12 }, band = freeBand()) {
  const box = new THREE.Box3().setFromPoints(pts), target = box.getCenter(new THREE.Vector3());
  const d = dir.clone().normalize(), r = new THREE.Vector3().crossVectors(d, UP).normalize(), u = new THREE.Vector3().crossVectors(r, d);
  const f = (innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const hw = (band.right - band.left) / 2 * fill, hh = (band.bottom - band.top) / 2 * fill;
  const rel = new THREE.Vector3();
  let dist = minDist;
  for (const p of pts) {
    rel.subVectors(p, target);
    const z = rel.dot(d);
    dist = Math.max(dist, f * Math.abs(rel.dot(r)) / hw - z, f * Math.abs(rel.dot(u)) / hh - z);
  }
  return { pos: target.clone().addScaledVector(d, -dist), target, fov, cx: (band.left + band.right) / 2, cy: (band.top + band.bottom) / 2 };
}
const boxPts = (min, max) => { const p = []; for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) p.push(new THREE.Vector3(x, y, z)); return p; };
const around = (c, hx, hy, hz) => boxPts(new THREE.Vector3(c.x - hx, c.y - hy, c.z - hz), new THREE.Vector3(c.x + hx, c.y + hy, c.z + hz));
const elev = (deg, yaw = 0) => { const e = THREE.MathUtils.degToRad(deg); return new THREE.Vector3(-Math.sin(yaw) * Math.cos(e), -Math.sin(e), -Math.cos(yaw) * Math.cos(e)); };

// Typewriter: from above and in front, the LCD (the question) and the sheet (your answers) filling the frame.
let twPts = null;
// While you type, the camera keeps the distance and the on-screen scale it had before the phone keyboard
// came up: refitting into the short band above the keyboard (or, on Android, into the page the keyboard
// shrinks) would zoom right out. It only turns so the LCD and the line being typed sit in the middle of
// what the keyboard leaves visible.
let twRest = null;
const TYPEWRITER_LEAN = () => {
  const pts = (twPts ??= typewriter.readPoints());
  if (!typewriter.active || !twRest || twRest.W !== innerWidth) {
    const v = frameView({ pts, dir: elev(36), fov: portrait() ? 50 : 38, fill: narrowScreen() ? 0.96 : 0.74 });
    twRest = { v, W: innerWidth, H: innerHeight };
    if (!typewriter.active) return v;
  }
  const { v, H } = twRest, kb = freeBand({ keyboard: true });
  if (innerHeight === H && kb.bottom >= innerHeight - 66) return v; // no keyboard (a desk, or not up yet)
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(v.fov) / 2) * innerHeight / H)); // same pixels per metre
  const typing = new THREE.Box3().setFromPoints(pts.slice(0, 6)).getCenter(new THREE.Vector3()); // the LCD and the print line
  // a little below the middle: the answers already typed climb up the sheet and need the room above
  return { pos: v.pos, target: typing, fov, cx: v.cx, cy: kb.top + (kb.bottom - kb.top) * 0.64 };
};
// TV: the whole screen, beside the remote on a desk, above it on a phone.
// On a narrow phone the screen is as wide as the page allows (the bezel just shows), since the width is what limits it.
const TV_PTS = around(tv.screenWorld, 0.01, 0.27, 0.35), TV_PTS_TIGHT = around(tv.screenWorld, 0.01, 0.255, 0.338);
const TV_LEAN = () => narrowScreen()
  ? frameView({ pts: TV_PTS_TIGHT, dir: new THREE.Vector3(1, -0.07, 0), fov: portrait() ? 55 : 40, fill: 1 })
  : frameView({ pts: TV_PTS, dir: new THREE.Vector3(1, -0.07, 0), fov: portrait() ? 55 : 40, fill: 0.88 });
// Window: your face right at the open window, in the frame itself (still this side of the shutter's
// guides), so the country fills the picture; drag or use the arrows to look along the hills or down
// into the paddock. A wider lens on a tall phone screen.
const WINDOW_EYE = new THREE.Vector3(0, 1.48, -ROOM.hz + 0.07);
const WINDOW_LEAN = () => {
  const tall = portrait();
  return { pos: WINDOW_EYE, target: WINDOW_EYE.clone().add(lookDir(rig.peekS.yaw, -0.1 + rig.peekS.pitch)), fov: tall ? 74 : 62 };
};
const ALBUM_LEAN = () => frameView({ pts: around(anchors.album, 0.19, 0.03, 0.17), dir: elev(52, 0.25), fov: 45 });
const CAL_LEAN = () => frameView({ pts: around(anchors.calendar, 0.01, 0.26, 0.2), dir: new THREE.Vector3(-1, -0.04, 0), fov: 45 });
// LEGGIMI: over the desk, the book propped up with its cover to you
const LEGGIMI_LEAN = () => frameView({ pts: around(leggimi.at.clone().add(new THREE.Vector3(0, 0.06, 0)), 0.13, 0.09, 0.15), dir: elev(45, -0.25), fov: 45 });
const HIFI_LEAN = () => frameView({ pts: around(shelf.hifi.clone().add(new THREE.Vector3(0, -0.02, 0.12)), 0.27, 0.14, 0.11), dir: new THREE.Vector3(0.15, -0.2, 1), fov: 45 });

// --- hotspots ----------------------------------------------------------------------------
const HOT = [
  { n: 1, id: 'typewriter', title: 'Macchina da scrivere', sub: 'Rispondi all\'invito', at: typewriter.world, wall: 0,
    lean: TYPEWRITER_LEAN, go: startTyping },
  { n: 2, id: 'album', title: 'Album fotografico', sub: 'Le nostre foto peggiori', at: anchors.album, wall: 0,
    lean: ALBUM_LEAN, go: () => overlays.album() },
  { n: 3, id: 'leggimi', title: 'LEGGIMI', sub: 'Un libro brilla sulla scrivania', at: leggimi.at, wall: 0,
    lean: LEGGIMI_LEAN, go: () => { pullBook(true); setTimeout(() => overlays.leggimi(), 650); } },
  { n: 4, id: 'tv', title: 'Televisore · Televideo', sub: 'Tutte le informazioni, pagina per pagina', at: tv.screenWorld.clone().add(new THREE.Vector3(0, 0.3, 0)), wall: 1, lean: TV_LEAN, go: () => showRemote(true) },
  { n: 5, id: 'remote', title: 'Telecomando', sub: 'Accendi il televideo', at: anchors.remote, wall: 0, lean: TV_LEAN, go: () => { sound.tvClick(); showRemote(true); } },
  { n: 6, id: 'console', title: 'Console', sub: 'Passa su AV e gioca', at: tv.ps, wall: 1, lean: TV_LEAN, go: () => { teletext.setAV(true); showRemote(true); } },
  { n: 7, id: 'window', title: 'Finestra', sub: 'Alza la tapparella e affacciati', at: new THREE.Vector3(WINDOW.x1 - 0.3, 1.3, -ROOM.hz), wall: 0, lean: WINDOW_LEAN, peek: true, go: lookOut },
  { n: 8, id: 'calendar', title: 'Calendario', sub: 'Quanto manca?', at: anchors.calendar, wall: 3,
    lean: CAL_LEAN, go: () => overlays.calendar() },
  { n: '☎', id: 'phone', title: 'Telefono', sub: 'Domande frequenti', at: anchors.phone, wall: 3, lean: TV_LEAN, go: () => { teletext.go('700'); showRemote(true); } },
  { n: '♪', id: 'hifi', title: 'Mini hi-fi', sub: 'La playlist', at: shelf.hifi, wall: 2, lean: HIFI_LEAN, go: () => overlays.playlist() },
  { n: 'Aa', id: 'shelf', title: 'Scaffali', sub: 'Avvicinati e leggi i titoli', wall: 2, lean: shelfView.lean, go: () => { shelfView.enter(shelfAsk.ri, shelfAsk.x); shelfAsk = { ri: 0, x: null }; },
    at: (() => { const R = shelf.shelf.rows[3]; return shelf.shelf.group.localToWorld(new THREE.Vector3(0.15, R.y + 0.12, shelf.shelf.spineZ)); })() },
];
const shelfHot = HOT.find((h) => h.id === 'shelf');
const windowGroup = anchors.shutter.shutter.parent;
let shelfAsk = { ri: 0, x: null }; // which shelf the close-up opens on: the top one, unless you tapped a book
function enterShelf(ri = 1, x = null) { shelfAsk = { ri, x }; activate(shelfHot); }
const hotWrap = $('#hotspots');
for (const h of HOT) {
  const b = document.createElement('button');
  b.className = 'hot'; b.type = 'button';
  b.setAttribute('aria-label', `${h.title}: ${h.sub}`);
  b.innerHTML = `${h.n}<span class="tip"><strong>${h.title}</strong><span>${h.sub}</span></span>`;
  b.addEventListener('click', (e) => { e.stopPropagation(); sound.unlock(); activate(h); });
  hotWrap.appendChild(b);
  h.el = b;
}
function activate(h) {
  if (overlays.open) return;
  if (rig.focus && rig.focus !== h) unfocus(true);
  if (h.lean) focus(h);
  h.go?.();
}
function focus(h) {
  // remember where you were standing and looking, so Back brings you there and not to a preset spot
  if (!rig.focus) rig.home = { yaw: rig.yawT, pitch: THREE.MathUtils.clamp(rig.pitchT, LOOK.down(), LOOK.up) };
  rig.targetYaw = null; rig.vyaw = rig.vpitch = 0;
  rig.from = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())), ...rig.lens };
  rig.focus = h; rig.t = 0;
  rig.peek.yaw = rig.peek.pitch = rig.peekS.yaw = rig.peekS.pitch = 0;
  document.body.classList.add('focused');
  $('#back').hidden = false;
  view.leaning = ['typewriter', 'album', 'leggimi', 'window'].includes(h.id);
}
function unfocus(quick) {
  if (!rig.focus) return;
  const h = rig.focus;
  rig.from = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())), ...rig.lens, back: true };
  // back to where you were before the close-up (or, if there's no record, to where the close-up was looking)
  if (rig.home) { rig.yaw = rig.home.yaw; rig.pitch = rig.home.pitch; } else {
    const d = camera.getWorldDirection(new THREE.Vector3());
    rig.yaw = Math.atan2(-d.x, -d.z); rig.pitch = THREE.MathUtils.clamp(Math.asin(d.y), LOOK.down(), LOOK.up);
  }
  rig.yawT = rig.yaw; rig.pitchT = rig.pitch;
  rig.home = null; rig.targetYaw = null; rig.vyaw = rig.vpitch = 0;
  rig.focus = null; rig.t = quick ? 1 : 0; rig.peeking = false;
  document.body.classList.remove('focused');
  $('#back').hidden = true; $('#help').hidden = true;
  view.leaning = false;
  if (h.id === 'typewriter') stopTyping();
  if (['tv', 'remote', 'console', 'phone'].includes(h.id)) showRemote(false);
  if (h.id === 'leggimi') pullBook(false);
  if (h.id === 'shelf') shelfView.leave();
}
$('#back').addEventListener('click', () => unfocus());
overlays.onClose = () => { if (!shelfView.active) unfocus(); };

function clickAt(x, y) {
  const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  // creatures in the window: bray / crow on click
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  // the raycaster doesn't skip hidden things (the rolled-up shutter slats), so we do
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const hitRoom = ray.intersectObject(room, true).find((h) => shown(h.object));
  if (view.group.visible && view.pick(ray, hitRoom ? hitRoom.distance : Infinity)) return;
  if (shelfView.active) { if (!shelfView.multi) shelfView.tap(ray); return; }
  // in front of the TV, a tap on the screen turns to the next subpage (back to the first after the last)
  if (rig.focus?.lean === TV_LEAN && !teletext.av && ray.intersectObject(tv.screen).length && teletext.subCount() > 1) { sound.tvClick(); teletext.step(1); return; }
  if (rig.focus) return;
  // a tap on the bike (the pedals above all) pushes the pedals back, freewheeling; too many, too fast, and the chain comes off
  if (hitRoom && bike.isBike(hitRoom.object)) { bike.tap(); return; }
  // a tap on the tennis racket sets it rocking on its nail
  if (hitRoom && racket.isRacket(hitRoom.object)) { racket.tap(); return; }
  // a tap on the TV set itself zooms in on the teletext, like its hotspot
  if (hitRoom && tv.isTV(hitRoom.object)) { activate(HOT.find((h) => h.id === 'tv')); return; }
  // a tap on the lamp turns it on or off
  if (hitRoom && isLamp(hitRoom.object)) { toggleLamp(); return; }
  // otherwise: the nearest hotspot on screen within reach
  let best = null, bd = 90;
  for (const h of HOT) { if (!h.screen) continue; const d = Math.hypot(h.screen.x - x, h.screen.y - y); if (d < bd) { bd = d; best = h; } }
  // a tap right on a book (not on a hotspot) brings you up to its shelf
  if (bd > 40 && nearestWall() === WALLS[2]) {
    const hit = ray.intersectObjects(shelf.shelf.meshes, false)[0], rec = shelf.shelf.bookAt(hit);
    if (rec) { enterShelf(shelf.shelf.rows.findIndex((R) => R.row === rec.row), rec.pos.x); return; }
  }
  // a tap anywhere in the window opening (the view, the shutter, the glass) takes you to the window,
  // unless something in the room is in the way
  if (bd > 40) {
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), ROOM.hz), new THREE.Vector3());
    const inOpening = p && p.x > WINDOW.x0 && p.x < WINDOW.x1 && p.y > WINDOW.y0 && p.y < WINDOW.y1 && (!hitRoom || hitRoom.distance > p.distanceTo(ray.ray.origin) - 0.02);
    let onFrame = false; // the open casements, the curtains, the shutter and its strap count too
    for (let o = hitRoom?.object; o; o = o.parent) if (o === windowGroup) onFrame = true;
    if (inOpening || onFrame) {
      activate(HOT.find((h) => h.id === 'window')); return;
    }
  }
  if (best) activate(best);
}

// --- typewriter ------------------------------------------------------------------------
const typer = $('#typer');
function startTyping() {
  twRest = null; // measure the resting close-up afresh, before the keyboard comes up
  typewriter.active = true;
  if (typewriter.finished) typewriter.reset();
  $('#help').hidden = false;
  $('#help').textContent = narrowScreen() ? 'Scrivi la risposta e premi Invio' : 'Scrivi con la tastiera · Invio per la domanda dopo · Esc per uscire';
  setTimeout(() => typer.focus({ preventScroll: true }), 50);
}
function stopTyping() { typewriter.active = false; typer.blur(); }
typer.addEventListener('input', () => { const v = typer.value; typer.value = ''; for (const ch of v) typewriter.type(ch); });
typer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); typewriter.enter(); }
  else if (e.key === 'Backspace') { e.preventDefault(); typewriter.backspace(); }
  else if (e.key === 'Escape') { e.preventDefault(); unfocus(); }
});
typer.addEventListener('blur', () => { if (typewriter.active && !typewriter.finished) setTimeout(() => typewriter.active && typer.focus({ preventScroll: true }), 30); });
canvas.addEventListener('pointerup', () => { if (typewriter.active) typer.focus({ preventScroll: true }); });
let rsvpCount = 0;
store.onGuests((g) => { rsvpCount = g.length; });
typewriter.onDone = async (r) => {
  try { await store.add(r); } catch (e) { console.warn('RSVP save failed', e); }
  stopTyping();
  overlays.replyCard(r, rsvpCount + (store.name === 'artifact' ? 0 : 0));
  teletext.go('600');
};

// --- TV + remote -------------------------------------------------------------------------
const remote = $('#remote');
const digits = remote.querySelector('.digits');
['1', '2', '3', '4', '5', '6', '7', '8', '9', 'AV', '0', 'TXT'].forEach((k) => {
  const b = document.createElement('button'); b.textContent = k; b.type = 'button';
  b.setAttribute('aria-label', k === 'AV' ? 'Ingresso AV: la console' : k === 'TXT' ? 'Indice del televideo' : 'Cifra ' + k);
  b.addEventListener('click', () => {
    sound.tvClick();
    if (k === 'AV') teletext.setAV(!teletext.av); else if (k === 'TXT') teletext.go('100'); else teletext.digit(k);
    if (!teletext.buf) setPad(false); // a page (or the console) has come up: fold the pad and give the TV back its room
    refreshRemote();
  });
  digits.appendChild(b);
});
// On a phone the number pad is folded away until 123 asks for it (CSS shows the toggle only there), so the
// TV can fill most of the screen. Opening or folding it eases the camera into the new free band.
const padToggle = remote.querySelector('.pad-toggle');
function setPad(open) {
  if (remote.classList.contains('pad-open') === open) return;
  remote.classList.toggle('pad-open', open);
  padToggle.setAttribute('aria-expanded', open);
  if (rig.focus) { rig.from = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())), ...rig.lens }; rig.t = 0; }
}
padToggle.addEventListener('click', () => { sound.tvClick(); setPad(!remote.classList.contains('pad-open')); });
remote.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { sound.tvClick(); teletext.step(+b.dataset.sub); }));
// SIZE, as on a real remote: on a phone it redraws the body of the pages in bigger letters (CSS shows it only there)
const sizeKey = remote.querySelector('.size-key');
sizeKey.addEventListener('click', () => { sound.tvClick(); teletext.setBig(!teletext.big); });
const FASTC = [['#E8261C', '#fff'], ['#1FCF3A', '#000'], ['#FFE81A', '#000'], ['#2BD9F2', '#000']];
function refreshRemote() {
  const f = remote.querySelector('.fastext'); f.innerHTML = '';
  teletext.fastLabels().forEach((l, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = l.label;
    b.style.background = FASTC[i][0]; b.style.color = FASTC[i][1];
    b.setAttribute('aria-label', 'Tasto colorato: pagina ' + l.page);
    b.addEventListener('click', () => { sound.tvClick(); teletext.fast(i); refreshRemote(); });
    f.appendChild(b);
  });
  remote.querySelector('.av-keys').hidden = !teletext.av;
  remote.querySelectorAll('[data-sub]').forEach((b) => { b.disabled = teletext.subCount() < 2; });
  // ▶ lights up while the page has more subpages to read
  const sp = teletext.subPos();
  remote.querySelector('[data-sub="1"]').classList.toggle('more', !teletext.buf && sp.n > 1 && !sp.auto && sp.i < sp.n - 1);
  sizeKey.setAttribute('aria-pressed', teletext.big);
  $('#remote-display').textContent = teletext.av ? 'AV1' : 'P' + (teletext.buf ? (teletext.buf + '___').slice(0, 3) : teletext.page === 'none' ? teletext.missing : teletext.page);
}
teletext.onChange = refreshRemote;
function showRemote(on) {
  remote.hidden = !on; refreshRemote();
  if (!on) setPad(false);
  $('#help').hidden = !on;
  // a phone has room for one short line under the remote, and no keyboard to type on
  if (on) $('#help').textContent = getComputedStyle(padToggle).display !== 'none' ? 'Colori o 123 per le pagine · A+ testo grande' : 'Digita tre cifre (anche da tastiera) · i tasti colorati portano alle pagine';
}
remote.querySelectorAll('[data-av]').forEach((b) => {
  const v = +b.dataset.av;
  b.addEventListener('pointerdown', () => { teletext.tennis.input = v; });
  ['pointerup', 'pointerleave'].forEach((ev) => b.addEventListener(ev, () => { teletext.tennis.input = 0; }));
});

window.addEventListener('keydown', (e) => {
  if (e.target === typer || overlays.open && e.key !== 'Escape') return;
  sound.unlock();
  if (shelfView.active && !overlays.open && shelfView.key(e)) { e.preventDefault(); return; }
  if (e.key === 'Escape') { if (overlays.open) overlays.close(); else unfocus(); return; }
  const onTV = rig.focus && rig.focus.lean === TV_LEAN;
  if (onTV) {
    if (/^[0-9]$/.test(e.key)) { sound.tvClick(); teletext.digit(e.key); refreshRemote(); return; }
    if (!teletext.av && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && teletext.subCount() > 1) { sound.tvClick(); teletext.step(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); return; }
    if (teletext.av && ['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) { teletext.tennis.input = e.key === 'ArrowUp' || e.key === 'w' ? -1 : 1; e.preventDefault(); return; }
  }
  if (rig.focus?.peek && e.key.startsWith('Arrow')) {
    e.preventDefault();
    peekBy({ ArrowLeft: 0.12, ArrowRight: -0.12 }[e.key] ?? 0, { ArrowUp: 0.08, ArrowDown: -0.08 }[e.key] ?? 0);
    return;
  }
  if (rig.focus) return;
  if (e.key === 'ArrowLeft') turn(1);
  else if (e.key === 'ArrowRight') turn(-1);
  else if (e.key === 'Enter') {
    let best = null, bd = Infinity;
    for (const h of HOT) { if (!h.screen) continue; const d = Math.hypot(h.screen.x - innerWidth / 2, h.screen.y - innerHeight / 2); if (d < bd) { bd = d; best = h; } }
    if (best) activate(best);
  }
});
window.addEventListener('keyup', (e) => { if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) teletext.tennis.input = 0; });

// --- shutter + LEGGIMI ------------------------------------------------------------------------
let shutterTarget = 0.42, shutter = 0.42; // fraction of the window covered
function toggleShutter() { shutterTarget = shutterTarget > 0.1 ? 0.04 : 0.42; sound.zzzt(); }
// leaning out of the window: up goes the shutter (if it isn't already), and a hint for what you can do there
function lookOut() {
  if (shutterTarget > 0.1) toggleShutter();
  $('#help').hidden = false;
  $('#help').textContent = narrowScreen() ? 'Trascina per guardarti intorno' : 'Trascina per guardarti intorno · tocca gli animali · Esc per tornare';
}
function layoutShutter() {
  const { slats, slatH } = anchors.shutter, top = 2.35, bottom = 0.88;
  const covered = (top - bottom) * shutter;
  slats.forEach((s, i) => {
    const y = top - i * slatH - slatH / 2;
    s.visible = y > top - covered;
    s.position.y = y + (top - covered < y ? 0 : 0);
  });
  anchors.shutter.strap.scale.y = 1 + shutter * 0.5;
}
let bookOut = 0, bookTarget = 0;
function pullBook(on) { bookTarget = on ? 1 : 0; }

$('#audio').addEventListener('click', () => { sound.unlock(); const on = sound.toggle(); $('#audio').setAttribute('aria-pressed', String(on)); $('#audio').setAttribute('aria-label', on ? 'Audio acceso' : 'Audio spento'); });
// Top-left banner: one line when it fits beside the compass, stacked when it doesn't, hidden when even that collides.
{
  const title = $('#title'), compass = $('#compass');
  const segs = [WEDDING.names, WEDDING.dateLong, `${WEDDING.villa} (${WEDDING.town})`];
  title.setAttribute('aria-label', segs.join(', '));
  segs.forEach((t, i) => {
    if (i) { const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = ' · '; title.append(sep); }
    const seg = document.createElement('span'); seg.className = 'seg'; seg.textContent = t; title.append(seg);
  });
  const fitTitle = () => {
    title.classList.remove('stack', 'off');
    if (getComputedStyle(title).display === 'none') return;
    const clear = () => title.getBoundingClientRect().right + 12 <= compass.getBoundingClientRect().left;
    if (clear()) return;
    title.classList.add('stack');
    if (!clear()) title.classList.add('off');
  };
  addEventListener('resize', fitTitle);
  new ResizeObserver(fitTitle).observe(compass);
  document.fonts?.ready.then(fitTitle);
  fitTitle();
}

// --- resize -----------------------------------------------------------------------------------
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(s.x, s.y);
  setFov(); applyLens(rig.lens);
}
// The lens: a vertical field of view measured on the real screen, and the point (cx, cy) in screen
// pixels where the line of sight lands. Off-centre, it becomes a view offset into a larger virtual frame
// with the same focal length, so easing between close-ups and the free view never jumps.
function applyLens({ fov, cx, cy }) {
  const W = innerWidth, H = innerHeight;
  const f = (H / 2) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const Wf = 2 * Math.max(cx, W - cx), Hf = 2 * Math.max(cy, H - cy);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Hf / 2 / f));
  camera.aspect = Wf / Hf;
  if (Math.abs(Wf - W) < 0.5 && Math.abs(Hf - H) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(Wf, Hf, Wf / 2 - cx, Hf / 2 - cy, W, H);
  camera.updateProjectionMatrix();
}
const leanOf = (h) => { const l = typeof h.lean === 'function' ? h.lean() : h.lean; return { cx: innerWidth / 2, cy: innerHeight / 2, ...l }; };
// how far down the page is still visible: the phone keyboard slides up over it
const visibleBottom = () => { const v = window.visualViewport; return v ? Math.min(innerHeight, v.offsetTop + v.height) : innerHeight; };
window.addEventListener('resize', resize);
resize();

// deep links for testing / screenshots: ?wall=1 ?focus=typewriter
if (params.has('wall')) rig.yaw = rig.yawT = WALLS[+params.get('wall')]?.yaw ?? 0;
// ?pitch=-40 starts looking that many degrees up or down (screenshots of the lean)
if (params.has('pitch')) rig.pitch = rig.pitchT = withGive(deg(+params.get('pitch')));

// --- frame loop -------------------------------------------------------------------------------
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
let last = performance.now();
const tmp = new THREE.Vector3(), eyePos = new THREE.Vector3();
// One bad frame (a glitch in one object) must never freeze the whole room: the next frame is
// always asked for, and the error is reported once.
function frame(now) {
  requestAnimationFrame(frame);
  adaptDensity(now);
  try { drawFrame(now); } catch (e) { if (!frame.failed) { frame.failed = true; console.error('frame failed', e); } }
}
// Dynamic resolution: when frames come slower than ~48 a second for a while, draw fewer pixels
// (down to one per CSS pixel); when they keep up at full speed, try more again, up to the screen's own.
// A step down that doesn't make frames faster (a browser capping at 30 fps in power saving, or a
// slow CPU rather than GPU) is taken back, so a screen never loses sharpness for nothing.
const dens = { dpr: MAX_DPR, ceil: Infinity, t0: 0, n: 0, sum: 0, fast: 0, trial: null, stuck: false, warm: performance.now() + 2500 };
function setDensity(v) { dens.dpr = v; renderer.setPixelRatio(v); resize(); }
function adaptDensity(now) {
  const ms = now - (dens.last ?? now); dens.last = now;
  if (dens.stuck || MAX_DPR <= 1 || params.has('dpr')) return;
  // skip the first seconds (shaders compiling) and any hitch (a tab switch): start the window again
  if (now < dens.warm || document.hidden || ms > 1000) { dens.t0 = now; dens.n = dens.sum = 0; return; }
  dens.n++; dens.sum += ms;
  if (now - dens.t0 < 1200 || dens.n < 8) return;
  const avg = dens.sum / dens.n; dens.t0 = now; dens.n = dens.sum = 0;
  if (dens.trial) { // judge the last step down: keep it only if it bought real speed
    const t = dens.trial; dens.trial = null;
    if (avg > t.avg * 0.88) { setDensity(t.from); dens.stuck = true; return; }
  }
  if (avg > 1000 / 48 && dens.dpr > 1) {
    dens.trial = { from: dens.dpr, avg }; dens.ceil = dens.dpr; dens.fast = 0;
    setDensity(Math.max(1, dens.dpr - 0.25));
  } else if (avg < 1000 / 57) {
    // keeping up: after a good stretch, one step sharper; back up to a level that was once too slow
    // only after a much longer one, so a borderline device doesn't keep flipping between two
    dens.fast++;
    const next = Math.min(MAX_DPR, dens.dpr + 0.25);
    if (next > dens.dpr && dens.fast >= (next >= dens.ceil ? 20 : 5)) { dens.fast = 0; if (next >= dens.ceil) dens.ceil = Infinity; setDensity(next); }
  } else dens.fast = 0;
}
if (params.has('dpr')) { renderer.setPixelRatio(+params.get('dpr') || 1); resize(); } // ?dpr=1 fixes the density (screenshots, profiling)
// Has anything that casts a shadow moved, appeared or disappeared since the shadow map was drawn?
// (the shutter, the LEGGIMI book, books taken off the shelf, typewriter keys, clock hands, the sun)
let shadowSig = new Float32Array(0), shadowN = 0;
const shadowSnap = [];
function shadowsMoved() {
  shadowSnap.length = 0;
  scene.traverseVisible((o) => {
    if (!o.castShadow || !(o.isMesh || o.isLine || o.isPoints)) return;
    shadowSnap.push(o.id, o.geometry.attributes.position?.version ?? 0, o.geometry.drawRange.count, ...o.matrixWorld.elements);
    if (o.isInstancedMesh) shadowSnap.push(o.count, o.instanceMatrix.version);
  });
  shadowSnap.push(...sun.position.toArray(), ...sun.target.position.toArray(), sun.intensity > 0 ? 1 : 0);
  let moved = shadowSnap.length !== shadowN;
  if (!moved) for (let i = 0; i < shadowN; i++) if (shadowSig[i] !== Math.fround(shadowSnap[i])) { moved = true; break; }
  if (moved) {
    if (shadowSig.length < shadowSnap.length) shadowSig = new Float32Array(shadowSnap.length * 2);
    shadowSig.set(shadowSnap); shadowN = shadowSnap.length;
  }
  return moved;
}
function drawFrame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // free look: a turn you let go of coasts to a stop on its own; only the compass arrows aim at a wall
  if (!rig.dragging && rig.targetYaw !== null) {
    const d = wrap(rig.targetYaw - rig.yawT);
    rig.yawT += d * Math.min(1, dt * 3.2); // unhurried, so the walk round the room reads
    if (Math.abs(d) < 0.001) { rig.yawT = rig.targetYaw; rig.targetYaw = null; }
  } else if (!rig.dragging && rig.vyaw) {
    rig.yawT += rig.vyaw * dt;
    rig.vyaw *= Math.exp(-dt * LOOK.coast); // a flick carries on for about speed / 4: up to ~70°
    if (Math.abs(rig.vyaw) < 0.02) rig.vyaw = 0;
  }
  if (!rig.dragging) {
    // up and down coast too, and a pull past the limits springs back
    rig.pitchT += rig.vpitch * dt; rig.vpitch *= Math.exp(-dt * LOOK.coast * 1.5);
    if (Math.abs(rig.vpitch) < 0.02) rig.vpitch = 0;
    const lim = THREE.MathUtils.clamp(rig.pitchT, LOOK.down(), LOOK.up);
    if (lim !== rig.pitchT) { rig.vpitch = 0; rig.pitchT += (lim - rig.pitchT) * Math.min(1, dt * 12); if (Math.abs(lim - rig.pitchT) < 1e-4) rig.pitchT = lim; }
  }
  // the view follows a moment behind where you're taking it
  const follow = 1 - Math.exp(-dt / LOOK.ease[rig.feel]);
  rig.yawT = wrap(rig.yawT);
  rig.yaw = wrap(rig.yaw + wrap(rig.yawT - rig.yaw) * follow);
  rig.pitch += (rig.pitchT - rig.pitch) * follow;
  shelfView.update(dt, camera);
  const sk = Math.min(1, dt * 8);
  rig.kbBottom += (visibleBottom() - rig.kbBottom) * sk;
  rig.peekS.yaw += (rig.peek.yaw - rig.peekS.yaw) * sk; rig.peekS.pitch += (rig.peek.pitch - rig.peekS.pitch) * sk;
  const freePos = leanIn(eyeAt(rig.yaw, eyePos), rig.yaw, rig.pitch), freeTarget = tmp.copy(freePos).add(lookDir(rig.yaw, rig.pitch));
  if (rig.focus || (rig.from && rig.t < 1)) {
    rig.t = Math.min(1, rig.t + dt / 0.6);
    const k = ease(rig.t);
    const to = rig.focus ? leanOf(rig.focus) : { pos: freePos, target: freeTarget.clone(), fov: rig.baseFov, cx: innerWidth / 2, cy: innerHeight / 2 };
    camera.position.lerpVectors(rig.from.pos, to.pos, k);
    const t = new THREE.Vector3().lerpVectors(rig.from.target, to.target, k);
    const L = (a) => THREE.MathUtils.lerp(rig.from[a], to[a], k);
    rig.lens = { fov: L('fov'), cx: L('cx'), cy: L('cy') };
    camera.lookAt(t);
    if (!rig.focus && rig.t >= 1) rig.from = null;
  } else {
    camera.position.copy(freePos); camera.lookAt(freeTarget);
    rig.lens = { fov: rig.baseFov, cx: innerWidth / 2, cy: innerHeight / 2 };
  }
  applyLens(rig.lens);
  $('#wall-name').textContent = nearestWall().name;

  // window life runs only when you can see it
  const facingNorth = rig.focus ? rig.focus.wall === 0 : Math.abs(wrap(rig.yaw)) < 1.25;
  view.active = facingNorth;
  // draw the countryside only when the window is somewhere in the frame
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  view.setVisible(frustum.intersectsBox(WINDOW_BOX) || camera.position.z < -ROOM.hz);
  view.update(now, dt);
  updateLight();
  teletext.draw(now);
  tv.tick(now);
  typewriter.tick(now, dt);
  bike.tick(now);
  racket.tick(now);
  shutter += (shutterTarget - shutter) * Math.min(1, dt * 2.2); layoutShutter();
  bookOut += (bookTarget - bookOut) * Math.min(1, dt * 6);
  leggimi.tick(now, bookOut);
  if (Math.floor(now / 60000) !== drawFrame.min) { drawFrame.min = Math.floor(now / 60000); cal.draw(); }

  post.mat.uniforms.uTime.value = now / 1000;
  scene.updateMatrixWorld();
  if (shadowsMoved()) renderer.shadowMap.needsUpdate = true;
  post.render(scene, camera);
  placeHotspots();
}
function placeHotspots() {
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  for (const h of HOT) {
    const v = h.at.clone();
    const toP = v.clone().sub(camera.position);
    const inFront = toP.dot(fwd) > 0.2;
    v.project(camera);
    const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    const on = inFront && x > 20 && x < innerWidth - 20 && y > 70 && y < innerHeight - 70 && !rig.focus;
    h.el.style.display = on ? '' : 'none';
    h.screen = on ? { x, y } : null;
    if (on) { h.el.style.left = x + 'px'; h.el.style.top = y + 'px'; h.el.classList.toggle('flip', x > innerWidth - 300); }
  }
}
// Compile every shader before the first frame, where the browser can do it without stopping the page
// (so the bar keeps going); the first frame then has less to do. Drawn into the post pass's target,
// as the first frame will be, so the compiled programs are the ones it uses.
await boot(0.7, 0.93, 2500 * speed);
try {
  renderer.setRenderTarget(post.rtColor);
  await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 12000))]);
} catch (e) { console.warn('shader warm-up skipped', e); } finally { renderer.setRenderTarget(null); }
await boot(0.93, 0.99, 1500 * speed);
requestAnimationFrame((t) => { last = t; setTimeout(() => { boot(1); $('#loading').classList.add('gone'); }, 200); frame(t); });
// ?cam=x,y,z,tx,ty,tz[,fov] parks the camera anywhere (for screenshots while modelling)
if (params.has('cam')) {
  const v = params.get('cam').split(',').map(Number);
  setTimeout(() => focus({ id: 'cam', wall: 0, lean: { pos: new THREE.Vector3(v[0], v[1], v[2]), target: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6] || 40 } }), 100);
  setTimeout(() => { rig.t = 1; }, 150);
}
// ?shelf=1 opens the close-up on that shelf (0 = top); add &book=N to take out its Nth book
if (params.has('shelf')) setTimeout(() => {
  enterShelf(+params.get('shelf') || 0, params.has('x') ? +params.get('x') : null);
  if (params.has('book')) setTimeout(() => shelfView.pull(shelfView.row.books[+params.get('book')] ?? shelfView.row.books[0]), 900);
}, 300);
if (params.has('focus')) setTimeout(() => activate(HOT.find((h) => h.id === params.get('focus'))), 300);
window.__scene = { scene, camera, renderer, dens, rig, teletext, typewriter, view, HOT, activate, shelfView, bike, racket, sound };
