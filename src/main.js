// Lo Scrittoio con Vista — boot, lights, camera rig, hotspots and the frame loop.
import * as THREE from 'three';
import { InkPost, makeScreen } from './ink.js';
import { buildRoom, EYE, ROOM, WINDOW } from './room.js';
import { buildTV } from './tv.js';
import { buildBookshelf } from './bookshelf.js';
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

await Promise.race([
  Promise.all(['700 22px "IBM Plex Mono"', '400 20px "Courier Prime"', '700 20px Caveat', '800 30px "Bricolage Grotesque"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);

// --- renderer ------------------------------------------------------------------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new InkPost(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 2000);
camera.layers.enable(1);

const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
const WINDOW_BOX = new THREE.Box3(new THREE.Vector3(WINDOW.x0, WINDOW.y0, -ROOM.hz - 0.2), new THREE.Vector3(WINDOW.x1, WINDOW.y1, -ROOM.hz + 0.05));
const sound = new Sound();
const store = createStore();
const overlays = new Overlays();

// --- the room --------------------------------------------------------------------
const { room, anchors } = buildRoom(scene);
const teletext = new Teletext(store);
const tv = buildTV(room, teletext);
const shelf = buildBookshelf(room);
const shelfView = new ShelfView({ shelf: shelf.shelf, leggimi: shelf.leggimi, sound });
const typewriter = new Typewriter(room, sound);
const view = new Countryside(scene, sound);
if (params.has('dusk')) view.fixedDusk = +params.get('dusk');
const cal = calendarTexture();
const calFace = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), makeScreen(cal.tex));
calFace.position.set(0.004, 0, 0); calFace.rotation.y = Math.PI / 2; anchors.calendarGroup.add(calFace);

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

function updateLight() {
  const dusk = view.dusk; // 0 hero bake … 1 blue hour
  const el = THREE.MathUtils.degToRad(17 - dusk * 12), az = THREE.MathUtils.degToRad(-24);
  const d = 9;
  sun.position.set(sun.target.position.x + Math.sin(az) * Math.cos(el) * d, sun.target.position.y + Math.sin(el) * d, sun.target.position.z - Math.cos(az) * Math.cos(el) * d);
  sun.intensity = 1.5 * (1 - THREE.MathUtils.smoothstep(dusk, 0.55, 0.95));
  sun.color.set('#FFC88A').lerp(new THREE.Color('#F08A7A'), dusk);
  hemi.intensity = 1.0 - dusk * 0.35;
  hemi.color.set('#F4D2B0').lerp(new THREE.Color('#8A86B8'), dusk);
  lamp.intensity = THREE.MathUtils.smoothstep(dusk, 0.35, 0.8) * 0.9;
  tv.glow.intensity = 0.1 + dusk * 0.3;
}

// --- camera rig ------------------------------------------------------------------------
const WALLS = [
  { yaw: 0, name: 'A · La scrivania' }, { yaw: -Math.PI / 2, name: 'B · Il televisore' },
  { yaw: Math.PI, name: 'C · La libreria' }, { yaw: Math.PI / 2, name: 'D · La porta' },
];
const rig = { yaw: 0, pitch: -0.15, vyaw: 0, targetYaw: null, dragging: false, focus: null, t: 0, from: null,
  lens: { fov: 60, cx: innerWidth / 2, cy: innerHeight / 2 }, peek: { yaw: 0, pitch: 0 }, peekS: { yaw: 0, pitch: 0 }, peeking: false, kbBottom: innerHeight };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
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
function turn(dir) { const w = nearestWall(); rig.targetYaw = w.yaw + dir * Math.PI / 2; }
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
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
  if (shelfView.active) { shelfView.pointerDown(e); canvas.setPointerCapture(e.pointerId); return; }
  if (rig.focus) { if (rig.focus.peek) { rig.peeking = true; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); } return; }
  rig.dragging = true; rig.targetYaw = null; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (shelfView.active) shelfView.pointerMove(e);
  if (!down) return;
  const dx = e.movementX ?? 0, dy = e.movementY ?? 0;
  down.moved = Math.max(down.moved + Math.abs(dx) + Math.abs(dy), Math.hypot(e.clientX - down.x, e.clientY - down.y));
  if (rig.peeking) { peekBy(dx * 0.004, dy * 0.004); return; }
  if (!rig.dragging) return;
  const k = 0.0045 * (60 / camera.fov) ** -1;
  rig.yaw += dx * k; rig.vyaw = dx * k;
  rig.pitch = THREE.MathUtils.clamp(rig.pitch + dy * k, THREE.MathUtils.degToRad(-25), THREE.MathUtils.degToRad(15));
  $('#hint').style.opacity = 0;
});
canvas.addEventListener('pointerup', (e) => {
  if (shelfView.active) shelfView.pointerUp(e);
  if (rig.dragging || rig.peeking) { rig.dragging = rig.peeking = false; canvas.classList.remove('dragging'); }
  if (down && down.moved < 8) clickAt(e.clientX, e.clientY);
  else if (!rig.focus) { rig.yaw += rig.vyaw * 8; rig.targetYaw = nearestWall().yaw + Math.round(wrap(rig.yaw - nearestWall().yaw) / (Math.PI / 2)) * Math.PI / 2; }
  down = null;
});
canvas.addEventListener('pointercancel', (e) => { if (shelfView.active) shelfView.pointerUp(e); down = null; rig.peeking = false; });
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
const TV_PTS = around(tv.screenWorld, 0.01, 0.27, 0.35);
const TV_LEAN = () => frameView({ pts: TV_PTS, dir: new THREE.Vector3(1, -0.07, 0), fov: portrait() ? 55 : 40, fill: 0.88 });
// Window: your face right at the open window, in the frame itself (still this side of the shutter's
// guides), so the country fills the picture; drag or use the arrows to look along the hills or down
// into the paddock. A wider lens on a tall phone screen.
const WINDOW_EYE = new THREE.Vector3(0, 1.48, -ROOM.hz + 0.07);
const WINDOW_LEAN = () => {
  const tall = portrait();
  return { pos: WINDOW_EYE, target: WINDOW_EYE.clone().add(lookDir(rig.peekS.yaw, -0.1 + rig.peekS.pitch)), fov: tall ? 74 : 62 };
};
const ALBUM_LEAN = () => frameView({ pts: around(anchors.album, 0.19, 0.03, 0.17), dir: elev(52, 0.25), fov: 45 });
const NOTEBOOK_LEAN = () => frameView({ pts: around(anchors.notebooks, 0.12, 0.04, 0.15), dir: elev(52, -0.25), fov: 45 });
const CAL_LEAN = () => frameView({ pts: around(anchors.calendar, 0.01, 0.26, 0.2), dir: new THREE.Vector3(-1, -0.04, 0), fov: 45 });
const leggimiAt = shelf.leggimi.getWorldPosition(new THREE.Vector3());
// LEGGIMI: the glowing book and its neighbours, so you see it come out of the row
const LEGGIMI_LEAN = () => frameView({ pts: around(leggimiAt, 0.2, 0.2, 0.08), dir: new THREE.Vector3(0, -0.12, 1), fov: 45 });
const HIFI_LEAN = () => frameView({ pts: around(shelf.hifi.clone().add(new THREE.Vector3(0, -0.02, 0.12)), 0.27, 0.14, 0.11), dir: new THREE.Vector3(0.15, -0.2, 1), fov: 45 });
// Door: walk up to it, lever and panels in view, as if about to leave
const DOOR_LEAN = () => frameView({ pts: around(new THREE.Vector3(anchors.door.x, 1.25, anchors.door.z), 0.02, 0.55, 0.5), dir: new THREE.Vector3(-1, -0.08, 0.12), fov: 50 });

