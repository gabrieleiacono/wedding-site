// A detailed electronic typewriter modelled on the late-80s/90s Smith Corona memory typewriters
// (two-tone housing, sculpted cream keycaps with black and red legends, one-line LCD, paper slot with
// a ruler, platen knob on the right). Badge and model name are generic on purpose (design note F-notes).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { M, box, cyl, slab, profile } from './room.js';

const U = 0.0236;        // key pitch (m)
const KEY_D = 0.0214;    // keycap depth at the base
const KEY_H = 0.011;

// [label, units, main legend, second legend (red), input key]
const ROWS = [
  [['Tab $', 1, 'Tab $', 'C'], ...[['1', '!'], ['2', '@'], ['3', '#'], ['4', '$'], ['5', '%'], ['6', '&'], ['7', '&'], ['8', '*'], ['9', '('], ['0', ')']].map(([d, s]) => [d, 1, s, '', d, d]), ['-', 1, '_', '', '-', '-'], ['=', 1, '+', '', '=', '='], ['BS', 1, 'Back\nSpace', '', 'Backspace']],
  [['Tab', 1.75, 'Tab', ''], ...'QWERTYUIOP'.split('').map((c) => [c, 1, c, '', c]), ['¼', 1, '¼', '½', '¼']],
  [['Lock', 1.75, 'Lock', ''], ...'ASDFGHJKL'.split('').map((c) => [c, 1, c, { A: 'Adj', S: 'Stop', F: 'Find', K: 'KB II', L: 'List' }[c] || '', c]), [';', 1, ':', ';', ';'], ["'", 1, '"', "'", "'"]],
  [['ShiftL', 2.25, 'Shift', 'Paper In'], ...'ZXCVBNM'.split('').map((c) => [c, 1, c, { C: 'Close', B: 'Bold' }[c] || '', c]), [',', 1, "'", ',', ','], ['.', 1, '·', '.', '.'], ['/', 1, '?', '/', '/'], ['ShiftR', 1.75, 'Shift', '']],
  [['Code', 1.5, '', 'Code'], ['Margin', 1.5, 'Margin  L', 'R'], [' ', 7.5, '', 'Half Space', ' '], ['WordEraser', 1.75, 'WordEraser', ''], ['Correct', 1.75, 'Correct', '']],
];

/** Keycap: a tapered block whose top face shows its cell of the legend atlas. */
function keycapGeometry(w, rect, atlasW, atlasH) {
  const g = new THREE.BoxGeometry(w, KEY_H, KEY_D, 2, 1, 2);
  const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
  const sx = (w - 0.0042) / w, sz = (KEY_D - 0.0042) / KEY_D;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      pos.setX(i, pos.getX(i) * sx);
      pos.setZ(i, pos.getZ(i) * sz - 0.0008);
      // a shallow dish in the top
      const dx = pos.getX(i) / (w * sx / 2), dz = pos.getZ(i) / (KEY_D * sz / 2);
      if (Math.abs(dx) < 0.99 && Math.abs(dz) < 0.99) pos.setY(i, y - 0.0007);
    }
  }
  // faces: px nx py ny pz nz, each (2+1)*(2+1) or similar verts — remap by normal
  const [x0, y0, x1, y1] = rect;
  for (let i = 0; i < uv.count; i++) {
    if (nrm.getY(i) > 0.5) {
      uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / atlasW, 1 - (y1 - uv.getY(i) * (y1 - y0)) / atlasH);
    } else uv.setXY(i, (atlasW - 4) / atlasW, 1 - (atlasH - 4) / atlasH); // blank cream corner
  }
  g.computeVertexNormals();
  return g;
}

function legendAtlas(keys) {
  const W = 2048, H = 512, cell = 92;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#EFE8D8'; x.fillRect(0, 0, W, H);
  let cx = 0, cy = 0;
  for (const k of keys) {
    const w = Math.round(k.units * cell);
    if (cx + w > W - 8) { cx = 0; cy += cell; }
    k.rect = [cx, cy, cx + w, cy + cell];
    // soft shading towards the edges of the cap (it reads as a sculpted top under the hatching)
    const gr = x.createRadialGradient(cx + w / 2, cy + cell / 2, cell * 0.2, cx + w / 2, cy + cell / 2, cell * 0.8);
    gr.addColorStop(0, '#F3EDE0'); gr.addColorStop(1, '#E2D9C6');
    x.fillStyle = gr; x.fillRect(cx, cy, w, cell);
    const pad = 12;
    x.fillStyle = '#1A1714'; x.textBaseline = 'top';
    const lines = (k.main || '').split('\n');
    const big = k.main && k.main.length <= 2;
    x.font = big ? '600 46px "IBM Plex Sans", sans-serif' : '600 20px "IBM Plex Sans", sans-serif';
    lines.forEach((l, i) => x.fillText(l, cx + pad, cy + pad - 4 + i * 22));
    if (/^[0-9]$/.test(k.input || '')) { x.font = '600 38px "IBM Plex Sans", sans-serif'; x.fillText(k.input, cx + pad + 2, cy + cell - 46); }
    if (k.second) {
      x.fillStyle = '#C4312A'; x.font = '600 19px "IBM Plex Sans", sans-serif'; x.textAlign = 'right';
      x.fillText(k.second, cx + w - pad, cy + cell - 30); x.textAlign = 'left';
    }
    if (k.label === 'Lock') { x.fillStyle = '#1A1714'; x.beginPath(); x.arc(cx + w - 22, cy + 22, 4, 0, 7); x.fill(); }
    cx += w;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, W, H };
}

