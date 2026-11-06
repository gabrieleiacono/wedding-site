// The couple's own typewriter: a Smith Corona XD 4950 "Word Processing Typewriter", Italian edition,
// modelled from Atom's photos. Cream upper housing with the black SMITH CORONA badge and the grey/red
// XD 4950 lettering; a grey deck with the keyboard well, two vented grilles either side of the green
// one-line LCD and its indicator row; Italian QZERTY keys with black and red legends; the slide power
// switch on the left of the keyboard; the big knurled platen knob on the right side.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk } from './ink.js';
import { M, box, cyl, slab, profile } from './room.js';

const U = 0.0236;        // key pitch (m)
const KEY_D = 0.0214;    // keycap depth at the base
const KEY_H = 0.011;
const KX = 0.008;        // the keyboard sits a little right of centre, the power switch takes the left margin

const RED = '#C23A3F', INKC = '#1A1714';
const SANS = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';

// Canvas textures are drawn once now, and again once the web fonts have arrived (or the badge would
// be stuck in a fallback face).
const FONTS = ['600 40px "IBM Plex Sans"', 'italic 600 40px "IBM Plex Sans"', '500 20px "IBM Plex Sans"', '500 20px "IBM Plex Mono"'];
const fontsReady = (typeof document !== 'undefined' && document.fonts?.load)
  ? Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => null)))
  : Promise.resolve();
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const paint = () => { x.save(); x.clearRect(0, 0, w, h); draw(x, w, h); x.restore(); tex.needsUpdate = true; };
  paint(); fontsReady.then(paint);
  return tex;
}

// The spell-check mark printed on the Shift keys and above the LCD: an S with a stroke through it.
function spellMark(x, px, py, size, color, crossed = true) {
  x.save(); x.fillStyle = color; x.strokeStyle = color; x.font = `italic 600 ${size}px ${SANS}`; x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillText('S', px, py);
  if (crossed) { x.lineWidth = Math.max(2, size * 0.09); x.beginPath(); x.moveTo(px - size * 0.4, py + size * 0.35); x.lineTo(px + size * 0.4, py - size * 0.35); x.stroke(); }
  x.restore();
}

// Keys, left to right, as on the real Italian keyboard: units, main legend (black, top left), low
// legend (black, bottom left), red legend (bottom right), and the characters that press it.
const k = (units, main, low, red, input, extra = {}) => ({ units, main, low, red, input: [].concat(input || []), ...extra });
const dual = (top, bottom, red = '') => k(1, top, bottom, red, [top, bottom.toUpperCase(), bottom]);
const letter = (c, red = '') => k(1, c, '', red, [c]);
const ROWS = [
  [k(1, '|≡', '', '', []),
    ...[['1', '*'], ['2', 'é'], ['3', '"'], ['4', "'"], ['5', '('], ['6', '_'], ['7', 'è'], ['8', '^'], ['9', 'ç'], ['0', 'à'], ['°', ')'], ['+', '–']].map(([a, b]) => dual(a, b)),
    k(1, '⇦', '', '', ['Backspace'], { big: true })],
  [k(1.5, 'TAB', '', 'TAB', []),
    ...[['Q'], ['Z'], ['E', '◪'], ['R', 'c?'], ['T', '§'], ['Y', '&'], ['U', '½'], ['I', '£'], ['O', '$'], ['P']].map(([c, r]) => letter(c, r)),
    dual('=', 'ì'),
    k(1.5, '↵', '', '', ['Enter'], { big: true, ret: 'top' })],
  [k(1.75, '', '', '', [], { lock: true }),
    ...[['A'], ['S', '▰'], ['D', '←'], ['F', '⇒'], ['G'], ['H', '↔'], ['J', '→'], ['K'], ['L', '◇'], ['M']].map(([c, r]) => letter(c, r)),
    dual('%', 'ù'),
    k(1.25, '', '', '→', [], { ret: 'bottom' })],
  [k(2.25, '⇧', '', '', ['Shift'], { big: true, spell: true }),
    ...[['W'], ['X', '⁝'], ['C', '◺'], ['V', '◐'], ['B', '✖'], ['N', '■']].map(([c, r]) => letter(c, r)),
    dual('?', ',', '<'), dual('·', ';', '>'), dual('/', ':'), dual('!', 'ò'),
    k(1.75, '⇧', '', '', [], { big: true, spell: true })],
  [k(0.5, '', '', '', [], { gap: true }),
    k(1.5, '', '', '⇧⇧', []),
    k(1.5, '⇤', '', '⇥', [], { big: true }),
    k(7.25, '', '', '½', [' ']),
    k(1.75, '', '', '', [], { xx: true }),
    k(1.5, '⌧', '', '', [], { big: true })],
];

