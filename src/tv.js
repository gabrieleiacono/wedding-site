// Wall B (east): 32" flat-glass CRT on a black cabinet, VCR blinking 12:00, the grey console (console.js),
// VHS tapes, a prickly pear in a pot (ficodindia.js) and a wall clock (design F4).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk, makeScreen } from './ink.js';
import { M, box, cyl, slab, ROOM, roundedShape, extrude } from './room.js';
import { merge } from './geo.js';
import { buildConsole } from './console.js';
import { buildPricklyPear } from './ficodindia.js';

export function buildTV(room, teletext) {
  const g = new THREE.Group(); room.add(g);
  const x = ROOM.hx, z = -0.55;
  // cabinet (open front, two shelves)
  const cw = 1.15, ch = 0.52, cd = 0.48;
  box(cd, 0.03, cw, M.black, x - cd / 2, ch, z, g);
  box(cd, 0.03, cw, M.black, x - cd / 2, 0.06, z, g);
  box(cd, 0.02, cw - 0.04, M.black, x - cd / 2, 0.29, z, g);
  box(cd, ch, 0.03, M.black, x - cd / 2, ch / 2, z - cw / 2, g);
  box(cd, ch, 0.03, M.black, x - cd / 2, ch / 2, z + cw / 2, g);
  box(0.02, ch, cw, M.black, x - 0.01, ch / 2, z, g);
  // VCR with a green 12:00
  box(0.32, 0.08, 0.42, M.darkgrey, x - 0.24, 0.35, z - 0.25, g);
  const vcrCanvas = document.createElement('canvas'); vcrCanvas.width = 128; vcrCanvas.height = 48;
  const vcrTex = new THREE.CanvasTexture(vcrCanvas); vcrTex.colorSpace = THREE.SRGBColorSpace;
  const vcrScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), makeScreen(vcrTex));
  vcrScreen.position.set(x - 0.4 - 0.001, 0.35, z - 0.33); vcrScreen.rotation.y = -Math.PI / 2; g.add(vcrScreen);
  {
    // cassette flap, transport buttons, a label and little feet
    const fx = x - 0.4;
    box(0.006, 0.032, 0.19, M.black, fx - 0.002, 0.362, z - 0.2, g);
    box(0.004, 0.003, 0.17, M.grey, fx - 0.005, 0.346, z - 0.2, g);
    for (let i = 0; i < 6; i++) box(0.008, 0.01, 0.018, i === 5 ? M.red : M.grey, fx - 0.003, 0.33, z - 0.115 + i * 0.022, g);
    box(0.008, 0.014, 0.014, M.grey, fx - 0.003, 0.36, z - 0.06, g);
    const lab = labelTexture('VIDEO · HQ · 4 TESTINE', 256, 24, '#C9C6BE', '#45444A');
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.011), makeScreen(lab)); l.position.set(fx - 0.0015, 0.381, z - 0.33); l.rotation.y = -Math.PI / 2; g.add(l);
    for (const [ox, oz] of [[0.02, -0.19], [0.28, -0.19], [0.02, 0.19], [0.28, 0.19]]) box(0.03, 0.008, 0.03, M.black, fx + ox, 0.307, z - 0.25 + oz, g);
  }
  // the grey console: the first PlayStation (console.js), its front to the room
  const ps = buildConsole(); ps.group.position.set(x - 0.24, 0.3, z + 0.24); ps.group.rotation.y = -Math.PI / 2; g.add(ps.group);
  const led = ps.led;
  // controller lying on the floor, its cable from the plug in port 1 over the shelf's edge
  const pad = buildPad(); pad.position.set(x - 0.75, 0.0, z + 0.35); pad.rotation.y = 0.4 - Math.PI / 2; g.add(pad);
  const plugAt = ps.plugAt.clone().applyEuler(ps.group.rotation).add(ps.group.position);
  const cable = new THREE.CatmullRomCurve3([
    plugAt, new THREE.Vector3(x - 0.5, 0.305, z + 0.22), new THREE.Vector3(x - 0.53, 0.2, z + 0.26), new THREE.Vector3(x - 0.56, 0.01, z + 0.31), new THREE.Vector3(x - 0.72, 0.01, z + 0.36),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 48, 0.003, 5), M.darkgrey));
  // VHS tapes on the bottom shelf
  for (let i = 0; i < 7; i++) {
    box(0.19, 0.105, 0.026, i % 3 ? M.black : M.white, x - 0.22, 0.13, z - 0.4 + i * 0.03, g);
  }

  // the TV: 32" 4:3 flat-glass CRT, deep body
  const tv = new THREE.Group(); tv.position.set(x - 0.32, ch + 0.015, z); g.add(tv);
  const bw = 0.8, bh = 0.62;
  const front = slab(bh, 0.06, bw, 0.03, M.darkgrey, 0.01); // slab: w=x(depth), h=y, d=z → rotate
  front.geometry.rotateZ(Math.PI / 2); front.position.set(-0.22, bh / 2, 0); front.geometry.computeBoundingSphere();
  tv.add(front);
  // the body tapers to the back
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.42, 4, 1), M.black);
  back.rotation.z = -Math.PI / 2; back.rotation.x = Math.PI / 4;
  back.position.set(0.0, bh / 2 + 0.02, 0); back.castShadow = true; back.receiveShadow = true; tv.add(back);
  box(0.36, 0.03, 0.5, M.black, 0.02, 0.015, 0, tv);
  // screen
  const sw = 0.66, sh = 0.495;
  const screenMat = makeScreen(teletext.texture);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.position.set(-0.252, bh / 2 + 0.04, 0); screen.rotation.y = -Math.PI / 2; tv.add(screen);
  // flat glass reflection: a faint diagonal sheen
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.008, depthWrite: false }));
  sheen.position.copy(screen.position); sheen.position.x -= 0.002; sheen.rotation.y = -Math.PI / 2; tv.add(sheen);
  // bezel around the tube
  const bezMat = makeInk({ color: '#55545A', wash: 0.8 });
  const ring = roundedShape([[-sw / 2 - 0.03, -sh / 2 - 0.03], [sw / 2 + 0.03, -sh / 2 - 0.03], [sw / 2 + 0.03, sh / 2 + 0.03], [-sw / 2 - 0.03, sh / 2 + 0.03]], 0.04);
  ring.holes.push(roundedShape([[-sw / 2 - 0.004, -sh / 2 - 0.004], [-sw / 2 - 0.004, sh / 2 + 0.004], [sw / 2 + 0.004, sh / 2 + 0.004], [sw / 2 + 0.004, -sh / 2 - 0.004]], 0.012));
  const bezel = extrude(ring, 0.014, bezMat, 0.004, 2); bezel.rotation.y = -Math.PI / 2; bezel.position.set(-0.258, bh / 2 + 0.04, 0); tv.add(bezel);
  // speaker grilles left and right of the control strip, buttons, a label and the power LED
  const slots = [];
  for (const s0 of [-0.37, 0.16]) for (let i = 0; i < 26; i++) { const sl = new THREE.BoxGeometry(0.006, 0.05, 0.003); sl.translate(-0.254, 0.05, s0 + i * 0.0082); slots.push([sl, '#1A1714']); }
  tv.add(new THREE.Mesh(merge(slots), makeInk({ color: '#ffffff', vertexColors: true, wash: 0.9 })));
  box(0.006, 0.05, 0.14, M.black, -0.253, 0.05, 0.0, tv);
  for (let i = 0; i < 5; i++) box(0.01, 0.012, 0.016, bezMat, -0.258, 0.042, -0.05 + i * 0.024, tv);
  box(0.012, 0.022, 0.03, M.grey, -0.258, 0.05, -0.33 - 0.01, tv);
  box(0.006, 0.01, 0.01, makeInk({ color: '#E2412F', emissive: 1.5 }), -0.262, 0.05, -0.3, tv);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.014), makeScreen(labelTexture('STEREO  ·  COLOR 32', 512, 52, '#D8D4CA', '#45444A')));
  badge.position.set(-0.2665, 0.083, 0.24); badge.rotation.y = -Math.PI / 2; tv.add(badge);
  // rabbit-ear antenna on top
  const ant = new THREE.Group(); ant.position.set(0.05, 0.63, 0.1); tv.add(ant);
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.black); ant.add(base);
  for (const sgn of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.003, 0.5, 6), M.grey);
    rod.position.set(0, 0.24, sgn * 0.11); rod.rotation.x = sgn * 0.45; rod.castShadow = true; ant.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), M.grey); tip.position.set(0, 0.47, sgn * 0.215); ant.add(tip);
  }
  const screenWorld = new THREE.Vector3(); screen.getWorldPosition(screenWorld);

  // glow from the screen onto the room
  const glow = new THREE.PointLight('#8AA0FF', 0.6, 3.5, 1.6);
  glow.position.set(screenWorld.x - 0.4, screenWorld.y, screenWorld.z); g.add(glow);

  // clock to the right (south)
  const clock = new THREE.Group(); clock.position.set(x - 0.02, 1.75, z + 0.95); g.add(clock);
  const face = cyl(0.17, 0.17, 0.03, M.white, 0, 0, 0, clock, 32); face.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 40), M.black); rim.rotation.y = Math.PI / 2; clock.add(rim);
  for (let i = 0; i < 12; i++) { const t = box(0.004, 0.025, 0.006, M.black, -0.017, Math.cos(i * Math.PI / 6) * 0.14, Math.sin(i * Math.PI / 6) * 0.14, clock); t.rotation.x = -i * Math.PI / 6; }
  const hourHand = new THREE.Group(), minHand = new THREE.Group();
  box(0.004, 0.09, 0.012, M.black, 0, 0.045, 0, hourHand);
  box(0.004, 0.13, 0.008, M.black, 0, 0.065, 0, minHand);
  hourHand.position.x = -0.02; minHand.position.x = -0.024; clock.add(hourHand, minHand);

  // the ficu d'India (prickly pear) in its terracotta pot, on the floor just left (north) of the cabinet
  const plant = buildPricklyPear(); plant.position.set(x - 0.25, 0, z - cw / 2 - 0.27); g.add(plant);

  // the set itself (body, screen, bezel, antenna): a tap on it zooms in on the teletext
  const isTV = (o) => { for (; o; o = o.parent) if (o === tv) return true; return false; };

  return {
    screen, screenWorld, glow, isTV,
    ps: new THREE.Vector3(x - 0.24, 0.37, z + 0.24),
    tick(now) {
      const d = new Date();
      const h = d.getHours() % 12 + d.getMinutes() / 60, m = d.getMinutes() + d.getSeconds() / 60;
      hourHand.rotation.x = -h / 12 * Math.PI * 2; minHand.rotation.x = -m / 60 * Math.PI * 2;
      const on = Math.floor(now / 600) % 2;
      if (on === this.vcrOn) return; // the VCR's 12:00 only changes when it blinks
      this.vcrOn = on;
      const c = vcrCanvas.getContext('2d');
      c.fillStyle = '#060806'; c.fillRect(0, 0, 128, 48);
      if (on) { c.fillStyle = '#5CF27A'; c.font = '700 34px "IBM Plex Mono", monospace'; c.fillText('12:00', 10, 37); }
      vcrTex.needsUpdate = true;
      led.material.emissiveIntensity = 1.2;
    },
  };
}