/** Printed graphics on the top of the housing: badge, model plate, LCD captions, ruler. */
function housingDecal() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 820;
  const x = c.getContext('2d');
  const W = 2048, H = 820; // maps to 0.44 m × 0.176 m
  x.clearRect(0, 0, W, H);
  // ruler strip in front of the slot
  const ry = 190;
  x.fillStyle = '#EDE7DA'; x.fillRect(250, ry, 1550, 70);
  x.strokeStyle = '#1A1714'; x.lineWidth = 2; x.strokeRect(250, ry, 1550, 70);
  x.fillStyle = '#1A1714'; x.font = '500 22px "IBM Plex Mono", monospace'; x.textAlign = 'center';
  for (let i = 0; i <= 90; i++) {
    const px = 300 + i * 16.5;
    x.fillRect(px, ry + 4, 2, i % 10 === 0 ? 22 : i % 5 === 0 ? 14 : 8);
    if (i % 10 === 0) x.fillText(String(i), px, ry + 30);
  }
  x.fillStyle = '#C4312A'; x.fillRect(300 + 45 * 16.5 - 1, ry + 46, 3, 18);
  // badge, left: dark plate with a striped mark and generic name
  x.fillStyle = '#2B2A2E'; x.fillRect(150, 470, 380, 110);
  x.strokeStyle = '#8A8A86'; x.lineWidth = 3; x.strokeRect(156, 476, 368, 98);
  x.strokeStyle = '#D9D6CE'; x.lineWidth = 3;
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(176 + i * 9, 496); x.lineTo(176 + i * 9, 560); x.stroke(); }
  x.fillStyle = '#E8E6E0'; x.textAlign = 'left'; x.font = '700 40px "IBM Plex Sans", sans-serif';
  x.fillText('SCRITTOIO', 250, 520); x.font = '600 30px "IBM Plex Sans", sans-serif'; x.fillText('ELETTRONICA', 250, 560);
  // LCD bezel captions (the LCD itself is a separate live screen)
  x.fillStyle = '#4A4842'; x.font = '500 20px "IBM Plex Sans", sans-serif'; x.textAlign = 'center';
  x.fillText('ON  OFF      10   12      1  1½  2      L  M  H', 1024, 440);
  x.fillText('Fine pagina     Passo       Interlinea     Battuta', 1024, 720);
  // model plate, right
  x.textAlign = 'left'; x.fillStyle = '#2A2826'; x.font = 'italic 500 30px "IBM Plex Sans", sans-serif';
  x.fillText('Dizionario Ortografico', 1430, 500);
  x.fillStyle = '#C4312A'; x.font = '500 26px "IBM Plex Sans", sans-serif'; x.fillText('Macchina con memoria', 1470, 538);
  x.fillStyle = '#2A2826'; x.font = '600 70px "IBM Plex Sans", sans-serif'; x.fillText('ED 98', 1530, 620);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function functionStrip() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#CFCAC0'; x.fillRect(0, 0, 2048, 96);
  x.fillStyle = '#D3433A'; x.fillRect(40, 30, 1968, 5); x.fillRect(40, 84, 1968, 4);
  x.fillStyle = '#1A1714'; x.font = '600 24px "IBM Plex Sans", sans-serif'; x.textAlign = 'center';
  x.fillText('AUTO', 620, 22); x.fillText('INDICE', 1060, 22);
  x.font = '500 24px "IBM Plex Sans", sans-serif';
  [['A capo', 380], ['Centra', 540], ['Parola', 680], ['Tutto', 810], ['Mezzo spazio', 960], ['Su', 1130], ['Giù', 1250], ['Inserisci', 1660], ['Formato', 1820]].forEach(([t, px]) => x.fillText(t, px, 70));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

