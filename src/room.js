// The study (design F2): 4.2 × 3.6 m, ceiling 2.9 m. x = east, -z = north, y = up.
// Wall A (north): desk + window · B (east): TV · C (south): bookshelf · D (west): door, phone, calendar.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { STORIES } from './content.js';
import { buildSirio } from './phone.js';
import { buildLamp } from './lamp.js';

export const ROOM = { w: 4.2, d: 3.6, h: 2.9, hx: 2.1, hz: 1.8 };
export const WINDOW = { x0: -0.62, x1: 0.62, y0: 0.88, y1: 2.35 };
export const EYE = new THREE.Vector3(0, 1.15, -0.72);

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

export const M = {
  wall: makeInk({ color: '#E9C99A', wash: 0.6, spacing: 0.008 }),
  ceiling: makeInk({ color: '#F1DDB8', wash: 0.4, spacing: 0.01 }),
  floor: makeInk({ color: '#A86A3A', wash: 0.62, wood: 2 }),
  walnut: makeInk({ color: '#8A5530', wash: 0.68, wood: 1, grain: X }),
  walnutZ: makeInk({ color: '#8A5530', wash: 0.68, wood: 1, grain: Z }),
  walnutY: makeInk({ color: '#8A5530', wash: 0.68, wood: 1, grain: Y }),
  pine: makeInk({ color: '#B98048', wash: 0.6, wood: 1, grain: Y }),
  pineX: makeInk({ color: '#B98048', wash: 0.6, wood: 1, grain: X }),
  door: makeInk({ color: '#A8743E', wash: 0.6, wood: 1, grain: Y, grainScale: 1.4 }),
  frame: makeInk({ color: '#C9A06A', wash: 0.5, wood: 1, grain: Y }),
  black: makeInk({ color: '#2B2A2E', wash: 0.85 }),
  darkgrey: makeInk({ color: '#45444A', wash: 0.8 }),
  grey: makeInk({ color: '#B9B6AE', wash: 0.6 }),
  beige: makeInk({ color: '#D9D0BC', wash: 0.55 }),
  white: makeInk({ color: '#F4F0E6', wash: 0.3 }),
  brass: makeInk({ color: '#C9A44C', wash: 0.7 }),
  red: makeInk({ color: '#B6402A', wash: 0.7 }),
  albumRed: makeInk({ color: '#8A2E2A', wash: 0.75 }),
  blue: makeInk({ color: '#2F4F6E', wash: 0.7 }),
  green: makeInk({ color: '#3E6B4A', wash: 0.7 }),
  plant: makeInk({ color: '#4E7A3A', wash: 0.75 }),
  cork: makeInk({ color: '#B88A55', wash: 0.65 }),
  shutter: makeInk({ color: '#D8CDB8', wash: 0.5, spacing: 0.006 }),
  curtain: makeInk({ color: '#FBF4E6', wash: 0.2, transparent: true, opacity: 0.3, side: THREE.DoubleSide, emissive: 0.35, emissiveColor: '#FFE2C0' }),
  sirio: makeInk({ color: '#F2F0EA', wash: 0.3 }),
  sirioBlue: makeInk({ color: '#3D6FB6', wash: 0.75 }),
};

export function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, parent, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/** A rounded slab (rounded rectangle extruded with a bevel), lying flat, centred on its origin. */
export function slab(w, h, d, r, mat, bevel = 0.006) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.translate(0, -h / 2 + bevel, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/**
 * Extrude a side profile across the width. `pts` are [z, y] pairs (z forward, y up); the solid spans x ∈ [-w/2, w/2].
 */
export function profile(pts, w, mat, bevel = 0.004) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: w - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); g.translate(w / 2 - bevel, 0, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Rounded profile helper: a polygon with each corner rounded by r (quadratic). Returns Vector2 shape points. */
export function roundedShape(pts, r) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...pts[i]), a = new THREE.Vector2(...pts[(i + n - 1) % n]), b = new THREE.Vector2(...pts[(i + 1) % n]);
    const ra = Math.min(r, p.distanceTo(a) / 2), rb = Math.min(r, p.distanceTo(b) / 2);
    const p1 = p.clone().add(a.clone().sub(p).setLength(ra)), p2 = p.clone().add(b.clone().sub(p).setLength(rb));
    if (i === 0) s.moveTo(p1.x, p1.y); else s.lineTo(p1.x, p1.y);
    s.quadraticCurveTo(p.x, p.y, p2.x, p2.y);
  }
  s.closePath();
  return s;
}