function labelTexture(text, w, h, fg, bg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.font = `600 ${Math.round(h * 0.62)}px "IBM Plex Sans", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A grey 90s console pad: two grips, a d-pad, four face buttons, start/select and shoulder buttons.
function buildPad() {
  const p = new THREE.Group();
  const outline = roundedShape([[-0.075, 0.025], [0.075, 0.025], [0.082, -0.02], [0.07, -0.072], [0.05, -0.08], [0.032, -0.052], [-0.032, -0.052], [-0.05, -0.08], [-0.07, -0.072], [-0.082, -0.02]], 0.018);
  const body = extrude(outline, 0.022, M.grey, 0.007, 3); body.rotation.x = -Math.PI / 2; body.position.y = 0.011; p.add(body);
  const dark = M.darkgrey;
  box(0.036, 0.006, 0.012, dark, -0.048, 0.024, -0.004, p); box(0.012, 0.006, 0.036, dark, -0.048, 0.024, -0.004, p);
  const cols = ['#3FA88A', '#D9534A', '#6A8FD0', '#D27BB0'];
  [[0, -0.016], [0.016, 0], [0, 0.016], [-0.016, 0]].forEach(([ox, oz], i) => { cyl(0.0065, 0.0065, 0.006, dark, 0.048 + ox, 0.024, -0.004 + oz, p, 12); cyl(0.003, 0.003, 0.002, makeInk({ color: cols[i], wash: 0.9 }), 0.048 + ox, 0.0275, -0.004 + oz, p, 8); });
  box(0.012, 0.004, 0.005, dark, -0.012, 0.023, -0.002, p).rotation.y = 0.4; box(0.012, 0.004, 0.005, dark, 0.012, 0.023, -0.002, p).rotation.y = -0.4;
  for (const sx of [-1, 1]) for (const k of [0, 1]) box(0.028, 0.008 - k * 0.002, 0.008, dark, sx * 0.05, 0.016 + k * 0.006, 0.03 + k * 0.006, p);
  return p;
}
