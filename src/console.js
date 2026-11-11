// The grey console under the TV: the original "fat" PlayStation of 1994–95 (SCPH-1000 / 1002),
// modelled on Evan Amos's reference photos (wedding-site-shots/ps1/refs). Real size, 270 × 188 × 60 mm.
//
// The profiles' bevels grow them outwards, so their points sit a bevel inside the real outline.
// Built in its own frame, x = width (left to right seen from the front), y up, z towards the viewer;
// the caller turns it to face the room. The body rises to a deck at 50 mm that carries the round disc
// lid, RESET and POWER on the left and OPEN at the front right; two panels stand 10 mm higher, a short
// one at the back left and a long one down the right. The front edge slopes down (the green LED is on
// it, left), and in the middle the front block juts out with the two controller ports and the memory
// card slots. Both flanks are ribbed with vents.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { box, cyl, profile } from './room.js';
import { merge } from './geo.js';

const GREY = '#ADACA8', LID = '#A6A5A1', SHADE = '#5E5C58';
const W = 0.27, D = 0.188, HW = W / 2, HD = D / 2;
const COL = 0.072; // half width of the middle, where the lid is

export function buildConsole() {
  const ps = new THREE.Group();
  const body = makeInk({ color: GREY, wash: 0.6 });
  const dark = makeInk({ color: '#2E2D30', wash: 0.85 });
  const wing = HW - COL - 0.004;

  // the body up to the deck, 50 mm, its front edge sloping down (the power LED sits on the slope)
  ps.add(profile([[-HD + 0.004, 0.004], [0.068, 0.004], [0.07, 0.03], [0.052, 0.046], [-HD + 0.004, 0.046]], W, body, 0.004));
  // two raised panels at 60 mm: a short one at the back left, a long one down the right
  const bl = profile([[-HD + 0.003, 0.044], [-0.042, 0.044], [-0.05, 0.057], [-HD + 0.003, 0.057]], wing, body, 0.003);
  bl.position.x = -HW + wing / 2; ps.add(bl);
  const br = profile([[-HD + 0.003, 0.044], [0.028, 0.044], [0.016, 0.057], [-HD + 0.003, 0.057]], wing, body, 0.003);
  br.position.x = HW - wing / 2; ps.add(br);
  // the front block under the lid: controller ports below, memory card slots above
  const fb = profile([[0.05, 0.003], [HD - 0.003, 0.003], [HD - 0.003, 0.031], [HD - 0.007, 0.034], [0.05, 0.034]], 0.13, body, 0.003);
  ps.add(fb);

  // the disc lid, with its SONY / PlayStation top, and the hinge at the back
  const lidTop = makeInk({ color: '#ffffff', wash: 0.6, map: lidTexture() });
  const lidSide = makeInk({ color: LID, wash: 0.6 });
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.067, 0.005, 64), [lidSide, lidTop, lidSide]);
  lid.rotation.y = Math.PI / 2; // the cap maps u along z and v along x: turn it so the canvas's top is the back
  lid.position.set(0, 0.0525, -0.012); lid.castShadow = lid.receiveShadow = true; ps.add(lid);
  box(0.05, 0.003, 0.006, makeInk({ color: LID, wash: 0.6 }), 0, 0.0515, -0.083, ps);

  // buttons: RESET small at the back, POWER big in front of it, OPEN at the front right
  const button = (r, h, label, ink, x, y, z) => {
    const top = makeInk({ color: '#ffffff', wash: 0.6, map: buttonTexture(label, ink) });
    const rim = makeInk({ color: LID, wash: 0.6 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, h, 32), [rim, top, rim]);
    m.rotation.y = Math.PI / 2; m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; ps.add(m);
    cyl(r + 0.0025, r + 0.0025, 0.001, makeInk({ color: SHADE, wash: 0.8 }), x, y + 0.0004, z, ps, 32); // the gap round it
    return m;
  };
  button(0.0085, 0.003, 'RESET', '#55545A', -0.098, 0.05, -0.022);
  button(0.0175, 0.003, 'POWER', '#3E9C92', -0.104, 0.05, 0.022);
  button(0.0165, 0.003, 'OPEN', '#3F78C4', 0.104, 0.05, 0.053);

  // the power LED on the front slope, left
  const led = box(0.002, 0.001, 0.0055, makeInk({ color: '#3FCF5A', emissive: 1.2 }), -0.124, 0.0427, 0.063, ps);
  led.rotation.x = Math.atan2(16, 22);

  // the front block: "1" and "2" on its top, two memory card slots, two controller ports
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.124, 0.03), makeInk({ color: '#ffffff', wash: 0.6, map: portTopTexture() }));
  top.rotation.x = -Math.PI / 2; top.position.set(0, 0.0372, 0.073); ps.add(top);
  const parts = [];
  const add = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push([g, hex]); };
  for (const px of [-0.032, 0.032]) {
    add(0.05, 0.0055, 0.002, px, 0.029, HD, '#2A292C'); // memory card slot
    add(0.054, 0.0012, 0.0016, px, 0.0243, HD + 0.0002, SHADE); // its lip
    add(0.048, 0.0135, 0.002, px, 0.0135, HD, '#3A393C'); // controller port, a dark surround
    add(0.04, 0.009, 0.0026, px, 0.0135, HD, '#9E9B94'); // the grey connector face
    for (const k of [-1, 0, 1]) add(0.0095, 0.0032, 0.003, px + k * 0.0125, 0.0135, HD + 0.0002, '#2A292C'); // its three pin groups
  }
  // vent ribs down both flanks, feet underneath
  for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) add(0.002, 0.034, 0.0028, sx * (HW + 0.0005), 0.029, -HD + 0.012 + i * 0.0062, SHADE);
  for (const [fx, fz] of [[-0.11, -0.07], [0.11, -0.07], [-0.11, 0.06], [0.11, 0.06]]) add(0.016, 0.004, 0.016, fx, 0.002, fz, '#2E2D30');
  const detail = new THREE.Mesh(merge(parts), makeInk({ color: '#ffffff', vertexColors: true, wash: 0.85 }));
  detail.castShadow = detail.receiveShadow = true; ps.add(detail);

  // the pad's plug in port 1 (its cable is drawn by the caller, from `plug`)
  const plug = new THREE.Group(); plug.position.set(-0.032, 0.0135, HD); ps.add(plug);
  box(0.038, 0.008, 0.014, body, 0, 0, 0.006, plug);
  box(0.03, 0.007, 0.012, body, 0, -0.0005, 0.018, plug);
  cyl(0.0035, 0.004, 0.012, dark, 0, -0.0005, 0.028, plug, 10).rotation.x = Math.PI / 2;

  return { group: ps, led, plugAt: new THREE.Vector3(-0.032, 0.0135, HD + 0.034) };
}

