// Wall C (south): the bookshelf (design F5) — books, VHS, CDs, comics, encyclopedias, board games,
// a tennis trophy, a globe, the mini hi-fi, and one glowing book, LEGGIMI, that pulls out.
import * as THREE from 'three';
import { makeInk } from './ink.js';
import { M, box, cyl, ROOM } from './room.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TITLES = ['Il Gattopardo', 'Le città invisibili', 'Lessico famigliare', 'Il barone rampante', 'Cuore', 'Pinocchio', 'Diario minimo', 'La luna e i falò',
  'Il deserto dei Tartari', 'Marcovaldo', 'La storia', 'Il giardino dei Finzi-Contini', 'Novecento', 'Va\' dove ti porta il cuore', 'Seta', 'Oceano mare',
  'Il fu Mattia Pascal', 'I Malavoglia', 'Ricette di casa', 'Atlante stradale', 'Guida dei funghi', 'Viaggio in Italia', 'Poesie', 'Racconti', 'Il Milione',
  'Storia d\'Italia', 'Il piccolo principe', 'Sostiene Pereira', 'Uno, nessuno e centomila', 'Le avventure di Tom Sawyer', 'Dizionario', 'Cucina regionale'];
const TAPES = ['Mondiali 90', 'Fantozzi', 'Natale 93', 'Zia Pina sposa', 'NON CANCELLARE', 'Superquark', 'Vacanze 95', 'Cartoni', 'Sanremo 94', 'Film sabato'];
// One canvas holds every spine on the shelf; each book gets its own cell with bands, a label and a title.
const CELL_W = 32, CELL_H = 224, ATLAS_W = 2048, ATLAS_H = 1024;
class SpineAtlas {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = ATLAS_W; this.canvas.height = ATLAS_H;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = makeInk({ color: '#ffffff', map: this.tex, wash: 0.74 });
    this.cells = []; this.n = 0;
    document.fonts?.ready.then(() => this.redraw());
  }
  add(colour, kind, r) {
    const i = this.n++ % ((ATLAS_W / CELL_W) * (ATLAS_H / CELL_H));
    const cell = { i, colour, kind, seed: Math.floor(r() * 1e9) };
    this.cells[i] = cell; this.draw(cell);
    const cx = (i % (ATLAS_W / CELL_W)) * CELL_W, cy = Math.floor(i / (ATLAS_W / CELL_W)) * CELL_H;
    return { u0: (cx + 4) / ATLAS_W, u1: (cx + CELL_W) / ATLAS_W, v0: 1 - (cy + CELL_H) / ATLAS_H, v1: 1 - cy / ATLAS_H, plain: [(cx + 1.5) / ATLAS_W, 1 - (cy + CELL_H / 2) / ATLAS_H] };
  }
  redraw() { for (const c of this.cells) if (c) this.draw(c); this.tex.needsUpdate = true; }
  draw({ i, colour, kind, seed }) {
    const r = rng(seed), x = this.canvas.getContext('2d');
    const cx = (i % (ATLAS_W / CELL_W)) * CELL_W, cy = Math.floor(i / (ATLAS_W / CELL_W)) * CELL_H;
    const w = CELL_W - 4, h = CELL_H, x0 = cx + 4;
    x.save();
    x.fillStyle = colour; x.fillRect(cx, cy, CELL_W, CELL_H);
    x.beginPath(); x.rect(x0, cy, w, h); x.clip();
    const light = ['#ECE5D6', '#F4F0E6', '#C9D8E6', '#E58C8A', '#C9A44C', '#7FA8C9', '#D98A6A'].includes(colour);
    const ink = light ? '#2A2420' : '#F1E6CF', gold = '#D8B45A';
    const vtext = (t, y, size, col, font = 'Courier Prime') => {
      x.save(); x.translate(x0 + w / 2, cy + y); x.rotate(-Math.PI / 2);
      x.fillStyle = col; x.font = `700 ${size}px "${font}", serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(t, 0, 0, h * 0.62); x.restore();
    };
    if (kind === 'encyclopedia') {
      x.fillStyle = '#1A1714'; x.fillRect(x0, cy + 30, w, 46);
      for (const y of [18, 24, 86, 92, 196, 202]) { x.fillStyle = gold; x.fillRect(x0, cy + y, w, 2); }
      x.fillStyle = gold; x.font = '700 11px "Courier Prime", serif'; x.textAlign = 'center';
      x.fillText('ENC.', x0 + w / 2, cy + 48); x.font = '700 14px "Courier Prime", serif'; x.fillText(String(1 + (i % 14)), x0 + w / 2, cy + 66);
    } else if (kind === 'vhs') {
      x.fillStyle = light ? '#E8E2D4' : '#F4F0E6'; x.fillRect(x0 + 3, cy + 30, w - 6, 160);
      vtext(TAPES[Math.floor(r() * TAPES.length)], 110, 20, '#2F4E8A', 'Caveat');
      x.fillStyle = light ? '#B6402A' : '#2B2A2E'; x.fillRect(x0, cy + 200, w, 10);
    } else if (kind === 'cd') {
      for (let k = 0; k < 3; k++) { x.fillStyle = r() < 0.5 ? '#1A1714' : '#ffffff'; x.globalAlpha = 0.5; x.fillRect(x0, cy + 20 + r() * 180, w, 2 + r() * 10); }
      x.globalAlpha = 1; vtext(TITLES[Math.floor(r() * TITLES.length)].toUpperCase(), 110, 13, ink, 'IBM Plex Sans');
    } else {
      const style = Math.floor(r() * 4);
      if (style === 0) { for (const y of [14, 20, h - 22, h - 16]) { x.fillStyle = gold; x.fillRect(x0, cy + y, w, 2); } vtext(TITLES[Math.floor(r() * TITLES.length)], h / 2, 15, gold); }
      else if (style === 1) { x.fillStyle = '#F1E6CF'; x.fillRect(x0 + 3, cy + 40, w - 6, 120); x.strokeStyle = '#2A2420'; x.strokeRect(x0 + 4, cy + 41, w - 8, 118); vtext(TITLES[Math.floor(r() * TITLES.length)], 100, 14, '#2A2420'); }
      else if (style === 2) { x.fillStyle = '#1A1714'; x.globalAlpha = 0.25; x.fillRect(x0, cy, w, 34); x.fillRect(x0, cy + h - 34, w, 34); x.globalAlpha = 1; vtext(TITLES[Math.floor(r() * TITLES.length)].toUpperCase(), h / 2, 13, ink, 'IBM Plex Sans'); }
      else { vtext(TITLES[Math.floor(r() * TITLES.length)], h / 2 - 16, 15, ink, 'Bricolage Grotesque'); x.fillStyle = ink; x.beginPath(); x.arc(x0 + w / 2, cy + h - 22, 5, 0, 7); x.fill(); }
      // a little wear along the edges
      x.fillStyle = '#000'; x.globalAlpha = 0.12; x.fillRect(x0, cy, 2, h); x.fillRect(x0 + w - 2, cy, 2, h); x.globalAlpha = 1;
    }
    x.restore();
  }
}
/** Point a box's spine face (the one facing the room, -z) at an atlas cell, and every other face at its plain colour. */
function spineUV(mesh, c) {
  const uv = mesh.geometry.attributes.uv;
  for (let v = 0; v < uv.count; v++) {
    if (v >= 20) uv.setXY(v, c.u0 + (1 - uv.getX(v)) * (c.u1 - c.u0), c.v0 + uv.getY(v) * (c.v1 - c.v0));
    else uv.setXY(v, c.plain[0], c.plain[1]);
  }
  uv.needsUpdate = true;
}
const SPINES = ['#B6402A', '#2F4F6E', '#3E6B4A', '#C9A44C', '#8A2E2A', '#ECE5D6', '#5A4A6A', '#D98A6A', '#1F2A44', '#A86A3A', '#E58C8A', '#7FA8C9'];

export function buildBookshelf(room) {
  const g = new THREE.Group(); room.add(g);
  const r = rng(1998);
  const z = ROOM.hz, W = 2.4, H = 2.12, D = 0.32, x0 = 0.15;
  const back = z - 0.005, front = z - D;
  const sh = 6, inner = (H - 0.08) / sh;
  box(0.03, H, D, M.pine, x0 - W / 2, H / 2, z - D / 2, g);
  box(0.03, H, D, M.pine, x0 + W / 2, H / 2, z - D / 2, g);
  box(0.03, H, D, M.pine, x0, H / 2, z - D / 2, g);
  box(W, 0.012, H, M.pineX, x0, H / 2, back, g).rotation.x = Math.PI / 2;
  for (let i = 0; i <= sh; i++) box(W, 0.025, D, M.pineX, x0, 0.04 + i * inner, z - D / 2, g);

  const mats = new Map();
  const mat = (c) => { if (!mats.has(c)) mats.set(c, makeInk({ color: c, wash: 0.72 })); return mats.get(c); };
  const pick = () => SPINES[Math.floor(r() * SPINES.length)];
  const atlas = new SpineAtlas();
  const anchors = {};

  // each bay (2 per row) gets a "theme"
  const bayW = W / 2 - 0.045;
  const fill = (row, bay, kind) => {
    const y = 0.04 + row * inner + 0.0125;
    let x = x0 - W / 2 + 0.03 + bay * (W / 2) + 0.005;
    const end = x + bayW;
    const put = (w, h, d, c, lean = 0, spine = 'book') => {
      const b = box(w, h, d, atlas.mat, x + w / 2, y + h / 2, front + d / 2 + 0.02 + (D - 0.04 - d), g);
      spineUV(b, atlas.add(c, spine, r));
      if (lean) { b.rotation.z = lean; b.position.x += Math.sin(lean) * h / 2; }
      x += w + 0.002;
      return b;
    };
    if (kind === 'books') {
      while (x < end - 0.06) {
        const w = 0.022 + r() * 0.03, h = Math.min(inner - 0.04, 0.18 + r() * 0.12);
        put(w, h, 0.17 + r() * 0.06, pick());
        if (r() < 0.06) x += 0.05; // a gap
      }
      put(0.03, Math.min(inner - 0.04, 0.24), 0.2, pick(), -0.22);
    } else if (kind === 'encyclopedia') {
      for (let i = 0; i < 14 && x < end - 0.05; i++) {
        put(0.045, 0.27, 0.22, '#8A2E2A', 0, 'encyclopedia');
      }
    } else if (kind === 'vhs') {
      while (x < end - 0.03) put(0.027, 0.19, 0.105, r() < 0.3 ? '#F4F0E6' : '#2B2A2E', 0, 'vhs');
    } else if (kind === 'cds') {
      while (x < end - 0.02) put(0.011, 0.125, 0.142, r() < 0.5 ? '#C9D8E6' : pick(), 0, 'cd');
    } else if (kind === 'comics') {
      // stacks of thin comics lying flat
      for (let s = 0; s < 3; s++) {
        let yy = y;
        for (let i = 0; i < 12; i++) { const c = box(0.17, 0.006, 0.25, mat(pick()), x + 0.09 + (r() - 0.5) * 0.01, yy + 0.003, front + 0.16, g); c.rotation.y = (r() - 0.5) * 0.08; yy += 0.0065; }
        x += 0.2;
      }
      fillBooks();
    } else if (kind === 'games') {
      let yy = y;
      for (const [w, h, d, c] of [[0.5, 0.07, 0.27, '#C9A44C'], [0.46, 0.06, 0.26, '#2F4F6E'], [0.42, 0.08, 0.25, '#B6402A'], [0.38, 0.05, 0.25, '#3E6B4A']]) {
        box(w, h, d, mat(c), x + w / 2 + (r() - 0.5) * 0.02, yy + h / 2, front + d / 2 + 0.03, g); yy += h;
      }
      x += 0.55; fillBooks();
    } else if (kind === 'trophy') {
      // tennis trophy + globe
      const tx = x + 0.12;
      box(0.08, 0.04, 0.08, mat('#2B2A2E'), tx, y + 0.02, front + 0.16, g);
      cyl(0.012, 0.02, 0.08, M.brass, tx, y + 0.08, front + 0.16, g);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.12, 20, 1, true), M.brass);
      cup.position.set(tx, y + 0.18, front + 0.16); cup.castShadow = true; g.add(cup);
      for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16, Math.PI), M.brass); h.position.set(tx + s * 0.07, y + 0.18, front + 0.16); h.rotation.z = s * -Math.PI / 2; g.add(h); }
      const gx = x + 0.38;
      cyl(0.05, 0.06, 0.02, M.black, gx, y + 0.01, front + 0.16, g);
      cyl(0.006, 0.006, 0.06, M.brass, gx, y + 0.05, front + 0.16, g);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 18), makeInk({ color: '#7FA8C9', wash: 0.7 }));
      globe.position.set(gx, y + 0.19, front + 0.16); globe.rotation.z = 0.41; globe.castShadow = true; g.add(globe);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.004, 6, 40, Math.PI * 1.3), M.brass);
      ring.position.copy(globe.position); ring.rotation.set(0, Math.PI / 2, 0.41); g.add(ring);
      anchors.globe = globe;
      x += 0.55; fillBooks();
    } else if (kind === 'hifi') {
      const hx = x + 0.2;
      box(0.11, 0.2, 0.2, M.darkgrey, hx - 0.17, y + 0.1, front + 0.13, g);
      box(0.11, 0.2, 0.2, M.darkgrey, hx + 0.17, y + 0.1, front + 0.13, g);
      for (const s of [-1, 1]) { const c = cyl(0.035, 0.035, 0.005, M.black, hx + s * 0.17, y + 0.12, front + 0.03, g, 20); c.rotation.x = Math.PI / 2; }
      box(0.21, 0.07, 0.22, M.grey, hx, y + 0.035, front + 0.14, g);
      box(0.21, 0.06, 0.22, M.grey, hx, y + 0.1, front + 0.14, g);
      box(0.21, 0.06, 0.22, M.darkgrey, hx, y + 0.162, front + 0.14, g);
      const disp = box(0.09, 0.02, 0.002, makeInk({ color: '#5CF2FF', wash: 0.8, emissive: 0.9 }), hx - 0.04, y + 0.1, front + 0.029, g);
      anchors.hifi = new THREE.Vector3(hx, y + 0.12, front);
      anchors.hifiDisplay = disp;
      x += 0.45; fillBooks();
    } else if (kind === 'leggimi') {
      fillBooks(0.35);
      const lx = x + 0.02;
      const glowMat = makeInk({ color: '#F2C14E', wash: 0.75, emissive: 0.8, emissiveColor: '#FFD27A' });
      const b = box(0.045, 0.27, 0.21, glowMat, lx + 0.0225, y + 0.135, front + 0.02 + 0.105, g);
      anchors.leggimi = b; anchors.leggimiRest = b.position.clone();
      const light = new THREE.PointLight('#FFD27A', 0.25, 0.8, 2); light.position.set(lx, y + 0.2, front - 0.05); g.add(light);
      anchors.leggimiLight = light;
      x += 0.05;
      fillBooks();
    }
    function fillBooks(limit) {
      const stop = limit ? Math.min(end, x + limit) : end;
      while (x < stop - 0.06) put(0.022 + r() * 0.03, Math.min(inner - 0.04, 0.18 + r() * 0.12), 0.17 + r() * 0.06, pick());
    }
  };
  const plan = [
    ['vhs', 'games'], ['books', 'cds'], ['encyclopedia', 'books'], ['leggimi', 'hifi'], ['books', 'trophy'], ['comics', 'books'],
  ];
  plan.forEach((row, i) => row.forEach((k, b) => fill(i, b, k)));
  // every spine shares the atlas material, so draw them all in one go
  const spines = g.children.filter((m) => m.isMesh && m.material === atlas.mat);
  const pos = [], nrm = [], uvs = [];
  for (const m of spines) {
    m.updateMatrix();
    const geo = m.geometry.toNonIndexed().applyMatrix4(m.matrix);
    pos.push(...geo.attributes.position.array); nrm.push(...geo.attributes.normal.array); uvs.push(...geo.attributes.uv.array);
    g.remove(m); m.geometry.dispose();
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  all.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  all.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const books = new THREE.Mesh(all, atlas.mat); books.castShadow = true; books.receiveShadow = true; g.add(books);
  return anchors;
}