export function buildTypewriterModel(g, lcdTex) {
  const cream = makeInk({ color: '#E6DFCD', wash: 0.5, lift: 0.12, hatch: 0.7 });
  const grey = makeInk({ color: '#C7C2B6', wash: 0.55, lift: 0.08, hatch: 0.7 });
  const dark = makeInk({ color: '#3A3835', wash: 0.85 });
  const black = M.black;

  // bottom tray + keyboard deck (grey), upper housing (cream)
  const tray = slab(0.47, 0.022, 0.37, 0.025, cream, 0.006); tray.position.set(0, 0.011, -0.025); g.add(tray);
  const deckTop = (z) => 0.062 - (z + 0.03) * 0.1; // the deck slopes down towards you (bevel included)
  const dp = (z) => deckTop(z) - 0.006;
  g.add(profile([[-0.03, 0.018], [-0.03, dp(-0.03)], [0.13, dp(0.13)], [0.148, 0.034], [0.15, 0.018]], 0.455, grey, 0.006));
  // keyboard recess: a dark well framed by the deck
  const well = slab(0.35, 0.012, 0.13, 0.008, dark, 0.002); well.position.set(-0.012, deckTop(0.057) - 0.004, 0.057); well.rotation.x = 0.1; g.add(well);
  // the function strip between housing and keys
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.02), makeInk({ color: '#ffffff', wash: 0.8, map: functionStrip(), hatch: 0.6 }));
  strip.position.set(0, deckTop(-0.016) + 0.0012, -0.016); strip.rotation.x = -Math.PI / 2 + 0.1; g.add(strip);

  // upper housing: a sloped top, short vertical front
  const B = [-0.03, 0.08], C = [-0.205, 0.118];
  g.add(profile([[-0.022, 0.03], [B[0], B[1]], [C[0] + 0.01, C[1]], [C[0], C[1] - 0.012], [C[0], 0.03]], 0.46, cream, 0.008));
  const slope = Math.atan2(C[1] - B[1], B[0] - C[0]);
  const onTop = (t, x = 0, lift = 0.0015) => {
    const z = B[0] + (C[0] - B[0]) * t, y = B[1] + (C[1] - B[1]) * t;
    return new THREE.Vector3(x, y + lift + 0.008, z);
  };
  // printed decal over the whole top
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.176), makeInk({ color: '#ffffff', wash: 0.9, map: housingDecal(), transparent: true, opacity: 1, hatch: 0.8 }));
  decal.material.depthWrite = true;
  decal.position.copy(onTop(0.5)); decal.rotation.x = -Math.PI / 2 + slope; g.add(decal);
  // paper slot: a dark opening with the platen just showing, and the clear bail
  const slotT = 0.78, slotPos = onTop(slotT, 0, -0.002);
  const slot = box(0.38, 0.01, 0.036, M.black, 0, 0, 0, g); slot.position.copy(slotPos); slot.rotation.x = slope;
  const platen = cyl(0.019, 0.019, 0.37, black, 0, 0, 0, g, 28); platen.rotation.z = Math.PI / 2; platen.position.copy(onTop(slotT, 0, 0.0)); platen.position.y -= 0.012;
  const bail = cyl(0.0022, 0.0022, 0.36, M.grey, 0, 0, 0, g, 8); bail.rotation.z = Math.PI / 2; bail.position.copy(onTop(slotT - 0.1, 0, 0.004));
  for (const bx of [-0.08, 0.08]) { const r = cyl(0.006, 0.006, 0.012, black, bx, 0, 0, g, 12); r.rotation.z = Math.PI / 2; r.position.copy(onTop(slotT - 0.1, bx, 0.004)); }
  // raised lid edge behind the slot
  const lid = box(0.42, 0.012, 0.02, cream, 0, 0, 0, g); lid.position.copy(onTop(0.95, 0, 0.004)); lid.rotation.x = slope;
  // platen knob on the right side, ribbed
  const knob = new THREE.Group(); knob.position.set(0.238, slotPos.y - 0.012, slotPos.z); g.add(knob);
  const kb = cyl(0.022, 0.022, 0.03, M.grey, 0, 0, 0, knob, 24); kb.rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0222, 0.0018, 6, 28), M.darkgrey); r.rotation.y = Math.PI / 2; r.position.x = -0.011 + i * 0.0075; knob.add(r); }
  const cap = cyl(0.016, 0.019, 0.006, M.grey, 0.018, 0, 0, knob, 24); cap.rotation.z = Math.PI / 2;
  // paper release lever, left
  const lever = slab(0.012, 0.035, 0.022, 0.004, cream, 0.002); lever.position.copy(onTop(0.8, -0.205, 0.012)); lever.rotation.x = -0.4; g.add(lever);

  // LCD window with bezel
  const lcdPos = onTop(0.36, 0, 0.0018);
  const bez = slab(0.145, 0.006, 0.04, 0.004, makeInk({ color: '#B9B3A5', wash: 0.6 }), 0.0015); bez.position.copy(lcdPos); bez.position.y -= 0.002; bez.rotation.x = slope; g.add(bez);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.128, 0.022), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false }));
  lcd.position.copy(lcdPos); lcd.position.y += 0.0022; lcd.rotation.x = -Math.PI / 2 + slope; g.add(lcd);

  // keys
  const keys = [];
  ROWS.forEach((row, r) => row.forEach(([label, units, main, second, input]) => keys.push({ r, label, units, main, second, input })));
  const { tex, W, H } = legendAtlas(keys);
  const keyMat = makeInk({ color: '#ffffff', wash: 0.85, map: tex, hatch: 0.75 });
  const keyMap = new Map();
  const rowX0 = -0.012 - 7 * U;
  const byRow = [0, 1, 2, 3, 4].map((r) => keys.filter((k) => k.r === r));
  byRow.forEach((row, r) => {
    let x = rowX0;
    const z = -0.003 + r * U + 0.004;
    for (const k of row) {
      const w = k.units * U - 0.0018;
      const m = new THREE.Mesh(keycapGeometry(w, k.rect, W, H), keyMat);
      m.castShadow = true; m.receiveShadow = true;
      // sculpted rows: each row tilts a little differently, like a real cylindrical keyboard
      m.rotation.x = 0.1 + (r - 2) * 0.05;
      m.position.set(x + (k.units * U) / 2, deckTop(z) + KEY_H / 2 + 0.001 + (r === 4 ? -0.001 : 0), z);
      m.userData.rest = m.position.y;
      g.add(m);
      if (k.input) keyMap.set(k.input, m);
      if (k.label === 'ShiftL') keyMap.set('Shift', m);
      x += k.units * U;
    }
  });
  // Return: tall key spanning rows 1–2 at the right end
  {
    const k = { units: 1.25, main: 'Return', second: 'Reloc', label: 'Return' };
    const atlas = legendAtlas([k]);
    const geo = new THREE.BoxGeometry(1.25 * U - 0.0018, KEY_H, 2 * U - 0.0018);
    const mat = makeInk({ color: '#ffffff', wash: 0.85, map: atlas.tex, hatch: 0.75 });
    const uv = geo.attributes.uv, nrm = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) if (nrm.getY(i) < 0.5) uv.setXY(i, 0.99, 0.01); else uv.setXY(i, uv.getX(i) * (k.rect[2] / atlas.W), 1 - k.rect[3] / atlas.H + uv.getY(i) * (k.rect[3] / atlas.H));
    const m = new THREE.Mesh(geo, mat);
    const z = -0.003 + 1.5 * U + 0.004;
    m.position.set(rowX0 + 12.75 * U + (1.25 * U) / 2, deckTop(z) + KEY_H / 2 + 0.001, z); m.rotation.x = 0.07;
    m.castShadow = true; m.userData.rest = m.position.y; g.add(m);
    keyMap.set('Enter', m);
  }

  // status panel on the right of the keyboard: MEM / TYPE / power with LEDs and a rocker
  const panel = slab(0.036, 0.006, 0.05, 0.004, makeInk({ color: '#DAD5CB', wash: 0.5 }), 0.0015);
  panel.position.set(0.205, deckTop(0.06) + 0.003, 0.06); panel.rotation.x = 0.1; g.add(panel);
  const ledOn = makeInk({ color: '#3FCF5A', emissive: 1.5 }), ledOff = makeInk({ color: '#5A6A50', wash: 0.8 });
  const leds = [0, 1, 2].map((i) => { const l = cyl(0.0018, 0.0018, 0.002, i === 1 ? ledOn : ledOff, 0.193, deckTop(0.045 + i * 0.012) + 0.007, 0.045 + i * 0.012, g, 8); return l; });
  const rocker = slab(0.016, 0.006, 0.03, 0.003, M.white, 0.0015); rocker.position.set(0.213, deckTop(0.06) + 0.008, 0.06); rocker.rotation.x = 0.1; g.add(rocker);
  // rubber feet
  for (const [fx, fz] of [[-0.2, 0.12], [0.2, 0.12], [-0.2, -0.18], [0.2, -0.18]]) cyl(0.01, 0.01, 0.004, M.black, fx, -0.001, fz, g, 10);
  // power cord out the back
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0.2, 0.02, -0.21), new THREE.Vector3(0.22, 0.008, -0.26), new THREE.Vector3(0.3, 0.005, -0.27), new THREE.Vector3(0.45, 0.005, -0.25)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 30, 0.0028, 6), M.black));

  // print carrier visible in the slot
  const head = box(0.03, 0.012, 0.02, dark, 0, 0, 0, g); head.position.copy(onTop(slotT, 0, -0.004)); head.rotation.x = slope;

  return { keyMap, lcd, head, slotPos: onTop(slotT, 0, 0), slope, leds };
}
