// Wall C (south): the bookshelf (design F5) — books, VHS, CDs, comics, encyclopedias, board games,
// a tennis trophy, a globe, the mini hi-fi, and one glowing book, LEGGIMI, that pulls out.
import * as THREE from 'three';
import { makeInk } from './ink.js';
import { M, box, cyl, ROOM } from './room.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
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
  const anchors = {};

  // each bay (2 per row) gets a "theme"
  const bayW = W / 2 - 0.045;
  const fill = (row, bay, kind) => {
    const y = 0.04 + row * inner + 0.0125;
    let x = x0 - W / 2 + 0.03 + bay * (W / 2) + 0.005;
    const end = x + bayW;
    const put = (w, h, d, c, lean = 0) => {
      const b = box(w, h, d, mat(c), x + w / 2, y + h / 2, front + d / 2 + 0.02 + (D - 0.04 - d), g);
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
        const b = put(0.045, 0.27, 0.22, '#8A2E2A');
        box(0.03, 0.008, 0.001, M.brass, 0, 0.08, -(0.22 / 2) - 0.0005, b).rotation.y = 0;
      }
    } else if (kind === 'vhs') {
      while (x < end - 0.03) { const b = put(0.027, 0.19, 0.105, r() < 0.3 ? '#F4F0E6' : '#2B2A2E'); }
    } else if (kind === 'cds') {
      while (x < end - 0.02) put(0.011, 0.125, 0.142, r() < 0.5 ? '#C9D8E6' : pick());
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
  return anchors;
}