// --- hotspots ----------------------------------------------------------------------------
const HOT = [
  { n: 1, id: 'typewriter', title: 'Macchina da scrivere', sub: 'Rispondi all\'invito', at: typewriter.world, wall: 0,
    lean: TYPEWRITER_LEAN, go: startTyping },
  { n: 2, id: 'album', title: 'Album fotografico', sub: 'Le nostre foto peggiori', at: anchors.album, wall: 0,
    lean: ALBUM_LEAN, go: () => overlays.album() },
  { n: 3, id: 'notebooks', title: 'Quaderni', sub: 'La nostra storia, in cinque puntate', at: anchors.notebooks, wall: 0,
    lean: NOTEBOOK_LEAN, go: () => overlays.notebooks() },
  { n: 4, id: 'tv', title: 'Televisore · Televideo', sub: 'Tutte le informazioni, pagina per pagina', at: tv.screenWorld.clone().add(new THREE.Vector3(0, 0.3, 0)), wall: 1, lean: TV_LEAN, go: () => showRemote(true) },
  { n: 5, id: 'remote', title: 'Telecomando', sub: 'Accendi il televideo', at: anchors.remote, wall: 0, lean: TV_LEAN, go: () => { sound.tvClick(); showRemote(true); } },
  { n: 6, id: 'console', title: 'Console', sub: 'Passa su AV e gioca', at: tv.ps, wall: 1, lean: TV_LEAN, go: () => { teletext.setAV(true); showRemote(true); } },
  { n: 7, id: 'leggimi', title: 'Libreria', sub: 'Un libro brilla: LEGGIMI', at: leggimiAt, wall: 2,
    lean: LEGGIMI_LEAN, go: () => { pullBook(true); setTimeout(() => overlays.leggimi(), 650); } },
  { n: 8, id: 'window', title: 'Finestra', sub: 'Alza la tapparella e affacciati', at: new THREE.Vector3(WINDOW.x1 - 0.3, 1.3, -ROOM.hz), wall: 0, lean: WINDOW_LEAN, peek: true, go: lookOut },
  { n: 9, id: 'calendar', title: 'Calendario', sub: 'Quanto manca?', at: anchors.calendar, wall: 3,
    lean: CAL_LEAN, go: () => overlays.calendar() },
  { n: '☎', id: 'phone', title: 'Telefono', sub: 'Domande frequenti', at: anchors.phone, wall: 3, lean: TV_LEAN, go: () => { teletext.go('700'); showRemote(true); } },
  { n: '♪', id: 'hifi', title: 'Mini hi-fi', sub: 'La playlist', at: shelf.hifi, wall: 2, lean: HIFI_LEAN, go: () => overlays.playlist() },
  { n: 'Aa', id: 'shelf', title: 'Scaffali', sub: 'Avvicinati e leggi i titoli', wall: 2, lean: shelfView.lean, go: () => { shelfView.enter(shelfAsk.ri, shelfAsk.x); shelfAsk = { ri: 0, x: null }; },
    at: (() => { const R = shelf.shelf.rows[3]; return shelf.shelf.group.localToWorld(new THREE.Vector3(0.15, R.y + 0.12, shelf.shelf.spineZ)); })() },
  { n: '⌂', id: 'door', title: 'La porta', sub: 'Titoli di coda', at: anchors.door, wall: 3, lean: DOOR_LEAN, go: () => overlays.credits() },
];
const shelfHot = HOT.find((h) => h.id === 'shelf');
const windowGroup = anchors.shutter.shutter.parent;
let shelfAsk = { ri: 0, x: null }; // which shelf the close-up opens on: the top one, unless you tapped a book
function enterShelf(ri = 1, x = null) { shelfAsk = { ri, x }; activate(shelfHot); }
shelfView.onLeggimi = () => { pullBook(true); setTimeout(() => overlays.leggimi(), 650); };
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
  const w = WALLS[h.wall];
  rig.targetYaw = rig.yaw + wrap(w.yaw - rig.yaw);
  if (h.lean) focus(h);
  h.go?.();
}
function focus(h) {
  rig.from = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())), ...rig.lens };
  rig.focus = h; rig.t = 0;
  rig.peek.yaw = rig.peek.pitch = rig.peekS.yaw = rig.peekS.pitch = 0;
  document.body.classList.add('focused');
  $('#back').hidden = false;
  view.leaning = ['typewriter', 'album', 'notebooks', 'window'].includes(h.id);
}
function unfocus(quick) {
  if (!rig.focus) return;
  const h = rig.focus;
  rig.from = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())), ...rig.lens, back: true };
  // recover yaw/pitch from the current gaze so the return is seamless
  const d = camera.getWorldDirection(new THREE.Vector3());
  rig.yaw = Math.atan2(-d.x, -d.z); rig.pitch = THREE.MathUtils.clamp(Math.asin(d.y), -0.43, 0.26);
  rig.targetYaw = nearestWall().yaw; rig.pitch = -0.15;
  rig.focus = null; rig.t = quick ? 1 : 0; rig.peeking = false;
  document.body.classList.remove('focused');
  $('#back').hidden = true; $('#help').hidden = true;
  view.leaning = false;
  if (h.id === 'typewriter') stopTyping();
  if (['tv', 'remote', 'console', 'phone'].includes(h.id)) showRemote(false);
  if (h.id === 'leggimi') pullBook(false);
  if (h.id === 'shelf') { shelfView.leave(); pullBook(false); }
}
$('#back').addEventListener('click', () => unfocus());
overlays.onClose = () => { if (shelfView.active) pullBook(false); else unfocus(); };