/** Extrude a Shape (in x/y) by depth along z, centred on z. */
export function extrude(shape, depth, mat, bevel = 0.003, seg = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.0001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 10 });
  g.translate(0, 0, -depth / 2 + bevel);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);
  const { hx, hz, h } = ROOM;
  const T = 0.12; // wall thickness

  // floor + ceiling
  box(ROOM.w + 0.4, 0.05, ROOM.d + 0.4, M.floor, 0, -0.025, 0, room);
  box(ROOM.w + 0.4, 0.05, ROOM.d + 0.4, M.ceiling, 0, h + 0.025, 0, room);
  // east, south, west walls
  box(T, h, ROOM.d, M.wall, hx + T / 2, h / 2, 0, room);
  box(ROOM.w, h, T, M.wall, 0, h / 2, hz + T / 2, room);
  box(T, h, ROOM.d, M.wall, -hx - T / 2, h / 2, 0, room);
  // north wall with the window opening
  const W = WINDOW, nz = -hz - T / 2;
  box(W.x0 + hx, h, T, M.wall, (-hx + W.x0) / 2, h / 2, nz, room);
  box(hx - W.x1, h, T, M.wall, (W.x1 + hx) / 2, h / 2, nz, room);
  box(W.x1 - W.x0, W.y0, T, M.wall, 0, W.y0 / 2, nz, room);
  box(W.x1 - W.x0, h - W.y1, T, M.wall, 0, (W.y1 + h) / 2, nz, room);

  // skirting boards
  const sk = 0.08;
  box(ROOM.w, sk, 0.015, M.walnut, 0, sk / 2, -hz + 0.008, room);
  box(ROOM.w, sk, 0.015, M.walnut, 0, sk / 2, hz - 0.008, room);
  box(0.015, sk, ROOM.d, M.walnutZ, hx - 0.008, sk / 2, 0, room);
  box(0.015, sk, ROOM.d, M.walnutZ, -hx + 0.008, sk / 2, 0, room);

  // ceiling light: a simple glass dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
  dome.rotation.x = Math.PI; dome.position.set(0, h - 0.01, 0.1); room.add(dome);

  const anchors = {};
  buildWindowFrame(room, anchors);
  buildDesk(room, anchors);
  buildWestWall(room, anchors);
  return { room, anchors };
}

function buildWindowFrame(room, anchors) {
  const W = WINDOW, z = -ROOM.hz;
  const g = new THREE.Group(); room.add(g);
  const f = 0.06;
  box(W.x1 - W.x0 + 2 * f, f, 0.05, M.frame, 0, W.y1 + f / 2, z + 0.01, g);
  box(f, W.y1 - W.y0 + f, 0.05, M.frame, W.x0 - f / 2, (W.y0 + W.y1) / 2, z + 0.01, g);
  box(f, W.y1 - W.y0 + f, 0.05, M.frame, W.x1 + f / 2, (W.y0 + W.y1) / 2, z + 0.01, g);
  // marble-ish sill
  box(W.x1 - W.x0 + 0.24, 0.03, 0.2, M.white, 0, W.y0 - 0.015, z + 0.02, g);
  // casement frames (open inwards, pushed to the sides) — two thin frames with mullion
  const cw = (W.x1 - W.x0) / 2;
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(s < 0 ? W.x0 : W.x1, W.y0, z + 0.03);
    leaf.rotation.y = s * -1.25;
    const lx = s < 0 ? cw / 2 : -cw / 2;
    box(cw, 0.04, 0.04, M.frame, lx, 0.02, 0, leaf);
    box(cw, 0.04, 0.04, M.frame, lx, W.y1 - W.y0 - 0.02, 0, leaf);
    box(0.04, W.y1 - W.y0, 0.04, M.frame, s < 0 ? 0.02 : -0.02, (W.y1 - W.y0) / 2, 0, leaf);
    box(0.04, W.y1 - W.y0, 0.04, M.frame, s < 0 ? cw - 0.02 : -cw + 0.02, (W.y1 - W.y0) / 2, 0, leaf);
    box(cw, 0.03, 0.03, M.frame, lx, (W.y1 - W.y0) * 0.55, 0, leaf);
    g.add(leaf);
  }

  // tapparella: a roller shutter of slats, coming down from a box above the window
  box(W.x1 - W.x0 + 0.2, 0.26, 0.24, M.wall, 0, W.y1 + 0.13 + 0.06, z + 0.07, g);
  const shutter = new THREE.Group();
  const slats = [];
  const slatH = 0.045, n = Math.ceil((W.y1 - W.y0) / slatH) + 1;
  for (let i = 0; i < n; i++) {
    const s = box(W.x1 - W.x0 - 0.02, slatH * 0.9, 0.012, M.shutter, 0, 0, 0, shutter);
    s.castShadow = true;
    slats.push(s);
  }
  shutter.position.set(0, 0, z - 0.03);
  g.add(shutter);
  // the strap on the right of the window
  const strapBox = box(0.05, 0.12, 0.03, M.white, W.x1 + 0.16, 1.2, z + 0.02, g);
  const strap = box(0.022, 1.0, 0.004, M.beige, W.x1 + 0.16, 1.75, z + 0.008, g);
  anchors.shutter = { slats, shutter, slatH, strap, strapBox };
  anchors.strap = new THREE.Vector3(W.x1 + 0.16, 1.25, z + 0.04);

  // sheer curtains, gathered to each side
  const cg = new THREE.PlaneGeometry(0.55, 1.55, 40, 1);
  const pos = cg.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 38) * 0.025);
  cg.computeVertexNormals();
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(cg, M.curtain);
    c.position.set(s * (W.x1 - 0.05), (W.y0 + W.y1) / 2 + 0.05, z + 0.12);
    c.renderOrder = 5;
    g.add(c);
  }
  box(W.x1 - W.x0 + 0.5, 0.02, 0.02, M.brass, 0, W.y1 + 0.1, z + 0.14, g);
}

