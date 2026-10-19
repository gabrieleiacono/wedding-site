// The SIP "Sirio"-style desk phone: soft cream wedge body, grey-blue keypad panel with twelve
// black keys and two memory buttons, the handset resting along the back, and a coiled black cord.
import * as THREE from 'three';
import { makeInk } from './ink.js';
import { slab, roundedShape, extrude } from './room.js';

class Coil extends THREE.Curve {
  constructor(path, turns, radius) { super(); this.path = path; this.turns = turns; this.radius = radius; this.frames = path.computeFrenetFrames(400, false); }
  getPoint(t, target = new THREE.Vector3()) {
    const i = Math.min(400, Math.round(t * 400));
    const p = this.path.getPointAt(t), a = t * this.turns * Math.PI * 2;
    const n = this.frames.normals[i], b = this.frames.binormals[i];
    return target.copy(p).addScaledVector(n, Math.cos(a) * this.radius).addScaledVector(b, Math.sin(a) * this.radius);
  }
}

function keyLabels() {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#26262A'; x.fillRect(0, 0, 1536, 128);
  x.fillStyle = '#F2F0EA'; x.font = '600 84px "IBM Plex Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '✱', '0', '#'].forEach((k, i) => x.fillText(k, 64 + i * 128, 68));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSirio() {
  const g = new THREE.Group();
  const cream = makeInk({ color: '#EDE8DA', wash: 0.45, lift: 0.1, hatch: 0.75 });
  const panelMat = makeInk({ color: '#8E9DB0', wash: 0.75, lift: 0.05 });
  const black = makeInk({ color: '#26262A', wash: 0.9 });

  // body: 22 × 19 cm, 3 cm at the front, 4.6 cm at the back
  const W = 0.22, D = 0.19, hF = 0.03, hB = 0.046;
  const body = slab(W, 0.04, D, 0.035, cream, 0.012);
  const pos = body.geometry.attributes.position;
  body.geometry.computeBoundingBox();
  const { min, max } = body.geometry.boundingBox, b = 0.012;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getZ(i) + D / 2) / D, 0, 1);
    const top = hB + (hF - hB) * t;
    const y = pos.getY(i);
    // keep the rounded bevels, stretch the side wall so the top slopes from back to front
    const yy = y < min.y + b ? y - min.y : y > max.y - b ? top - (max.y - y) : b + (y - min.y - b) / (max.y - min.y - 2 * b) * (top - 2 * b);
    pos.setY(i, yy);
  }
  body.geometry.computeVertexNormals();
  g.add(body);
  const slope = Math.atan2(hB - hF, D);
  const topY = (z) => hB + (hF - hB) * ((z + D / 2) / D);

  // keypad panel on the front right, following the slope
  const pz = 0.035, px = 0.025;
  const panel = slab(0.135, 0.004, 0.085, 0.006, panelMat, 0.0015);
  panel.position.set(px, topY(pz) + 0.002, pz); panel.rotation.x = slope; g.add(panel);
  // twelve keys, 3 × 4, with white legends
  const tex = keyLabels();
  for (let i = 0; i < 12; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const kx = px - 0.035 + col * 0.022, kz = pz - 0.03 + row * 0.019;
    const geo = new THREE.BoxGeometry(0.015, 0.006, 0.011);
    const uv = geo.attributes.uv, nrm = geo.attributes.normal;
    for (let v = 0; v < uv.count; v++) {
      if (nrm.getY(v) > 0.5) uv.setXY(v, (i + 0.08 + uv.getX(v) * 0.84) / 12, 0.15 + uv.getY(v) * 0.7);
      else uv.setXY(v, 0.5 / 1536, 0.5);
    }
    const k = new THREE.Mesh(geo, makeInk({ color: '#ffffff', wash: 0.9, map: tex, hatch: 0.6 }));
    k.position.set(kx, topY(kz) + 0.006, kz); k.rotation.x = slope; k.castShadow = true;
    g.add(k);
  }
  // two memory buttons and a small red mark
  for (const bz of [-0.018, -0.002]) { const b = slab(0.012, 0.004, 0.009, 0.003, cream, 0.001); b.position.set(px + 0.05, topY(pz + bz) + 0.0055, pz + bz); b.rotation.x = slope; g.add(b); }
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.006), makeInk({ color: '#C4312A', wash: 0.9 }));
  mark.position.set(px - 0.06, topY(pz - 0.034) + 0.0045, pz - 0.034); mark.rotation.x = -Math.PI / 2 + slope; g.add(mark);
  // a seam where the top shell meets the base
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0012, 4, 64), makeInk({ color: '#BFB8A6', wash: 0.7 }));
  seam.scale.set(W / 2 - 0.004, D / 2 - 0.004, 1); seam.rotation.x = Math.PI / 2; seam.position.y = 0.012; g.add(seam);

  // handset, lying along the back
  const hs = roundedShape([[-0.108, 0.016], [0.108, 0.016], [0.112, -0.008], [0.082, -0.026], [0.052, -0.012], [-0.052, -0.012], [-0.082, -0.026], [-0.112, -0.008]], 0.014);
  const handset = extrude(hs, 0.052, cream, 0.01, 4);
  const hsY = topY(-0.055) + 0.03;
  handset.position.set(0, hsY, -0.055);
  g.add(handset);
  // little grooves where ear- and mouthpiece are
  for (const ex of [-0.085, 0.085]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0012, 4, 20), makeInk({ color: '#BFB8A6', wash: 0.7 }));
    r.position.set(ex, hsY + 0.026, -0.055); r.rotation.x = Math.PI / 2; g.add(r);
  }

  // coiled cord: from the handset's left end, down to the table, a loop, back into the body's side
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12, hsY - 0.01, -0.05), new THREE.Vector3(-0.15, 0.03, -0.02), new THREE.Vector3(-0.16, 0.008, 0.06),
    new THREE.Vector3(-0.12, 0.008, 0.12), new THREE.Vector3(-0.06, 0.008, 0.13), new THREE.Vector3(-0.08, 0.008, 0.07),
    new THREE.Vector3(-0.13, 0.01, 0.0), new THREE.Vector3(-0.116, 0.02, -0.06),
  ]);
  const coil = new Coil(path, 70, 0.0055);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(coil, 2400, 0.0016, 5), black));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, handset };
}