function clickAt(x, y) {
  const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  // creatures in the window: bray / crow on click
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  // the raycaster doesn't skip hidden things (the rolled-up shutter slats), so we do
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const hitRoom = ray.intersectObject(room, true).find((h) => shown(h.object));
  if (view.group.visible && view.pick(ray, hitRoom ? hitRoom.distance : Infinity)) return;
  if (shelfView.active) { if (!shelfView.multi) shelfView.tap(ray); return; }
  if (rig.focus) return;
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
  b.addEventListener('click', () => { sound.tvClick(); if (k === 'AV') teletext.setAV(!teletext.av); else if (k === 'TXT') teletext.go('100'); else teletext.digit(k); refreshRemote(); });
  digits.appendChild(b);
});
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
  $('#remote-display').textContent = teletext.av ? 'AV1' : 'P' + (teletext.buf ? (teletext.buf + '___').slice(0, 3) : teletext.page === 'none' ? teletext.missing : teletext.page);
}
teletext.onChange = refreshRemote;
function showRemote(on) {
  remote.hidden = !on; refreshRemote();
  $('#help').hidden = !on;
  if (on) $('#help').textContent = 'Digita tre cifre (anche da tastiera) · i tasti colorati portano alle pagine';
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
$('#title').textContent = `${WEDDING.names} · ${WEDDING.dateLong} · ${WEDDING.villa}`;

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
if (params.has('wall')) rig.yaw = WALLS[+params.get('wall')]?.yaw ?? 0;

// --- frame loop -------------------------------------------------------------------------------
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
let last = performance.now();
const tmp = new THREE.Vector3(), eyePos = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // free look: inertia + soft snap
  if (!rig.dragging && rig.targetYaw !== null) {
    const d = wrap(rig.targetYaw - rig.yaw);
    rig.yaw += d * Math.min(1, dt * 3.2); // unhurried, so the walk round the room reads
    if (Math.abs(d) < 0.001) { rig.yaw = rig.targetYaw; rig.targetYaw = null; }
  }
  shelfView.update(dt, camera);
  const sk = Math.min(1, dt * 8);
  rig.kbBottom += (visibleBottom() - rig.kbBottom) * sk;
  rig.peekS.yaw += (rig.peek.yaw - rig.peekS.yaw) * sk; rig.peekS.pitch += (rig.peek.pitch - rig.peekS.pitch) * sk;
  const freePos = eyeAt(rig.yaw, eyePos), freeTarget = tmp.copy(freePos).add(lookDir(rig.yaw, rig.pitch));
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
  const facingNorth = Math.abs(wrap(rig.yaw)) < 1.25 && (!rig.focus || rig.focus.wall === 0);
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
  shutter += (shutterTarget - shutter) * Math.min(1, dt * 2.2); layoutShutter();
  bookOut += (bookTarget - bookOut) * Math.min(1, dt * 6);
  shelf.leggimi.position.z = shelf.leggimiRest.z - bookOut * 0.14;
  shelf.leggimi.material.emissiveIntensity = 0.55 + Math.sin(now / 600) * 0.25;
  shelf.leggimiLight.intensity = 0.2 + Math.sin(now / 600) * 0.08;
  if (Math.floor(now / 60000) !== frame.min) { frame.min = Math.floor(now / 60000); cal.draw(); }

  post.mat.uniforms.uTime.value = now / 1000;
  post.render(scene, camera);
  placeHotspots();
  requestAnimationFrame(frame);
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
requestAnimationFrame((t) => { last = t; frame(t); setTimeout(() => $('#loading').classList.add('gone'), 200); });
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
window.__scene = { scene, camera, rig, teletext, typewriter, view, HOT, activate, shelfView };