function buildDesk(room, anchors) {
  const g = new THREE.Group(); room.add(g);
  const top = 0.75, dz = -1.47, dw = 1.5, dd = 0.66;
  box(dw, 0.035, dd, M.walnut, 0, top - 0.0175, dz, g);
  // left pedestal of drawers, right legs
  box(0.42, top - 0.035, dd - 0.04, M.walnutY, -dw / 2 + 0.23, (top - 0.035) / 2, dz, g);
  for (let i = 0; i < 3; i++) {
    const y = 0.13 + i * 0.22;
    box(0.38, 0.19, 0.012, M.walnut, -dw / 2 + 0.23, y, dz + dd / 2 - 0.02, g);
    box(0.08, 0.015, 0.02, M.brass, -dw / 2 + 0.23, y + 0.03, dz + dd / 2 - 0.005, g);
  }
  box(0.04, top - 0.035, 0.04, M.walnutY, dw / 2 - 0.04, (top - 0.035) / 2, dz + dd / 2 - 0.04, g);
  box(0.04, top - 0.035, 0.04, M.walnutY, dw / 2 - 0.04, (top - 0.035) / 2, dz - dd / 2 + 0.04, g);
  box(0.9, 0.09, 0.012, M.walnut, 0.25, top - 0.08, dz + dd / 2 - 0.02, g);

  // photo album, desk left
  const album = new THREE.Group();
  album.position.set(-0.47, top, -1.42); album.rotation.y = 0.22;
  box(0.32, 0.045, 0.25, M.albumRed, 0, 0.0225, 0, album);
  box(0.30, 0.035, 0.235, M.beige, 0.012, 0.0225, 0, album);
  for (const [x, z, r] of [[0.1, -0.13, 0.3], [-0.05, -0.135, -0.2], [0.17, 0.05, 1.3]]) {
    const p = box(0.09, 0.002, 0.07, M.white, x, 0.03, z, album); p.rotation.y = r;
  }
  g.add(album);
  anchors.album = new THREE.Vector3(-0.47, top + 0.06, -1.42);

  // five notebooks, desk right, stacked a bit crooked
  const nb = new THREE.Group();
  nb.position.set(0.45, top, -1.46);
  STORIES.forEach((s, i) => {
    const mat = makeInk({ color: s.color, wash: 0.72 });
    const b = box(0.17, 0.011, 0.23, mat, (Math.random() - 0.5) * 0.02, 0.006 + i * 0.012, (Math.random() - 0.5) * 0.02, nb);
    b.rotation.y = (Math.random() - 0.5) * 0.25;
    box(0.08, 0.0005, 0.04, M.white, 0, 0.0058, -0.04, b);
  });
  g.add(nb);
  anchors.notebooks = new THREE.Vector3(0.45, top + 0.07, -1.46);

  // the remote, near the edge
  const remote = new THREE.Group();
  remote.position.set(0.3, top, -1.2); remote.rotation.y = -0.35;
  box(0.05, 0.018, 0.19, M.black, 0, 0.009, 0, remote);
  const cols = ['#E8261C', '#1FCF3A', '#FFE81A', '#2BD9F2'];
  cols.forEach((c, i) => box(0.008, 0.004, 0.008, makeInk({ color: c, wash: 0.9, emissive: 0.3 }), -0.015 + i * 0.01, 0.019, -0.04, remote));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(0.009, 0.004, 0.008, M.grey, -0.013 + c * 0.013, 0.019, -0.01 + r * 0.014, remote);
  box(0.012, 0.004, 0.008, M.red, 0, 0.019, -0.08, remote);
  g.add(remote);
  anchors.remote = new THREE.Vector3(0.3, top + 0.03, -1.2);

  // the majolica lamp from Caltagirone, back left (lamp.js)
  const lamp = buildLamp();
  lamp.group.position.set(-0.6, top, -1.64);
  g.add(lamp.group); lamp.group.updateMatrixWorld(true);
  anchors.lampBulb = lamp.group.localToWorld(lamp.bulb.clone());
  anchors.lampGlow = lamp.setGlow;
  anchors.lampGroup = lamp.group; // a click on it turns it on and off (main.js)

  // pen cup with pencils
  cyl(0.035, 0.032, 0.1, M.red, 0.62, top + 0.05, -1.7, g);
  for (let i = 0; i < 5; i++) {
    const p = cyl(0.004, 0.004, 0.16, i % 2 ? M.brass : M.blue, 0.62 + (Math.random() - 0.5) * 0.03, top + 0.12, -1.7 + (Math.random() - 0.5) * 0.03, g, 6);
    p.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
  }

  // cork board with postcards, wall left of the window
  box(0.62, 0.46, 0.02, M.cork, -1.25, 1.62, -ROOM.hz + 0.012, g);
  box(0.66, 0.5, 0.012, M.frame, -1.25, 1.62, -ROOM.hz + 0.004, g);
  const pc = ['#E58C8A', '#F4B183', '#9C8AB4', '#F4F0E6', '#7FA8C9'];
  pc.forEach((c, i) => {
    const p = box(0.13, 0.09, 0.003, makeInk({ color: c, wash: 0.65 }), -1.47 + i * 0.11, 1.62 + (i % 2 ? 0.1 : -0.08), -ROOM.hz + 0.024, g);
    p.rotation.z = (Math.random() - 0.5) * 0.3;
  });
}

