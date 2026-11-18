// The Pagine Gialle on the phone table: the 1996/97 "Brescia e provincia" SEAT edition, 21 × 28 cm and 4.5 cm
// thick, lying cover up with its spine towards the phone. Tap it and its cover swings up and open on page 37
// (Agriturismo), where Cascina Carretto is; main.js then opens that page full screen (overlays.pagineGialle).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { drawCover, drawSpine, drawPage, FONTS } from './paginegialle-art.js';

const fontsIn = () => (typeof document !== 'undefined' && document.fonts ? Promise.all(FONTS.map((f) => document.fonts.load(f, 'PAGINE'))) : Promise.resolve());
const canvasTex = (w, h, draw, rot = 0) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rot) { t.center.set(0.5, 0.5); t.rotation = rot; }
  // the first drawing may beat the fonts in: draw again once they're here
  fontsIn().then(() => { x.reset?.(); x.setTransform(1, 0, 0, 1, 0, 0); draw(x, w, h); t.needsUpdate = true; }, () => {});
  return t;
};
function pageEdges(x, w, h) {
  x.fillStyle = '#EBD77A'; x.fillRect(0, 0, w, h);
  let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < h; i += 2) { x.fillStyle = `rgba(90,70,20,${0.08 + 0.12 * r()})`; x.fillRect(0, i, w, 1); }
}

export function buildPagineGialle() {
  const W = 0.21, D = 0.28, T = 0.045, CT = 0.003; // across, along (top towards the wall, −x), thick, cover board
  const yellow = makeInk({ color: '#F6D21E', wash: 0.85 });
  const tex = (o) => makeInk({ color: '#ffffff', wash: 0.85, hatch: 0.5, ...o });
  const edges = tex({ map: canvasTex(64, 256, pageEdges) });
  // the page block; its top is page 37 (the cover lifts off it), its +z side the spine. Faces: +x, −x, +y, −y, +z, −z
  const page = tex({ map: canvasTex(768, 1024, (x, w, h) => drawPage(x, w, h), Math.PI / 2) });
  const spine = tex({ map: canvasTex(80, 1200, drawSpine, -Math.PI / 2) });
  const block = new THREE.Mesh(new THREE.BoxGeometry(D, T - CT, W), [edges, yellow, page, yellow, spine, edges]);
  block.position.y = (T - CT) / 2;
  // the front cover, hinged along the spine edge
  const hinge = new THREE.Group(); hinge.position.set(0, T - CT, W / 2);
  const inside = makeInk({ color: '#F4E07E', wash: 0.8 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(D, CT, W), [yellow, yellow, tex({ map: canvasTex(900, 1200, drawCover, Math.PI / 2) }), inside, yellow, yellow]);
  cover.position.set(0, CT / 2, -W / 2); hinge.add(cover);
  const g = new THREE.Group(); g.add(block, hinge);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const meshes = [block, cover];
  let open = 0, target = 0;
  return {
    group: g,
    isBook: (o) => meshes.includes(o),
    /** The page's corners in world space, for the camera to frame. */
    pagePoints() { g.updateWorldMatrix(true, false); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => g.localToWorld(new THREE.Vector3(a * D / 2, T, b * W / 2))); },
    setOpen(on) { target = on ? 1 : 0; },
    tick(dt) {
      open += (target - open) * Math.min(1, dt * 5);
      const e = open * open * (3 - 2 * open);
      hinge.rotation.x = e * THREE.MathUtils.degToRad(118); // up past upright; any further and it would land on the phone
    },
  };
}
