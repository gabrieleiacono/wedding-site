// LEGGIMI: the glowing book, lying on the desk (right of the typewriter, where the notebooks used to be).
// Gold cloth with oxblood bands, its title on the front cover, which faces up and reads the right way
// round from the chair, and on the spine, which faces the typewriter. Tap it and it lifts its head
// towards you, like a book propped up to be read; main.js then opens the LEGGIMI card.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { SpineAtlas, loadSpineFonts } from './spines.js';

const GOLD = '#E3B04B', OXBLOOD = '#7A1F1A', INKC = '#3A2410', PAGES = '#F1E6CC';

// Its spine, drawn by spines.js like every book on the shelf
export const LEGGIMI_BOOK = {
  title: 'LEGGIMI', author: '', publisher: '', seed: 777, h: 270, t: 45, d: 210, binding: 'hardcover', age: 0.1, read: 0,
  spine: {
    bg: GOLD, text_color: INKC, accent: OXBLOOD, title_orientation: 'up',
    elements: [
      { type: 'band', from: 0.04, to: 0.1, color: OXBLOOD }, { type: 'line', y: 0.115, thickness_mm: 0.8, color: INKC },
      { type: 'line', y: 0.885, thickness_mm: 0.8, color: INKC }, { type: 'band', from: 0.9, to: 0.96, color: OXBLOOD },
      { type: 'text', text: 'LEGGIMI', y: 0.18, y_to: 0.82, size_mm: 22, font: 'didone', weight: 700, color: INKC, orientation: 'up', letter_spacing: 0.12 },
      { type: 'dot', y: 0.07, size_mm: 3, color: GOLD }, { type: 'dot', y: 0.93, size_mm: 3, color: GOLD },
    ],
  },
};

// The front cover, in the spine's dress: bands at head and foot, ruled frame, the title in Bodoni
function drawCover(cv) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / 210; // px per mm
  x.fillStyle = GOLD; x.fillRect(0, 0, W, H);
  // a little cloth texture
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = i % 2 ? 'rgba(122,31,26,0.05)' : 'rgba(255,240,200,0.07)';
    x.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
  x.fillStyle = OXBLOOD;
  x.fillRect(0, 12 * s, W, 16 * s); x.fillRect(0, H - 28 * s, W, 16 * s);
  x.strokeStyle = INKC; x.lineWidth = 0.8 * s;
  x.strokeRect(18 * s, 38 * s, W - 36 * s, H - 76 * s);
  x.lineWidth = 0.4 * s;
  x.strokeRect(21 * s, 41 * s, W - 42 * s, H - 82 * s);
  for (const y of [20 * s, H - 20 * s]) { x.fillStyle = GOLD; x.beginPath(); x.arc(W / 2, y, 2.2 * s, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = INKC; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${26 * s}px "Bodoni Moda", "Didot", serif`;
  if ('letterSpacing' in x) x.letterSpacing = `${3 * s}px`;
  x.fillText('LEGGIMI', W / 2 + 1.5 * s, H * 0.44);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  // a small fleuron under the title
  x.font = `${12 * s}px "Bodoni Moda", serif`;
  x.fillStyle = OXBLOOD;
  x.fillText('❦', W / 2, H * 0.56);
}

/**
 * The book on the desk. top is the desk's surface; x, z its middle; yaw its turn on the desk.
 * Returns { mesh, at, light, tick(now, out) }: out runs 0 (lying) … 1 (propped up to read).
 */
export function buildLeggimi(room, { x = 0.45, top = 0.75, z = -1.45, yaw = -0.1 } = {}) {
  const W = LEGGIMI_BOOK.d / 1000, T = LEGGIMI_BOOK.t / 1000, L = LEGGIMI_BOOK.h / 1000;
  const glow = (o) => makeInk({ color: '#ffffff', emissive: 0.8, emissiveColor: '#FFD27A', wash: 0.88, hatch: 0.4, ...o });

  const atlas = new SpineAtlas([LEGGIMI_BOOK], 1024);
  const coverCv = document.createElement('canvas'); coverCv.width = 512; coverCv.height = Math.round(512 * L / W);
  const coverTex = new THREE.CanvasTexture(coverCv);
  coverTex.colorSpace = THREE.SRGBColorSpace; coverTex.anisotropy = 8;
  drawCover(coverCv);
  loadSpineFonts().then(() => { atlas.draw(); drawCover(coverCv); coverTex.needsUpdate = true; });

  // the box: x across the cover (spine at -x, towards the typewriter), y up, z from head (-z) to foot (+z)
  const geo = new THREE.BoxGeometry(W, T, L);
  const uv = geo.attributes.uv;
  for (let v = 0; v < uv.count; v++) {
    const f = Math.floor(v / 4), u0 = uv.getX(v), v0 = uv.getY(v);
    if (f === 1) { // -x: the spine, its foot (atlas bottom) at +z
      const [a, bb, c, d] = LEGGIMI_BOOK.uv.spine;
      uv.setXY(v, a + (1 - v0) * (c - a), bb + (1 - u0) * (d - bb));
    }
  }
  uv.needsUpdate = true;
  const spineMat = glow({ map: atlas.tex, emissiveMap: atlas.tex });
  const coverMat = glow({ map: coverTex, emissiveMap: coverTex });
  const pagesMat = makeInk({ color: PAGES, emissive: 0.25, emissiveColor: '#FFD27A', wash: 0.85, hatch: 0.5 });
  const backMat = makeInk({ color: GOLD, emissive: 0.3, emissiveColor: '#FFD27A', wash: 0.85, hatch: 0.5 });
  // +x fore-edge, -x spine, +y front cover, -y back cover, +z foot, -z head
  const mesh = new THREE.Mesh(geo, [pagesMat, spineMat, coverMat, backMat, pagesMat, pagesMat]);
  mesh.castShadow = true; mesh.receiveShadow = true;

  // it hinges on its foot, the edge nearest you, so propping it up lifts the head
  const base = new THREE.Group(); base.position.set(x, top, z); base.rotation.y = yaw; room.add(base);
  const hinge = new THREE.Group(); hinge.position.set(0, 0, L / 2); base.add(hinge);
  mesh.position.set(0, T / 2, -L / 2); hinge.add(mesh);

  const light = new THREE.PointLight('#FFD27A', 0.25, 0.8, 2); light.position.set(x, top + 0.22, z + 0.08); room.add(light);
  const at = new THREE.Vector3(x, top + T + 0.02, z + 0.07); // the hotspot below the title, not on it
  const glowing = [spineMat, coverMat];

  return {
    mesh, at, light,
    tick(now, out) {
      hinge.position.y = out * 0.03;
      hinge.rotation.x = out * 0.62;
      const p = Math.sin(now / 600);
      for (const m of glowing) m.emissiveIntensity = 0.45 + p * 0.2;
      pagesMat.emissiveIntensity = backMat.emissiveIntensity = 0.2 + p * 0.08;
      light.intensity = 0.2 + p * 0.08;
    },
  };
}