/** Keycap: a tapered block whose top face shows its cell of the legend atlas. */
function keycapGeometry(w, rect, atlasW, atlasH, d = KEY_D) {
  const g = new THREE.BoxGeometry(w, KEY_H, d, 2, 1, 2);
  const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
  const sx = (w - 0.0042) / w, sz = (d - 0.0042) / d;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      pos.setX(i, pos.getX(i) * sx);
      pos.setZ(i, pos.getZ(i) * sz - 0.0008);
      // a shallow dish in the top
      const dx = pos.getX(i) / (w * sx / 2), dz = pos.getZ(i) / (d * sz / 2);
      if (Math.abs(dx) < 0.99 && Math.abs(dz) < 0.99) pos.setY(i, y - 0.0007);
    }
  }
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
  const W = 2048, H = 512, cell = 92, rowH = Math.round(cell * 1.6);
  // lay the cells out first: the rects are needed before the fonts arrive
  let cx = 0, cy = 0;
  for (const key of keys) {
    const w = Math.round(key.units * cell), h = key.ret === 'bottom' ? rowH : cell;
    if (cx + w > W - 8) { cx = 0; cy += rowH; }
    key.rect = [cx, cy, cx + w, cy + h];
    cx += w;
  }
  const tex = canvasTexture(W, H, (x) => {
    x.fillStyle = '#ECE7DA'; x.fillRect(0, 0, W, H);
    for (const key of keys) {
      const [cx, cy, cx1, cy1] = key.rect, w = cx1 - cx, h = cy1 - cy;
      // soft shading towards the edges of the cap (it reads as a sculpted top under the hatching)
      const gr = x.createRadialGradient(cx + w / 2, cy + h / 2, cell * 0.2, cx + w / 2, cy + h / 2, cell * 0.8);
      gr.addColorStop(0, '#F1ECE0'); gr.addColorStop(1, '#DED7C8');
      x.fillStyle = gr; x.fillRect(cx, cy, w, h);
      const pad = 13;
      x.textBaseline = 'top'; x.textAlign = 'left'; x.fillStyle = INKC;
      if (key.main) {
        const big = key.main.length <= 2;
        x.font = big ? `500 ${key.big ? 44 : 38}px ${SANS}` : `600 17px ${SANS}`;
        x.fillText(key.main, cx + pad, cy + pad - (big ? 4 : 0));
      }
      if (key.low) { x.font = `500 30px ${SANS}`; x.fillText(key.low, cx + pad + 2, cy + cell - 44); }
      if (key.red === '⇧⇧') { x.fillStyle = RED; x.textAlign = 'center'; x.font = `500 46px ${SANS}`; x.fillText('⇧⇧', cx + w / 2, cy + 18); }
      else if (key.red) {
        x.fillStyle = RED; x.textAlign = 'right';
        x.font = key.red.length > 2 ? `italic 600 18px ${SANS}` : `600 ${key.red === '½' ? 22 : 26}px ${SANS}`;
        if (key.red === 'TAB') x.font = `italic 600 17px ${SANS}`;
        x.fillText(key.red, cx + w - pad, cy + (key.ret === 'bottom' ? h - 46 : cell - 36));
      }
      if (key.spell) spellMark(x, cx + w - 26, cy + cell - 28, 30, RED);
      if (key.lock) { // the circled shift-lock arrow, with its little lamp
        x.strokeStyle = INKC; x.lineWidth = 2; x.setLineDash([5, 4]);
        x.beginPath(); x.arc(cx + 46, cy + cell / 2, 26, 0, 7); x.stroke(); x.setLineDash([]);
        x.font = `500 34px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⇧', cx + 46, cy + cell / 2 + 2);
        x.beginPath(); x.arc(cx + 92, cy + 26, 5, 0, 7); x.fillStyle = '#5E5A55'; x.fill();
      }
      if (key.xx) { // the word / line eraser: XX above, a red XXX tag below
        x.lineWidth = 2.5; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `600 18px ${SANS}`;
        const mx = cx + w / 2;
        x.strokeStyle = INKC; x.strokeRect(mx - 26, cy + 14, 52, 26); x.fillStyle = INKC; x.fillText('XX', mx, cy + 28);
        x.strokeStyle = RED; x.strokeRect(mx - 34, cy + 50, 68, 26); x.fillStyle = RED; x.fillText('XXX', mx, cy + 64);
      }
    }
  });
  return { tex, W, H };
}

/** Grey band behind the keyboard: two vented grilles either side of the LCD bezel. */
function bandDecal(W, H, bez) {
  return canvasTexture(W, H, (x) => {
    for (const [x0, x1] of [[56, bez[0] - 34], [bez[2] + 34, W - 56]]) {
      const y0 = bez[1] + 6, y1 = bez[3] - 6;
      x.fillStyle = 'rgba(60,58,55,0.18)'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let y = y0 + 6; y < y1 - 3; y += 11) {
        x.fillStyle = 'rgba(40,38,36,0.55)'; x.fillRect(x0 + 4, y, x1 - x0 - 8, 3);
        x.fillStyle = 'rgba(235,233,228,0.45)'; x.fillRect(x0 + 4, y + 4, x1 - x0 - 8, 2);
      }
      x.strokeStyle = 'rgba(40,38,36,0.6)'; x.lineWidth = 2; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
  });
}

/** The lighter bezel round the LCD, with the indicator row printed above the glass. */
function bezelDecal(W, H, lcdRect) {
  return canvasTexture(W, H, (x) => {
    x.fillStyle = '#B7B5B0'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(70,68,64,0.5)'; x.lineWidth = 3; x.strokeRect(2, 2, W - 4, H - 4);
    const [lx0, ly0, lx1, ly1] = lcdRect;
    x.fillStyle = '#4B4C45'; x.fillRect(lx0 - 5, ly0 - 5, lx1 - lx0 + 10, ly1 - ly0 + 10);
    // indicator row, spaced as on the machine (fractions of the LCD's width)
    const y = ly0 - 28, at = (f) => lx0 + f * (lx1 - lx0);
    spellMark(x, at(0.058), y, 30, '#2E2D2A', false);
    spellMark(x, at(0.13), y, 30, '#2E2D2A', true);
    x.fillStyle = '#2E2D2A'; x.font = `600 26px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    [['10', 0.255], ['12', 0.327], ['15', 0.405], ['1', 0.518], ['1½', 0.591], ['2', 0.673]].forEach(([t, f]) => x.fillText(t, at(f), y));
    [[0.79, 4], [0.867, 6], [0.945, 9]].forEach(([f, r]) => { x.beginPath(); x.arc(at(f), y, r, 0, 7); x.fill(); });
  });
}

function roundRect(x, px, py, w, h, r) {
  x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
}

/** Cream upper housing: the badge, the model lettering and the ruler in front of the paper slot. */
function housingDecal(W, H, rulerY) {
  return canvasTexture(W, H, (x) => {
    // ruler on the paper bail bar: white ticks on black
    x.fillStyle = '#26252A'; x.fillRect(300, rulerY, 1450, 34);
    x.fillStyle = '#E8E4DA'; x.font = `500 17px "IBM Plex Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'top';
    for (let i = -10; i <= 100; i++) {
      const px = 330 + (i + 10) * 12.4;
      x.fillRect(px, rulerY + 2, 2, i % 10 === 0 ? 13 : i % 5 === 0 ? 9 : 5);
      if (i % 10 === 0) x.fillText(String(Math.abs(i)), px, rulerY + 15);
    }
    // badge: SMITH CORONA, white on black, in a bevelled frame
    const bx = 222, by = H - 140, bw = 330, bh = 92;
    x.fillStyle = 'rgba(90,86,78,0.35)'; roundRect(x, bx - 8, by - 8, bw + 16, bh + 16, 10); x.fill();
    x.fillStyle = '#222226'; roundRect(x, bx, by, bw, bh, 6); x.fill();
    // the logo: a square of white rules, horizontal at top and bottom, vertical in the middle
    const lx = bx + 18, ly = by + 16, lw = 88, lh = bh - 32;
    x.fillStyle = '#ECEAE4';
    for (let i = 0; i < 3; i++) { x.fillRect(lx, ly + i * 6, lw, 3); x.fillRect(lx, ly + lh - 3 - i * 6, lw, 3); }
    for (let i = 0; i < 11; i++) x.fillRect(lx + 6 + i * 7.4, ly + 19, 3, lh - 38);
    x.fillRect(lx, ly + 19, 3, lh - 38); x.fillRect(lx + lw - 3, ly + 19, 3, lh - 38);
    // the name, wide and heavy
    x.save(); x.translate(bx + 122, by + bh / 2); x.scale(1.22, 1);
    x.font = `600 31px ${SANS}`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.lineWidth = 1.6; x.strokeStyle = '#ECEAE4';
    for (const [t, ty] of [['SMITH', -4], ['CORONA', 30]]) { x.fillText(t, 0, ty); x.strokeText(t, 0, ty); }
    x.restore();
    // model lettering, right: XD in grey, 4950 outlined in red, then the two descriptive lines
    const mx = 1478, base = H - 58;
    x.save(); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.font = `italic 600 58px ${SANS}`; x.fillStyle = '#5C5A57'; x.fillText('XD', mx, base - 78);
    const xw = x.measureText('XD ').width;
    x.lineWidth = 3; x.strokeStyle = RED; x.fillStyle = '#E8E2D3'; x.lineJoin = 'round';
    x.fillText('4950', mx + xw, base - 78); x.strokeText('4950', mx + xw, base - 78);
    x.fillStyle = '#5C5A57'; x.font = `italic 500 31px ${SANS}`; x.fillText('Word Processing Typewriter', mx, base - 36);
    x.font = `italic 500 26px ${SANS}`; const line = 'Spell · Right Dictionary'; x.fillText(line, mx, base);
    const lw2 = x.measureText(line + ' ').width; // the little dictionary icon
    x.beginPath(); x.moveTo(mx + lw2 + 6, base); x.lineTo(mx + lw2 + 30, base); x.lineTo(mx + lw2 + 36, base - 18); x.lineTo(mx + lw2 + 12, base - 18); x.closePath(); x.fill();
    x.restore();
  });
}

/** The function legends above the number row: icons along a red rule, as on the machine. */
function functionStrip() {
  return canvasTexture(2048, 96, (x) => {
    x.fillStyle = '#B2B0AB'; x.fillRect(0, 0, 2048, 96);
    x.fillStyle = 'rgba(60,58,55,0.5)'; x.fillRect(0, 0, 2048, 3); x.fillRect(0, 93, 2048, 3);
    x.fillStyle = RED; x.fillRect(60, 22, 1928, 3);
    x.fillStyle = '#2E2D2A'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const items = ['▰ⁿ', 'AUTO ↵', '≡|≡', 'u', 'uu', 'AUTO ½', '⇞', '⇟', 'xₓ', 'xˣ', '→', '≢', '≣'];
    items.forEach((t, i) => {
      const px = 120 + i * 150, py = 60;
      if (t === 'u' || t === 'uu') { // x x with one or two underlines
        x.font = `600 26px ${SANS}`; x.fillText('x x', px, py - 4);
        x.fillRect(px - 26, py + 10, 52, 3); if (t === 'uu') x.fillRect(px - 26, py + 16, 52, 3);
        return;
      }
      x.font = t.startsWith('AUTO') ? `600 20px ${SANS}` : `600 30px ${SANS}`;
      x.fillText(t, px, py);
    });
  });
}

/** Tiny icons beside the power slider: the three switch positions. */
function switchDecal() {
  return canvasTexture(128, 256, (x) => {
    x.fillStyle = '#2E2D2A'; x.strokeStyle = '#2E2D2A'; x.lineWidth = 4;
    x.font = `600 40px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('≣', 34, 40); x.fillText('≡', 34, 104);
    x.beginPath(); x.arc(34, 172, 13, -1.1, 4.2); x.stroke(); x.fillRect(32, 152, 4, 18); // power symbol
  });
}

export function buildTypewriterModel(g, lcdTex) {
  const cream = makeInk({ color: '#E6DFCE', wash: 0.5, lift: 0.12, hatch: 0.7 });
  const grey = makeInk({ color: '#A19F9A', wash: 0.6, lift: 0.08, hatch: 0.7 });
  const knobGrey = makeInk({ color: '#9B9995', wash: 0.65 });
  const dark = makeInk({ color: '#4A4846', wash: 0.85 });
  const black = M.black;

  // bottom tray (cream), keyboard deck (grey)
  const tray = slab(0.47, 0.022, 0.37, 0.025, cream, 0.006); tray.position.set(0, 0.011, -0.025); g.add(tray);
  const deckTop = (z) => 0.062 - (z + 0.03) * 0.1; // the deck slopes down towards you (bevel included)
  const dp = (z) => deckTop(z) - 0.006;
  g.add(profile([[-0.03, 0.018], [-0.03, dp(-0.03)], [0.13, dp(0.13)], [0.148, 0.034], [0.15, 0.018]], 0.455, grey, 0.006));
  // keyboard recess: a dark well framed by the deck
  const well = slab(0.35, 0.012, 0.13, 0.008, dark, 0.002); well.position.set(KX, deckTop(0.057) - 0.004, 0.057); well.rotation.x = 0.1; g.add(well);
  // the function strip between the band and the keys
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.016), makeInk({ color: '#ffffff', wash: 0.8, map: functionStrip(), hatch: 0.6 }));
  strip.position.set(KX, deckTop(-0.018) + 0.0012, -0.018); strip.rotation.x = -Math.PI / 2 + 0.1; g.add(strip);

  // housing: a sloped top with a short vertical front. The front part, as far as the split, is the grey
  // band with the grilles and the LCD; behind it the cream cover stands a few millimetres proud.
  const B = [-0.03, 0.08], C = [-0.205, 0.118];
  const SPLIT = 0.42, DROP = 0.004;
  const slope = Math.atan2(C[1] - B[1], B[0] - C[0]);
  const slopeLen = Math.hypot(C[1] - B[1], B[0] - C[0]);
  const onTop = (t, x = 0, lift = 0.0015) => {
    const z = B[0] + (C[0] - B[0]) * t, y = B[1] + (C[1] - B[1]) * t;
    return new THREE.Vector3(x, y + lift + 0.008, z);
  };
  const S = [B[0] + (C[0] - B[0]) * SPLIT, B[1] + (C[1] - B[1]) * SPLIT];
  g.add(profile([[-0.022, 0.03], [B[0], B[1] - DROP], [S[0], S[1] - DROP], [S[0], 0.03]], 0.46, grey, 0.008));
  g.add(profile([[S[0], 0.03], [S[0], S[1]], [C[0] + 0.01, C[1]], [C[0], C[1] - 0.012], [C[0], 0.03]], 0.46, cream, 0.008));
  const PXM = 2048 / 0.44; // decal pixels per metre
  const decalPlane = (tex, t0, t1, lift) => {
    const len = (t1 - t0) * slopeLen;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, len), makeInk({ color: '#ffffff', wash: 0.9, map: tex, transparent: true, opacity: 1, hatch: 0.8 }));
    m.material.depthWrite = true;
    m.position.copy(onTop((t0 + t1) / 2, 0, lift)); m.rotation.x = -Math.PI / 2 + slope; g.add(m);
    return m;
  };
  // the band: LCD bezel centred on it, grilles either side
  const T_LCD = 0.215;
  const bandH = Math.round(SPLIT * slopeLen * PXM);
  const bezW = 0.15, bezD = 0.04;
  const bezY = (SPLIT - T_LCD) * slopeLen * PXM; // bezel centre, px from the band's back edge
  const bezRect = [1024 - bezW / 2 * PXM, bezY - bezD / 2 * PXM, 1024 + bezW / 2 * PXM, bezY + bezD / 2 * PXM];
  decalPlane(bandDecal(2048, bandH, bezRect), 0, SPLIT, 0.0015 - DROP);
  // the cream cover
  const T_SLOT = 0.78;
  const coverH = Math.round((1 - SPLIT) * slopeLen * PXM);
  const rulerY = Math.round((1 - T_SLOT) * slopeLen * PXM + 0.018 * PXM + 2);
  decalPlane(housingDecal(2048, coverH, rulerY), SPLIT, 1, 0.0015);

  // paper slot: a dark opening with the platen just showing, and the clear bail
  const slotPos = onTop(T_SLOT, 0, -0.002);
  const slot = box(0.38, 0.01, 0.036, M.black, 0, 0, 0, g); slot.position.copy(slotPos); slot.rotation.x = slope;
  const platen = cyl(0.019, 0.019, 0.37, black, 0, 0, 0, g, 28); platen.rotation.z = Math.PI / 2; platen.position.copy(onTop(T_SLOT, 0, 0.0)); platen.position.y -= 0.012;
  const bail = cyl(0.0022, 0.0022, 0.36, M.grey, 0, 0, 0, g, 8); bail.rotation.z = Math.PI / 2; bail.position.copy(onTop(T_SLOT - 0.1, 0, 0.004));
  for (const bx of [-0.08, 0.08]) { const r = cyl(0.006, 0.006, 0.012, black, bx, 0, 0, g, 12); r.rotation.z = Math.PI / 2; r.position.copy(onTop(T_SLOT - 0.1, bx, 0.004)); }
  // raised lid edge behind the slot, and the grey paper rest standing behind the sheet
  const lid = box(0.42, 0.012, 0.02, cream, 0, 0, 0, g); lid.position.copy(onTop(0.95, 0, 0.004)); lid.rotation.x = slope;
  const rest = slab(0.3, 0.004, 0.06, 0.004, makeInk({ color: '#CFCDC7', wash: 0.45, lift: 0.4 }), 0.0015);
  rest.position.set(0, slotPos.y + 0.034, slotPos.z - 0.044); rest.rotation.x = Math.PI / 2 + 0.42; g.add(rest);
  // platen knob on the right side: a big grey disc with a knurled rim and a dished face
  const knob = new THREE.Group(); knob.position.set(0.236, slotPos.y - 0.016, slotPos.z + 0.006); g.add(knob);
  const kb = cyl(0.026, 0.026, 0.022, knobGrey, 0, 0, 0, knob, 32); kb.rotation.z = Math.PI / 2;
  const ribGeo = new THREE.BoxGeometry(0.02, 0.003, 0.0026);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, r = new THREE.Mesh(ribGeo, M.darkgrey);
    r.position.set(0.001, Math.cos(a) * 0.0262, Math.sin(a) * 0.0262); r.rotation.x = a; knob.add(r);
  }
  const face = cyl(0.021, 0.024, 0.004, M.grey, 0.013, 0, 0, knob, 32); face.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0012, 6, 28), M.darkgrey); hub.rotation.y = Math.PI / 2; hub.position.x = 0.0152; knob.add(hub);
  // paper release lever, left
  const lever = slab(0.012, 0.035, 0.022, 0.004, cream, 0.002); lever.position.copy(onTop(0.8, -0.205, 0.012)); lever.rotation.x = -0.4; g.add(lever);

  // LCD in its bezel, a little forward of the bezel's centre to leave room for the indicator row
  const bezPos = onTop(T_LCD, 0, 0.0018 - DROP);
  const bez = slab(bezW, 0.006, bezD, 0.004, makeInk({ color: '#B7B5B0', wash: 0.6 }), 0.0015); bez.position.copy(bezPos); bez.position.y -= 0.002; bez.rotation.x = slope; g.add(bez);
  const LCD_W = 0.128, LCD_H = 0.022, LCD_OFF = -0.0045; // along the slope, negative = towards you
  const BPX = 1024 / bezW;
  const lcdRect = [(bezW - LCD_W) / 2 * BPX, (bezD / 2 - LCD_OFF - LCD_H / 2) * BPX, (bezW + LCD_W) / 2 * BPX, (bezD / 2 - LCD_OFF + LCD_H / 2) * BPX];
  const bezTop = new THREE.Mesh(new THREE.PlaneGeometry(bezW - 0.003, bezD - 0.003), makeInk({ color: '#ffffff', wash: 0.85, map: bezelDecal(1024, Math.round(bezD * BPX), lcdRect), hatch: 0.6 }));
  bezTop.position.copy(bezPos); bezTop.position.y += 0.0013; bezTop.rotation.x = -Math.PI / 2 + slope; g.add(bezTop);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(LCD_W, LCD_H), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false }));
  lcd.position.copy(onTop(T_LCD + LCD_OFF / slopeLen, 0, 0.0018 - DROP)); lcd.position.y += 0.0022; lcd.rotation.x = -Math.PI / 2 + slope; g.add(lcd);

  // keys
  const keys = [];
  ROWS.forEach((row, r) => row.forEach((key) => { key.r = r; if (!key.gap) keys.push(key); }));
  const { tex, W, H } = legendAtlas(keys);
  const keyMat = makeInk({ color: '#ffffff', wash: 0.85, map: tex, hatch: 0.75 });
  const keyMap = new Map();
  const rowX0 = KX - 7 * U;
  const rowZ = (r) => -0.003 + r * U + 0.004;
  const rowTilt = (r) => 0.1 + (r - 2) * 0.05; // sculpted rows: each tilts a little differently
  let retTop = null;
  ROWS.forEach((row, r) => {
    let x = rowX0;
    for (const key of row) {
      if (key.gap) { x += key.units * U; continue; }
      const w = key.units * U - 0.0018;
      // the bottom half of the L-shaped Return reaches back to merge with its top half
      const reach = key.ret === 'bottom' ? U * 0.62 : 0;
      const m = new THREE.Mesh(keycapGeometry(w, key.rect, W, H, KEY_D + reach), keyMat);
      m.castShadow = true; m.receiveShadow = true;
      m.rotation.x = rowTilt(r);
      const z = rowZ(r) - reach / 2;
      m.position.set(x + (key.units * U) / 2, deckTop(z) + KEY_H / 2 + 0.001 + (r === 4 ? -0.001 : 0), z);
      m.userData.rest = m.position.y;
      g.add(m);
      if (key.ret === 'top') retTop = m;
      if (key.ret === 'bottom' && retTop) { g.updateMatrixWorld(true); retTop.attach(m); } // one key: both halves go down together
      for (const ch of key.input) keyMap.set(ch, m);
      x += key.units * U;
    }
  });

  // power: a slide switch on the deck, left of the keyboard, with its three positions printed beside it
  const swZ = 0.072, swX = -0.199;
  const swSlot = slab(0.008, 0.004, 0.034, 0.002, M.black, 0.001); swSlot.position.set(swX + 0.006, deckTop(swZ) + 0.0005, swZ); swSlot.rotation.x = 0.1; g.add(swSlot);
  const slider = slab(0.011, 0.007, 0.012, 0.002, makeInk({ color: '#E9E5DA', wash: 0.4 }), 0.0015); slider.position.set(swX + 0.006, deckTop(swZ + 0.01) + 0.003, swZ + 0.01); slider.rotation.x = 0.1; g.add(slider);
  const icons = new THREE.Mesh(new THREE.PlaneGeometry(0.009, 0.018), makeInk({ color: '#ffffff', wash: 0.8, map: switchDecal(), transparent: true, hatch: 0.5 }));
  icons.position.set(swX - 0.006, deckTop(swZ) + 0.0012, swZ); icons.rotation.x = -Math.PI / 2 + 0.1; g.add(icons);

  // rubber feet
  for (const [fx, fz] of [[-0.2, 0.12], [0.2, 0.12], [-0.2, -0.18], [0.2, -0.18]]) cyl(0.01, 0.01, 0.004, M.black, fx, -0.001, fz, g, 10);
  // power cord out the back
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0.2, 0.02, -0.21), new THREE.Vector3(0.22, 0.008, -0.26), new THREE.Vector3(0.3, 0.005, -0.27), new THREE.Vector3(0.45, 0.005, -0.25)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 30, 0.0028, 6), M.black));

  // print carrier visible in the slot
  const head = box(0.03, 0.012, 0.02, dark, 0, 0, 0, g); head.position.copy(onTop(T_SLOT, 0, -0.004)); head.rotation.x = slope;

  return { keyMap, lcd, head, slotPos: onTop(T_SLOT, 0, 0), slope };
}
