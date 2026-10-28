// Wall C (south): the bookshelf (design F5). Real books by the authors we love, in their Italian
// editions (spines drawn by spines.js from books-data.js), the mini hi-fi, a tennis trophy, a globe,
// and one glowing book, LEGGIMI, that pulls out. Some shelf space is kept free for records, CDs and
// tapes (anchors.reserved), to be filled later.
import * as THREE from 'three';
import { makeInk } from './ink.js';
import { M, box, cyl, ROOM } from './room.js';
import { BOOKS } from './books-data.js';
import { SpineAtlas, bookUV, rng, hashStr, loadSpineFonts } from './spines.js';

// Authors in shelf order: kept together, each in publication order.
const AUTHOR_ORDER = ['Calvino', 'Brancati', 'Jansson', 'Le Guin', 'Dick', 'Clarke', 'Atwood', 'Roth', 'Auster', 'DeLillo', 'Wallace', 'McCarthy', 'McEwan'];
const surname = (a = '') => AUTHOR_ORDER.find((s) => a.toLowerCase().includes(s.toLowerCase())) ?? a.split(' ').pop();

function normalise(raw, i) {
  const h = (raw.height_mm || 197), t = Math.max(6, raw.thickness_mm || 18);
  const seed = hashStr((raw.author || '') + '|' + (raw.title || '') + '|' + i);
  const r = rng(seed);
  return {
    ...raw, seed, h, t, d: raw.width_mm || Math.round(h * 0.64),
    binding: raw.binding || 'paperback',
    age: 0.2 + r() * 0.8, read: r(),
    key: surname(raw.author), year: raw.first_published || raw.year || 0,
  };
}