function buildWestWall(room, anchors) {
  const g = new THREE.Group(); room.add(g);
  const x = -ROOM.hx;
  // the plain panelled door: moulded architrave, four fielded panels, brass lever, keyhole and hinges, no signs
  const dz = 0.42, dw = 0.86, dh = 2.08;
  const door = new THREE.Group(); door.position.set(x, 0, dz); g.add(door);
  // architrave: a flat band with a rounded bead on its outer edge, and a little cornice on top
  for (const s of [-1, 1]) {
    box(0.018, dh + 0.1, 0.1, M.frame, 0.009, (dh + 0.1) / 2, s * (dw / 2 + 0.05), door);
    const bead = cyl(0.012, 0.012, dh + 0.12, M.frame, 0.02, (dh + 0.12) / 2, s * (dw / 2 + 0.094), door, 10);
    box(0.03, 0.12, 0.13, M.frame, 0.015, 0.06, s * (dw / 2 + 0.055), door); // plinth block
  }
  box(0.018, 0.1, dw + 0.2, M.frame, 0.009, dh + 0.05, 0, door);
  const top = cyl(0.012, 0.012, dw + 0.22, M.frame, 0.02, dh + 0.1, 0, door, 10); top.rotation.x = Math.PI / 2;
  box(0.045, 0.03, dw + 0.26, M.frame, 0.022, dh + 0.125, 0, door);
  // the gap around the leaf, then the leaf
  box(0.012, dh, dw, M.black, 0.004, dh / 2, 0, door);
  box(0.04, dh - 0.008, dw - 0.008, M.door, 0.026, dh / 2, 0, door);
  // panels: a bevelled moulding frame with a raised field inside
  const panelAt = (cz, cy, pw, ph) => {
    const ring = new THREE.Shape(); ring.moveTo(-pw / 2, -ph / 2); ring.lineTo(pw / 2, -ph / 2); ring.lineTo(pw / 2, ph / 2); ring.lineTo(-pw / 2, ph / 2); ring.lineTo(-pw / 2, -ph / 2);
    const hole = new THREE.Path(); hole.moveTo(-pw / 2 + 0.03, -ph / 2 + 0.03); hole.lineTo(-pw / 2 + 0.03, ph / 2 - 0.03); hole.lineTo(pw / 2 - 0.03, ph / 2 - 0.03); hole.lineTo(pw / 2 - 0.03, -ph / 2 + 0.03); hole.lineTo(-pw / 2 + 0.03, -ph / 2 + 0.03);
    ring.holes.push(hole);
    const mould = extrude(ring, 0.012, M.door, 0.004, 2); mould.rotation.y = Math.PI / 2; mould.position.set(0.048, cy, cz); door.add(mould);
    const field = extrude(roundedShape([[-pw / 2 + 0.05, -ph / 2 + 0.05], [pw / 2 - 0.05, -ph / 2 + 0.05], [pw / 2 - 0.05, ph / 2 - 0.05], [-pw / 2 + 0.05, ph / 2 - 0.05]], 0.004), 0.014, M.door, 0.008, 2);
    field.rotation.y = Math.PI / 2; field.position.set(0.046, cy, cz); door.add(field);
  };
  const pw = (dw - 0.3) / 2;
  for (const s of [-1, 1]) { panelAt(s * (pw / 2 + 0.05), 1.45, pw, 0.95); panelAt(s * (pw / 2 + 0.05), 0.5, pw, 0.62); }
  // hinges on the far edge
  for (const hy of [0.24, 1.0, 1.84]) { cyl(0.011, 0.011, 0.11, M.brass, 0.05, hy, dw / 2 - 0.004, door, 10); cyl(0.004, 0.004, 0.13, M.brass, 0.05, hy, dw / 2 - 0.004, door, 6); }
  // brass lever on a rose, and a separate keyhole plate below it
  const hz = -dw / 2 + 0.08;
  const rose = cyl(0.028, 0.03, 0.01, M.brass, 0.05, 1.02, hz, door, 18); rose.rotation.z = Math.PI / 2;
  cyl(0.009, 0.009, 0.035, M.brass, 0.065, 1.02, hz, door, 10).rotation.z = Math.PI / 2;
  const lever = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.08, 1.02, hz), new THREE.Vector3(0.09, 1.02, hz + 0.06), new THREE.Vector3(0.085, 1.01, hz + 0.12)), 12, 0.008, 8), M.brass);
  lever.castShadow = true; door.add(lever);
  const plate = slab(0.09, 0.006, 0.03, 0.012, M.brass, 0.002); plate.rotation.z = Math.PI / 2; plate.position.set(0.049, 0.9, hz); door.add(plate);
  const key = cyl(0.005, 0.005, 0.004, M.black, 0.053, 0.905, hz, door, 10); key.rotation.z = Math.PI / 2;
  box(0.004, 0.014, 0.004, M.black, 0.053, 0.895, hz, door);
  // a worn threshold strip
  box(0.06, 0.012, dw + 0.04, M.frame, 0.03, 0.006, 0, door);
  anchors.door = new THREE.Vector3(x + 0.1, 1.3, dz);

  // wall calendar
  const cal = new THREE.Group();
  cal.position.set(x + 0.012, 1.42, -0.42);
  box(0.006, 0.44, 0.32, M.white, 0, 0, 0, cal);
  g.add(cal);
  anchors.calendar = new THREE.Vector3(x + 0.05, 1.42, -0.42);
  anchors.calendarGroup = cal;

  // small table with the Sirio-style phone and the address book
  const tz = -1.15;
  box(0.4, 0.025, 0.36, M.walnut, x + 0.24, 0.7, tz, g);
  for (const [ox, oz] of [[0.04, 0.04], [0.36, 0.04], [0.04, 0.32], [0.36, 0.32]]) box(0.025, 0.69, 0.025, M.walnutY, x + 0.04 + ox - 0.02, 0.345, tz - 0.18 + oz - 0.02 + 0.02, g);
  const { group: phone, handset } = buildSirio();
  phone.position.set(x + 0.2, 0.7125, tz + 0.02); phone.rotation.y = Math.PI / 2 + 0.25;
  g.add(phone);
  anchors.phone = new THREE.Vector3(x + 0.22, 0.85, tz + 0.03);
  anchors.phoneHandset = handset;
  const book = box(0.15, 0.025, 0.2, M.red, x + 0.3, 0.725, tz - 0.12, g); book.rotation.y = 0.3;
}
