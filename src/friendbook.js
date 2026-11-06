// "La causa dei vivi" by Anna Gabriella Rusconi (Cronache Ribelli, 2026): a friend's novel, standing
// face-out on the shelf just right of LEGGIMI, its cover to the room. Its spine is drawn from the elements
// below (as on the real book: CRONACHE RIBELLI at the head, then title and author in gold Cinzel on matte
// black). On the shelf and in the hand it is the same model, a proper paperback with flaps: two cover boards and a spine,
// the red flaps folded inside them, a white page block with its edges, the real front cover and the six
// gold lines of the back, and it turns to face you (tap it to turn it over).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { drawSpine, rng } from './spines.js';
import { FRIEND_BOOK } from './content.js';

const BLACK = '#1B1B1A', GOLD = '#D6C8A2', RED = '#D23A2A', FLAP = '#C8231B', PAPER = '#F6F4EF';
const COVER_URL = 'assets/books/la-causa-dei-vivi.jpg'; // the publisher's front cover, 1100×1540
const BACK_LINES = [
  'Sulle strade di Trento cade un nevischio',
  'che appena tocca terra',
  'si scioglie in grumi di fango e pozzanghere:',
  'davanti al patibolo la comunità cittadina',
  'si stringe sotto i mantelli e trema per il gelo',
  'che risale dai calzari bagnati.',
];
const FLAP_W = 92; // mm: how far each flap reaches in from the fore-edge

/** The book as the shelf knows it (same fields as a normalised entry of books-data.js). */
export function friendBook() {
  return {
    ...FRIEND_BOOK, friend: true, seed: 1475, idx: -1,
    h: 210, t: 18, d: 150, binding: 'paperback', age: 0.02, read: 0, mint: true,
    paper: PAPER, flaps: FLAP, flapW: FLAP_W,
    spine: {
      bg: BLACK, text_color: GOLD, accent: GOLD, title_orientation: 'down',
      elements: [
        { type: 'text', role: 'series', text: 'CRONACHE RIBELLI', y: 0.03, y_to: 0.135, size_mm: 2.1, font: 'swiss', weight: 600, color: '#E9E4D8', orientation: 'down', letter_spacing: 0.04 },
        { type: 'text', role: 'title', text: 'LA CAUSA DEI VIVI', y: 0.24, y_to: 0.52, size_mm: 4.4, font: 'cinzel', weight: 500, color: GOLD, orientation: 'down', letter_spacing: 0.06 },
        { type: 'text', role: 'author', text: 'Anna Gabriella Rusconi', y: 0.6, y_to: 0.92, size_mm: 3.7, font: 'cinzel', weight: 400, color: GOLD, orientation: 'down', letter_spacing: 0.03 },
      ],
    },
  };
}

// --- textures, drawn once and kept (the book can be taken out again and again) --------------------
const tex = {};
const CINZEL = '400 20px "Cinzel"';
/** Run fn once Cinzel is in, if it isn't yet (a slow connection can outlast the shelf's wait for its fonts). */
export function whenCinzel(fn) {
  if (typeof document === 'undefined' || !document.fonts || document.fonts.check(CINZEL)) return;
  document.fonts.load(CINZEL, 'LA CAUSA').then(fn, () => {});
}
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  whenCinzel(() => { x.reset?.(); x.setTransform(1, 0, 0, 1, 0, 0); draw(x, w, h); t.needsUpdate = true; });
  return t;
};

/** Start fetching the cover (when the shelf close-up opens), so it is there by the time you pull the book. */
export function preloadFriendCover() {
  if (tex.front || typeof document === 'undefined') return tex.front;
  // until the picture arrives: the cover's own type on black
  tex.front = canvasTex(550, 770, (x, w, h) => {
    x.fillStyle = BLACK; x.fillRect(0, 0, w, h);
    x.fillStyle = RED; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = '700 118px "Cinzel", serif';
    [['LA', 250], ['CAUSA', 370], ['DEI', 540], ['VIVI', 660]].forEach(([s, y]) => x.fillText(s, w / 2, y));
    x.fillStyle = GOLD; x.font = '400 20px "Cinzel", serif'; x.textAlign = 'left'; x.fillText('Anna Gabriella Rusconi', 34, 722);
    x.font = '700 22px "Cinzel", serif'; x.textAlign = 'right'; x.fillText('ROMANZO STORICO', w - 30, 722);
    x.font = '600 13px "Inter", sans-serif'; x.fillStyle = '#E9E4D8'; x.textAlign = 'left'; x.fillText('CRONACHE RIBELLI', 40, 66);
  });
  new THREE.TextureLoader().load(COVER_URL, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const old = tex.front; tex.front = t;
    for (const m of live) if (m.map === old) { m.map = t; m.needsUpdate = true; }
    old.dispose();
  });
  return tex.front;
}
const live = new Set(); // materials showing the front cover right now