function canvas(w, h, bg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  return [c, x];
}
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// The lid's top as the cylinder cap maps it: u along x, v along -z (the back of the lid is up in the canvas).
function lidTexture() {
  const S = 512;
  const [c, x] = canvas(S, S, LID);
  x.translate(S / 2, S / 2);
  // a faint ring just inside the edge
  x.strokeStyle = 'rgba(70,68,64,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, S / 2 - 10, 0, Math.PI * 2); x.stroke();
  // SONY near the back
  x.fillStyle = '#3C3B3E'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 30px "Times New Roman", Georgia, serif';
  drawSpaced(x, 'SONY', 0, -150, 5);
  // the PlayStation mark towards the front: a red P standing up, a yellow-green-blue S lying at its foot
  x.save(); x.translate(-6, 72);
  x.fillStyle = '#E3B21E'; x.beginPath(); x.moveTo(-30, 14); x.lineTo(2, 2); x.lineTo(2, 10); x.lineTo(-22, 20); x.closePath(); x.fill();
  x.fillStyle = '#3AA866'; x.beginPath(); x.moveTo(2, 2); x.lineTo(36, 14); x.lineTo(28, 20); x.lineTo(2, 10); x.closePath(); x.fill();
  x.fillStyle = '#3B6FC0'; x.beginPath(); x.moveTo(-22, 20); x.lineTo(2, 10); x.lineTo(28, 20); x.lineTo(2, 30); x.closePath(); x.fill();
  x.fillStyle = '#D8262E';
  x.beginPath(); x.moveTo(-6, 18); x.lineTo(-6, -40); x.lineTo(14, -34); x.quadraticCurveTo(34, -26, 26, -10); x.quadraticCurveTo(20, 2, 6, -4); x.lineTo(6, -20);
  x.quadraticCurveTo(14, -18, 14, -24); x.quadraticCurveTo(14, -30, 6, -30); x.lineTo(6, 22); x.closePath(); x.fill();
  x.restore();
  x.fillStyle = '#3C3B3E'; x.font = '600 25px "IBM Plex Sans", Arial, sans-serif';
  x.fillText('PlayStation', 0, 124);
  return tex(c);
}

function buttonTexture(label, ink) {
  const S = 128;
  const [c, x] = canvas(S, S, LID);
  x.strokeStyle = 'rgba(70,68,64,0.3)'; x.lineWidth = 3; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); x.stroke();
  x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `500 ${label === 'RESET' ? 26 : 20}px "IBM Plex Sans", Arial, sans-serif`;
  drawSpaced(x, label, S / 2, S / 2 + (label === 'OPEN' ? 6 : 0), 2);
  return tex(c);
}

function portTopTexture() {
  const [c, x] = canvas(512, 124, GREY);
  x.fillStyle = '#3C3B3E'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 46px "IBM Plex Sans", Arial, sans-serif';
  x.fillText('1', 124, 52); x.fillText('2', 388, 52);
  x.font = '600 17px "IBM Plex Sans", Arial, sans-serif';
  drawSpaced(x, 'MEMORY CARD', 124, 104, 2); drawSpaced(x, 'MEMORY CARD', 388, 104, 2);
  return tex(c);
}

function drawSpaced(x, text, cx, cy, sp) {
  const w = [...text].map((ch) => x.measureText(ch).width), tot = w.reduce((a, b) => a + b, 0) + sp * (text.length - 1);
  const align = x.textAlign; x.textAlign = 'left';
  let px = cx - tot / 2;
  [...text].forEach((ch, i) => { x.fillText(ch, px, cy); px += w[i] + sp; });
  x.textAlign = align;
}
