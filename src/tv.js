// Wall B (east): 32" flat-glass CRT on a black cabinet, VCR blinking 12:00, the grey console,
// VHS tapes, a film poster and a wall clock (design F4).
import * as THREE from 'three';
import { makeInk, makeScreen } from './ink.js';
import { M, box, cyl, slab, ROOM } from './room.js';
import { WEDDING } from './content.js';

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
  // the grey console
  const ps = new THREE.Group(); ps.position.set(x - 0.22, 0.31, z + 0.24);
  box(0.26, 0.05, 0.27, M.grey, 0, 0.025, 0, ps);
  box(0.12, 0.012, 0.13, makeInk({ color: '#ACA9A1', wash: 0.6 }), 0.02, 0.055, 0, ps);
  cyl(0.012, 0.012, 0.01, M.darkgrey, -0.09, 0.055, -0.08, ps, 12);
  const led = box(0.008, 0.008, 0.008, makeInk({ color: '#3FCF5A', emissive: 1.2 }), -0.13, 0.03, 0.09, ps);
  g.add(ps);
  // controller lying on the floor, cable to the console
  const pad = slab(0.07, 0.025, 0.15, 0.03, M.grey, 0.008); pad.position.set(x - 0.75, 0.0125, z + 0.35); pad.rotation.y = 0.4; g.add(pad);
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - 0.35, 0.33, z + 0.28), new THREE.Vector3(x - 0.5, 0.2, z + 0.3), new THREE.Vector3(x - 0.55, 0.01, z + 0.32), new THREE.Vector3(x - 0.72, 0.01, z + 0.36),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 40, 0.003, 5), M.darkgrey));
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
  // speaker grille strip + power LED
  box(0.01, 0.04, 0.72, M.black, -0.255, 0.035, 0, tv);
  box(0.006, 0.01, 0.01, makeInk({ color: '#E2412F', emissive: 1.5 }), -0.262, 0.035, 0.2, tv);
  const screenWorld = new THREE.Vector3(); screen.getWorldPosition(screenWorld);

  // glow from the screen onto the room
  const glow = new THREE.PointLight('#8AA0FF', 0.6, 3.5, 1.6);
  glow.position.set(screenWorld.x - 0.4, screenWorld.y, screenWorld.z); g.add(glow);

  // poster ("La Villa — un film di…") to the left (north) of the TV
  const posterCanvas = document.createElement('canvas'); posterCanvas.width = 256; posterCanvas.height = 360;
  drawPoster(posterCanvas.getContext('2d'));
  const posterTex = new THREE.CanvasTexture(posterCanvas); posterTex.colorSpace = THREE.SRGBColorSpace;
  box(0.012, 0.74, 0.54, M.black, x - 0.006, 1.55, z - 0.95, g);
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), makeScreen(posterTex));
  poster.position.set(x - 0.014, 1.55, z - 0.95); poster.rotation.y = -Math.PI / 2; g.add(poster);

  // clock to the right (south)
  const clock = new THREE.Group(); clock.position.set(x - 0.02, 1.75, z + 0.95); g.add(clock);
  const face = cyl(0.17, 0.17, 0.03, M.white, 0, 0, 0, clock, 32); face.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 40), M.black); rim.rotation.y = Math.PI / 2; clock.add(rim);
  for (let i = 0; i < 12; i++) { const t = box(0.004, 0.025, 0.006, M.black, -0.017, Math.cos(i * Math.PI / 6) * 0.14, Math.sin(i * Math.PI / 6) * 0.14, clock); t.rotation.x = -i * Math.PI / 6; }
  const hourHand = new THREE.Group(), minHand = new THREE.Group();
  box(0.004, 0.09, 0.012, M.black, 0, 0.045, 0, hourHand);
  box(0.004, 0.13, 0.008, M.black, 0, 0.065, 0, minHand);
  hourHand.position.x = -0.02; minHand.position.x = -0.024; clock.add(hourHand, minHand);

  // potted plant, south corner
  const pot = cyl(0.13, 0.1, 0.24, M.red, x - 0.25, 0.12, z + 1.35, g);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M.plant);
    leaf.scale.set(0.3, 1, 0.5);
    const a = i / 9 * Math.PI * 2;
    leaf.position.set(x - 0.25 + Math.cos(a) * 0.1, 0.38 + (i % 3) * 0.08, z + 1.35 + Math.sin(a) * 0.1);
    leaf.rotation.set(Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6);
    leaf.castShadow = true; g.add(leaf);
  }

  return {
    screen, screenWorld, glow,
    ps: new THREE.Vector3(x - 0.22, 0.38, z + 0.24),
    tick(now) {
      const d = new Date();
      const h = d.getHours() % 12 + d.getMinutes() / 60, m = d.getMinutes() + d.getSeconds() / 60;
      hourHand.rotation.x = -h / 12 * Math.PI * 2; minHand.rotation.x = -m / 60 * Math.PI * 2;
      const c = vcrCanvas.getContext('2d');
      c.fillStyle = '#060806'; c.fillRect(0, 0, 128, 48);
      if (Math.floor(now / 600) % 2) { c.fillStyle = '#5CF27A'; c.font = '700 34px "IBM Plex Mono", monospace'; c.fillText('12:00', 10, 37); }
      vcrTex.needsUpdate = true;
      led.material.emissiveIntensity = 1.2;
    },
  };
}

function drawPoster(c) {
  c.fillStyle = '#1F2A44'; c.fillRect(0, 0, 256, 360);
  c.fillStyle = '#F2C14E'; c.beginPath(); c.arc(128, 160, 58, 0, 7); c.fill();
  c.fillStyle = '#2F4A2E'; c.beginPath(); c.moveTo(0, 270); c.quadraticCurveTo(70, 200, 128, 236); c.quadraticCurveTo(190, 200, 256, 260); c.lineTo(256, 360); c.lineTo(0, 360); c.fill();
  c.fillStyle = '#F1DFC2'; c.fillRect(110, 214, 36, 24); c.fillStyle = '#C2552E'; c.beginPath(); c.moveTo(104, 216); c.lineTo(128, 200); c.lineTo(152, 216); c.fill();
  c.fillStyle = '#F3EEE4'; c.textAlign = 'center';
  c.font = '800 34px "Bricolage Grotesque", sans-serif'; c.fillText('LA VILLA', 128, 52);
  c.font = '500 12px "IBM Plex Mono", monospace'; c.fillText('UN FILM DI ' + WEDDING.names.toUpperCase(), 128, 74);
  c.fillStyle = '#B3AA9A'; c.font = '500 11px "IBM Plex Mono", monospace'; c.fillText('PROSSIMAMENTE AL CINEMA', 128, 340);
  c.strokeStyle = '#1A1714'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 253, 357);
}