function backTexture() {
  // the back: six lines of the opening, centred, in gold Cinzel (its lower case is small capitals)
  return tex.back ??= canvasTex(1100, 1540, (x, w, h) => {
    const k = w / 150; // px per mm
    x.fillStyle = BLACK; x.fillRect(0, 0, w, h);
    grain(x, w, h, rng(29));
    x.fillStyle = GOLD; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    let size = 5.0 * k;
    const set = () => { x.font = `400 ${size}px "Cinzel", serif`; if ('letterSpacing' in x) x.letterSpacing = `${(0.02 * size).toFixed(1)}px`; };
    set();
    const widest = Math.max(...BACK_LINES.map((l) => x.measureText(l).width));
    if (widest > w * 0.8) { size *= (w * 0.8) / widest; set(); }
    BACK_LINES.forEach((l, i) => x.fillText(l, w / 2, (53 + i * 8.1) * k));
  });
}

function spineTexture(b) {
  // the shelf's spine drawing, at 18 px per mm
  return tex.spine ??= canvasTex(Math.round(b.t * 18), Math.round(b.h * 18), (x, w, h) => {
    x.scale(w / b.t, h / b.h); drawSpine(x, b, b.t, b.h);
  });
}

function edgeTexture() {
  // the page block's edges: bright white paper, the leaves just visible as fine lines across the thickness
  return tex.edge ??= canvasTex(512, 8, (x, w, h) => {
    const r = rng(314);
    x.fillStyle = PAPER; x.fillRect(0, 0, w, h);
    for (let u = 0; u < w; u += 1 + r() * 2.5) { x.globalAlpha = 0.05 + r() * 0.1; x.fillStyle = r() < 0.7 ? '#8C8579' : '#FFFFFF'; x.fillRect(u, 0, 1, h); }
    x.globalAlpha = 1;
    const g = x.createLinearGradient(0, 0, w, 0); // a little shadow where the pages meet the covers
    g.addColorStop(0, 'rgba(60,50,40,0.18)'); g.addColorStop(0.04, 'rgba(60,50,40,0)'); g.addColorStop(0.96, 'rgba(60,50,40,0)'); g.addColorStop(1, 'rgba(60,50,40,0.18)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

function grain(x, w, h, r) {
  // matte card: a faint, even tooth
  x.save();
  for (let i = 0, n = (w * h) / 60; i < n; i++) { x.globalAlpha = 0.05 * r(); x.fillStyle = r() < 0.5 ? '#000' : '#fff'; x.fillRect(r() * w, r() * h, 1.5, 1.5); }
  x.restore();
}

// --- the model ---------------------------------------------------------------------------------------
/**
 * The paperback, centred like the shelf's box for it: x across the thickness (the front cover is the -x
 * side, the back +x), y up, z through the depth with the spine at -z. userData.present tells the shelf
 * close-up to show it cover first; userData.tick(dt, held) lets the covers spring open a little in the hand.
 */
export function buildFriendBook(b) {
  const T = b.t / 1000, H = b.h / 1000, D = b.d / 1000;
  const c = 0.0004, f = 0.00025, fw = FLAP_W / 1000; // cover card, flap card, flap width
  const g = new THREE.Group();
  const geos = [], mats = [];
  const mat = (o) => { const m = makeInk({ color: '#ffffff', hatch: 0, wash: 1, ...o }); mats.push(m); return m; };
  const black = mat({ color: BLACK }), red = mat({ color: FLAP }), white = mat({ color: PAPER });
  const front = mat({ map: preloadFriendCover() }); live.add(front);
  const back = mat({ map: backTexture() }), spine = mat({ map: spineTexture(b) }), edge = mat({ map: edgeTexture() });
  const part = (w, h, d, faces, parent, x, y, z) => {
    // faces in BoxGeometry order: +x, -x, +y, -y, +z, -z
    const geo = new THREE.BoxGeometry(w, h, d); geos.push(geo);
    const m = new THREE.Mesh(geo, faces); m.position.set(x, y, z); parent.add(m);
    return m;
  };
  // the page block, a hair shorter than the covers and set back from the fore-edge
  const bw = T - 2 * (c + f);
  part(bw, H - 0.0005, D - c - 0.0004, [white, white, edge, edge, edge, white], g, 0, 0, c / 2 - 0.0002);
  // the spine
  part(T, H, c, [black, black, black, black, black, spine], g, 0, 0, -D / 2 + c / 2);
  // the covers, each hinged where it meets the spine, with its flap folded in behind it
  const cover = (side) => {
    const hinge = new THREE.Group(); hinge.position.set(side * (T / 2), 0, -D / 2 + c); g.add(hinge);
    const outer = side < 0 ? [red, front, black, black, black, black] : [back, red, black, black, black, black];
    part(c, H, D - c, outer, hinge, -side * c / 2, 0, (D - c) / 2);
    part(f, H - 0.0003, fw, [red, red, red, red, red, red], hinge, -side * (c + f / 2), 0, D - c - fw / 2);
    return hinge;
  };
  const hinges = [cover(-1), cover(1)];
  let open = 0;
  g.userData = {
    present: true,
    /** In the hand the covers relax open a few degrees, as a new paperback's do; on the shelf they close. */
    tick(dt, held) {
      open += ((held ? 0.035 : 0) - open) * Math.min(1, dt * 3);
      hinges[0].rotation.y = -open; hinges[1].rotation.y = open * 0.6;
    },
    dispose() {
      g.parent?.remove(g); live.delete(front);
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); // the textures stay, for next time
    },
  };
  return g;
}
