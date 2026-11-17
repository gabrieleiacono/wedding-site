// La bacheca: the cork board on the desk wall, left of the window, next to the bass, with their photos
// pinned to it. The cork and the prints are drawn into one canvas (so the whole board is one texture),
// each print from the photo's small copy (assets/photos/s) as it loads; the push pins are little meshes
// on top. Up close, a tap on a print opens the photo viewer on it (overlays.photos), where every photo
// can be browsed, pinned or not.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { ROOM, box, M } from './room.js';
import { rng } from './keepsakes-art.js';
import { PHOTOS } from './photos.js';

export const BOARD = { x: -1.25, y: 1.6, w: 0.74, h: 0.56, frame: 0.025 }; // centre on the north wall, cork size, frame width
const MAX_PINNED = 12; // more than this and the prints get too small to see from the room
const PX = 2048 / BOARD.w; // canvas pixels per metre
const PIN_COLORS = ['#C8352B', '#E8B830', '#2F5F9E', '#3E7A4A', '#F2EEE4'];

/** Which photos go on the board: all of them if they fit, otherwise MAX_PINNED spread through the set. */
function pinnedIndices(n) {
  if (n <= MAX_PINNED) return [...Array(n).keys()];
  return [...Array(MAX_PINNED).keys()].map((i) => Math.round(i * (n - 1) / (MAX_PINNED - 1)));
}

/** Where each print goes, in canvas pixels: a loose grid, every print a little off and a little askew. */
function layout(list) {
  const r = rng(29), k = list.length, W = BOARD.w * PX, H = BOARD.h * PX, m = 0.03 * PX;
  const cols = Math.max(1, Math.round(Math.sqrt(k * W / H))), rows = Math.ceil(k / cols);
  const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows, edge = Math.min(cw, ch) * 0.94;
  return list.map((i, j) => {
    const row = Math.floor(j / cols), inRow = row === rows - 1 ? k - row * cols : cols;
    const col = j % cols + (cols - inRow) / 2; // a short last row sits in the middle
    const p = PHOTOS[i], a = p.w / p.h, long = edge * (0.92 + r() * 0.08);
    const w = a >= 1 ? long : long * a, h = a >= 1 ? long / a : long;
    return {
      i, w, h,
      cx: m + (col + 0.5) * cw + (r() - 0.5) * cw * 0.12,
      cy: m + (row + 0.5) * ch + (r() - 0.5) * ch * 0.1 + ch * 0.03,
      rot: (r() - 0.5) * 0.14,
      pin: PIN_COLORS[Math.floor(r() * PIN_COLORS.length)],
    };
  });
}

/** Cork: a warm ground with thousands of darker and lighter granules. */
function drawCork(g, W, H) {
  g.fillStyle = '#B88A55'; g.fillRect(0, 0, W, H);
  const r = rng(7);
  for (let n = 0; n < 26000; n++) {
    const x = r() * W, y = r() * H, s = 1 + r() * 3.2, t = r();
    g.fillStyle = t < 0.5 ? `rgba(110,72,36,${0.25 + r() * 0.3})` : t < 0.8 ? `rgba(214,170,110,${0.25 + r() * 0.3})` : `rgba(70,44,22,${0.3 + r() * 0.3})`;
    g.fillRect(x, y, s, s * (0.6 + r() * 0.8));
  }
  // a few old pin holes
  for (let n = 0; n < 40; n++) { g.fillStyle = 'rgba(50,30,15,0.6)'; g.beginPath(); g.arc(r() * W, r() * H, 2.2, 0, Math.PI * 2); g.fill(); }
}