export function buildBookshelf(room) {
  const g = new THREE.Group(); room.add(g);
  const r = rng(1998);
  const z = ROOM.hz, W = 2.4, H = 2.12, D = 0.32, x0 = 0.15;
  const back = z - 0.005, front = z - D;
  const sh = 6, inner = (H - 0.08) / sh, board = 0.025, clear = inner - board;
  box(0.03, H, D, M.pine, x0 - W / 2, H / 2, z - D / 2, g);
  box(0.03, H, D, M.pine, x0 + W / 2, H / 2, z - D / 2, g);
  box(0.03, H, D, M.pine, x0, H / 2, z - D / 2, g);
  box(W, 0.012, H, M.pineX, x0, H / 2, back, g).rotation.x = Math.PI / 2;
  for (let i = 0; i <= sh; i++) box(W, board, D, M.pineX, x0, 0.04 + i * inner, z - D / 2, g);

  const mats = new Map();
  const mat = (c) => { if (!mats.has(c)) mats.set(c, makeInk({ color: c, wash: 0.72 })); return mats.get(c); };
  const anchors = { reserved: [] };

  // --- the books, sorted by author and year --------------------------------------------------
  const books = BOOKS.map(normalise).filter((b) => b.h < clear * 1000 - 8);
  const rank = (b) => { const k = AUTHOR_ORDER.indexOf(b.key); return k < 0 ? 99 : k; };
  books.sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key) || a.year - b.year || a.title.localeCompare(b.title));
  const leggimiBook = {
    title: 'LEGGIMI', author: '', publisher: '', seed: 777, h: 270, t: 45, d: 210, binding: 'hardcover', age: 0.1, read: 0,
    spine: {
      bg: '#E3B04B', text_color: '#3A2410', accent: '#7A1F1A', title_orientation: 'up',
      elements: [
        { type: 'band', from: 0.04, to: 0.1, color: '#7A1F1A' }, { type: 'line', y: 0.115, thickness_mm: 0.8, color: '#3A2410' },
        { type: 'line', y: 0.885, thickness_mm: 0.8, color: '#3A2410' }, { type: 'band', from: 0.9, to: 0.96, color: '#7A1F1A' },
        { type: 'text', text: 'LEGGIMI', y: 0.18, y_to: 0.82, size_mm: 22, font: 'didone', weight: 700, color: '#3A2410', orientation: 'up', letter_spacing: 0.12 },
        { type: 'dot', y: 0.07, size_mm: 3, color: '#E3B04B' }, { type: 'dot', y: 0.93, size_mm: 3, color: '#E3B04B' },
      ],
    },
  };
  const atlas = new SpineAtlas(books, 4096);
  const lgAtlas = new SpineAtlas([leggimiBook], 1024);
  loadSpineFonts().then(() => { atlas.draw(); lgAtlas.draw(); });

  // --- shelf plan, top row first, each row in the viewer's left-to-right order ----------------
  // The viewer's left bay is world +x. A part is books (flexible), an object, or space kept free.
  const PLAN = [
    [[['books']], [['books'], ['reserve', 'altro', 0.3]]],
    [[['globe', 0.55], ['books']], [['books']]],
    [[['hifi', 0.45], ['reserve', 'cd', 0.48], ['books']], [['books'], ['leggimi'], ['books']]],
    [[['books']], [['books']]],
    [[['reserve', 'cd', 0]], [['reserve', 'vhs', 0]]],
    [[['reserve', 'vinili', 0]], [['reserve', 'vinili', 0]]],
  ];
  const bayEdges = (bay) => { const lo = x0 - W / 2 + 0.015 + bay * (W / 2) + 0.004; return [lo, lo + W / 2 - 0.038]; };
  const rowY = (row) => 0.04 + row * inner + board / 2;

  // Work out how much room the books get, then spread them evenly so every run ends with a little air.
  const segs = [];
  PLAN.forEach((bays, k) => {
    const row = sh - 1 - k;
    bays.forEach((parts, vb) => {
      const bay = vb === 0 ? 1 : 0, [lo, hi] = bayEdges(bay);
      const fixed = parts.reduce((s, p) => s + (p[0] === 'books' ? 0 : p[0] === 'leggimi' ? 0.06 : p[0] === 'reserve' ? (p[2] || 0) : p[1]), 0);
      const flex = parts.filter((p) => p[0] === 'books').length;
      parts.forEach((p) => segs.push({ row, bay, lo, hi, p, cap: p[0] === 'books' ? (hi - lo - fixed) / flex : 0 }));
    });
  });
  const gapOf = (b) => 0.0007 + rng(b.seed)() * 0.0016;
  const totalW = books.reduce((s, b) => s + b.t / 1000 + gapOf(b), 0);
  const capW = segs.reduce((s, sg) => s + sg.cap, 0);
  const fillTo = Math.min(0.96, totalW / Math.max(capW, 0.01) + 0.02);
  let qi = 0;
  for (const sg of segs) {
    if (sg.p[0] !== 'books') continue;
    sg.books = []; let w = 0;
    const target = sg.cap * fillTo;
    while (qi < books.length) {
      const bw = books[qi].t / 1000 + gapOf(books[qi]);
      if (w + bw > sg.cap - 0.01 || (w + bw / 2 > target && sg.books.length)) break;
      sg.books.push(books[qi++]); w += bw;
    }
  }
  const leftover = books.slice(qi);

  // --- placing ------------------------------------------------------------------------------
  const placed = [];
  const spineZ = front + 0.012;
  const standBook = (b, xr, y, tilt = 0) => {
    // xr is the world x of the book's -x face (its right side, as the viewer sees it)
    const t = b.t / 1000, h = b.h / 1000, d = b.d / 1000;
    const geo = new THREE.BoxGeometry(t, h, d); bookUV(geo, b);
    const m = new THREE.Mesh(geo, atlas.mat);
    const jz = rng(b.seed ^ 77)() * 0.007;
    m.position.set(xr + t / 2, y + h / 2, spineZ + jz + d / 2);
    m.rotation.z = tilt;
    g.add(m); placed.push(m);
    return m;
  };
  const cursor = new Map(); // per row:bay, the world x the next part starts at (parts run towards -x)
  for (const sg of segs) {
    const id = sg.row + ':' + sg.bay;
    const xs = cursor.get(id) ?? sg.hi;
    const y = rowY(sg.row);
    const [kind, a, bw] = sg.p;
    if (kind === 'books') {
      let x = xs;
      const run = sg.books;
      const used = run.reduce((s, b) => s + b.t / 1000 + gapOf(b), 0);
      // where a run has room to spare, a few books lie flat in a stack (or two) among the standing ones
      let spare = sg.cap - used - 0.05;
      const stacks = new Map();
      const every = Math.max(6, Math.floor(run.length / 3));
      for (let k = 0, at = Math.floor(every * (0.4 + r() * 0.6)); k < 3 && spare > 0.17 && at < run.length - 2; k++) {
        const n = Math.min(4 + Math.floor(r() * 3), run.length - at);
        const sw = Math.max(...run.slice(at, at + n).map((b) => b.h)) / 1000 + 0.01 - run.slice(at, at + n).reduce((s, b) => s + b.t / 1000, 0);
        if (sw > spare) break;
        stacks.set(at, n); spare -= sw;
        at += n + every;
      }
      let lastStanding = null, lastBook = null;
      for (let i = 0; i < run.length; i++) {
        if (stacks.has(i)) {
          const pile = run.slice(i, i + stacks.get(i)), wmax = Math.max(...pile.map((b) => b.h)) / 1000;
          let yy = y; x -= 0.004;
          for (const b of pile) {
            const m = standBook(b, 0, 0), t = b.t / 1000;
            m.rotation.z = (b.spine?.title_orientation === 'down' ? -1 : 1) * Math.PI / 2 + (r() - 0.5) * 0.04;
            m.position.x = x - wmax / 2 + (r() - 0.5) * 0.012; m.position.y = yy + t / 2; yy += t;
          }
          x -= wmax + 0.006; i += pile.length - 1; lastStanding = null;
          continue;
        }
        const b = run[i];
        x -= b.t / 1000; lastStanding = standBook(b, x, y, (r() - 0.5) * 0.006); lastBook = b; x -= gapOf(b);
      }
      const end = xs - sg.cap;
      if (x - end > 0.06 && run.length) {
        if (!lastStanding || r() < 0.55) {
          // a metal bookend holds the run up
          box(0.0025, 0.15, 0.13, M.darkgrey, x - 0.0015, y + 0.075, spineZ + 0.075, g);
          box(0.12, 0.0015, 0.13, M.darkgrey, x + 0.06, y + 0.001, spineZ + 0.075, g);
        } else {
          // or the last book leans on its neighbour
          const last = lastStanding, b = lastBook;
          const t = b.t / 1000, h = b.h / 1000, ang = 0.1 + r() * 0.16;
          const edge = last.position.x + t / 2 + gapOf(b);
          last.rotation.z = -ang;
          last.position.x = edge - (t / 2 * Math.cos(ang) + h / 2 * Math.sin(ang));
          last.position.y = y + t / 2 * Math.sin(ang) + h / 2 * Math.cos(ang);
        }
      }
      cursor.set(id, end);
    } else if (kind === 'reserve') {
      const w = bw || xs - sg.lo;
      anchors.reserved.push({ kind: a, x0: xs - w, x1: xs, y, height: clear, z0: front + 0.01, z1: back - 0.01 });
      cursor.set(id, xs - w);
    } else if (kind === 'globe') {
      buildGlobe(xs - a, y); cursor.set(id, xs - a);
    } else if (kind === 'hifi') {
      buildHifi(xs - a, y); cursor.set(id, xs - a);
    } else if (kind === 'leggimi') {
      const t = 0.045, h = 0.27, d = 0.21;
      const geo = new THREE.BoxGeometry(t, h, d); bookUV(geo, leggimiBook);
      const glowMat = makeInk({ color: '#ffffff', map: lgAtlas.tex, emissiveMap: lgAtlas.tex, emissive: 0.8, emissiveColor: '#FFD27A', wash: 0.88, hatch: 0.4 });
      const lx = xs - 0.0075 - t / 2;
      const b = new THREE.Mesh(geo, glowMat); b.position.set(lx, y + h / 2, spineZ + d / 2); b.castShadow = true; g.add(b);
      anchors.leggimi = b; anchors.leggimiRest = b.position.clone();
      const light = new THREE.PointLight('#FFD27A', 0.25, 0.8, 2); light.position.set(lx, y + 0.2, front - 0.05); g.add(light);
      anchors.leggimiLight = light;
      cursor.set(id, xs - 0.06);
    }
  }
  // anything that didn't fit lies flat on top of the standing rows
  for (const b of leftover) {
    const sg = segs.find((s) => s.p[0] === 'books' && s.books?.length && !s.topFull);
    if (!sg) break;
    const tallest = Math.max(...sg.books.map((k) => k.h)) / 1000;
    sg.topY = sg.topY ?? rowY(sg.row) + tallest + 0.001;
    const h = b.h / 1000, t = b.t / 1000;
    if (sg.topY + t > rowY(sg.row) + clear - 0.01) { sg.topFull = true; continue; }
    const m = standBook(b, 0, 0); m.rotation.z = Math.PI / 2;
    m.position.set(sg.hi - 0.02 - h / 2 - r() * 0.03, sg.topY + t / 2, m.position.z);
    sg.topY += t;
  }

  function buildGlobe(xl, y) {
    // tennis trophy + globe
    const tx = xl + 0.43;
    box(0.08, 0.04, 0.08, mat('#2B2A2E'), tx, y + 0.02, front + 0.16, g);
    cyl(0.012, 0.02, 0.08, M.brass, tx, y + 0.08, front + 0.16, g);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.12, 20, 1, true), M.brass);
    cup.position.set(tx, y + 0.18, front + 0.16); cup.castShadow = true; g.add(cup);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16, Math.PI), M.brass); h.position.set(tx + s * 0.07, y + 0.18, front + 0.16); h.rotation.z = s * -Math.PI / 2; g.add(h); }
    const gx = xl + 0.17;
    cyl(0.05, 0.06, 0.02, M.black, gx, y + 0.01, front + 0.16, g);
    cyl(0.006, 0.006, 0.06, M.brass, gx, y + 0.05, front + 0.16, g);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 18), makeInk({ color: '#7FA8C9', wash: 0.7 }));
    globe.position.set(gx, y + 0.19, front + 0.16); globe.rotation.z = 0.41; globe.castShadow = true; g.add(globe);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.004, 6, 40, Math.PI * 1.3), M.brass);
    ring.position.copy(globe.position); ring.rotation.set(0, Math.PI / 2, 0.41); g.add(ring);
    anchors.globe = globe;
  }
  function buildHifi(xl, y) {
    const hx = xl + 0.225;
    box(0.11, 0.2, 0.2, M.darkgrey, hx - 0.17, y + 0.1, front + 0.13, g);
    box(0.11, 0.2, 0.2, M.darkgrey, hx + 0.17, y + 0.1, front + 0.13, g);
    for (const s of [-1, 1]) { const c = cyl(0.035, 0.035, 0.005, M.black, hx + s * 0.17, y + 0.12, front + 0.03, g, 20); c.rotation.x = Math.PI / 2; }
    box(0.21, 0.07, 0.22, M.grey, hx, y + 0.035, front + 0.14, g);
    box(0.21, 0.06, 0.22, M.grey, hx, y + 0.1, front + 0.14, g);
    box(0.21, 0.06, 0.22, M.darkgrey, hx, y + 0.162, front + 0.14, g);
    const disp = box(0.09, 0.02, 0.002, makeInk({ color: '#5CF2FF', wash: 0.8, emissive: 0.9 }), hx - 0.04, y + 0.1, front + 0.029, g);
    anchors.hifi = new THREE.Vector3(hx, y + 0.12, front);
    anchors.hifiDisplay = disp;
  }

  // every book shares the atlas material, so draw them all in one go
  const pos = [], nrm = [], uvs = [];
  for (const m of placed) {
    m.updateMatrix();
    const geo = m.geometry.toNonIndexed().applyMatrix4(m.matrix);
    pos.push(...geo.attributes.position.array); nrm.push(...geo.attributes.normal.array); uvs.push(...geo.attributes.uv.array);
    g.remove(m); m.geometry.dispose();
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  all.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  all.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const mesh = new THREE.Mesh(all, atlas.mat); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  anchors.bookCount = placed.length;
  return anchors;
}