export function buildBacheca(room) {
  const g = new THREE.Group(); room.add(g);
  g.position.set(BOARD.x, BOARD.y, -ROOM.hz);
  const { w, h, frame: f } = BOARD;
  // the frame: a pine moulding round the cork, standing a little proud of it
  box(w + 2 * f, h + 2 * f, 0.012, M.frame, 0, 0, 0.006, g);
  box(w + 2 * f, f, 0.03, M.frame, 0, h / 2 + f / 2, 0.015, g);
  box(w + 2 * f, f, 0.03, M.frame, 0, -h / 2 - f / 2, 0.015, g);
  box(f, h, 0.03, M.frame, -w / 2 - f / 2, 0, 0.015, g);
  box(f, h, 0.03, M.frame, w / 2 + f / 2, 0, 0.015, g);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX); canvas.height = Math.round(h * PX);
  const ctx = canvas.getContext('2d');
  const cork = document.createElement('canvas'); cork.width = canvas.width; cork.height = canvas.height;
  drawCork(cork.getContext('2d'), cork.width, cork.height);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), makeInk({ color: '#ffffff', map: tex, wash: 0.94, hatch: 0.22, lift: 0.08 }));
  face.position.z = 0.0125; face.receiveShadow = true; g.add(face);

  const slots = layout(pinnedIndices(PHOTOS.length));
  const imgs = new Map();
  const border = 0.0065 * PX; // the white edge of the print
  function draw() {
    ctx.drawImage(cork, 0, 0);
    for (const s of slots) {
      ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(s.rot);
      ctx.shadowColor = 'rgba(45,25,10,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 9;
      ctx.fillStyle = '#F6F2EA'; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.shadowColor = 'transparent';
      const img = imgs.get(s.i), iw = s.w - 2 * border, ih = s.h - 2 * border;
      if (img) ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      else { ctx.fillStyle = '#D9D2C4'; ctx.fillRect(-iw / 2, -ih / 2, iw, ih); }
      ctx.restore();
    }
    tex.needsUpdate = true;
  }
  draw();
  let pending = 0;
  for (const s of slots) {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { imgs.set(s.i, img); if (!pending++) requestAnimationFrame(() => { pending = 0; draw(); }); };
    img.src = PHOTOS[s.i].s;
  }

  // push pins, at the top of each print: a short steel shank and a plastic head
  const steel = makeInk({ color: '#B9B6AE', wash: 0.6 });
  const pinMats = Object.fromEntries(PIN_COLORS.map((c) => [c, makeInk({ color: c, wash: 0.8 })]));
  const toLocal = (x, y) => new THREE.Vector2(x / PX - w / 2, h / 2 - y / PX);
  for (const s of slots) {
    const top = new THREE.Vector2(0, -s.h / 2 + border * 1.6).rotateAround(new THREE.Vector2(), s.rot);
    const p = toLocal(s.cx + top.x, s.cy + top.y);
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.008, 6), steel);
    shank.rotation.x = Math.PI / 2; shank.position.set(p.x, p.y, 0.016); g.add(shank);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, 0.006, 14), pinMats[s.pin]);
    cap.rotation.x = Math.PI / 2; cap.position.set(p.x, p.y, 0.022); g.add(cap);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 14, 10), pinMats[s.pin]);
    head.scale.z = 0.7; head.position.set(p.x, p.y, 0.027); g.add(head);
    for (const m of [cap, head]) m.castShadow = true;
  }

  const inside = (o) => { for (; o; o = o.parent) if (o === g) return true; return false; };
  /** The photo (its index in PHOTOS) under a raycast hit on the board, or null. */
  function photoAt(hit) {
    if (hit?.object !== face || !hit.uv) return null;
    const x = hit.uv.x * canvas.width, y = (1 - hit.uv.y) * canvas.height;
    for (let j = slots.length - 1; j >= 0; j--) {
      const s = slots[j], dx = x - s.cx, dy = y - s.cy, c = Math.cos(s.rot), sn = Math.sin(s.rot);
      if (Math.abs(dx * c + dy * sn) <= s.w / 2 && Math.abs(-dx * sn + dy * c) <= s.h / 2) return s.i;
    }
    return null;
  }
  return { group: g, center: g.position.clone().add(new THREE.Vector3(0, 0, 0.02)), isBoard: inside, photoAt, count: PHOTOS.length };
}
