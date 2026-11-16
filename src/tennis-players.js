// The two tennis players of the console's game, in pixel art, seen from straight above (design: this file).
// Each frame every player is rasterised into a small grid of "art pixels" (G×G), each one drawn as a P×P square:
// head with hair and ears, shoulders that turn with the stroke, short-sleeved arms, shorts, legs and shoes that run,
// and a racket with see-through strings. Three tones per colour, lit from the top left of the court, a dark outline
// round the figure and its own silhouette as the shadow, like a 16-bit sprite.
// Local frame of a player: +u is where they face (the net), +v is their right hand. TU faces right; the console's
// player faces left, so its frame is turned half round (both are right-handed).

export const P = 3; // screen (layout) pixels per art pixel
const G = 56; // the sprite grid, in art pixels
export const SC = 1.5; // the figure's size: its measurements below are multiplied by this, in art pixels
const LIGHT = [-0.55, -0.83]; // towards the light, in court coordinates (top left)
const OUTLINE = [27, 18, 12];
const SHADOW_AT = [2, 2], SHADOW = 'rgba(8, 30, 14, 0.32)';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const tones = (light, base, dark) => [hex(light), hex(base), hex(dark)];

// TU: red polo, white shorts, dark hair under a white headband, and a wooden racket like the one on the wall
// CONSOLE: sky-blue shirt, navy shorts, a navy sun visor and a fair ponytail, and a black graphite racket
export const KITS = {
  me: {
    skin: tones('#F6CFA4', '#E2AE80', '#B07A52'),
    hair: tones('#7A4E2E', '#53321D', '#331E11'),
    shirt: tones('#F2664F', '#D3302A', '#8E1C19'),
    shorts: tones('#FFFFFF', '#E9E7DE', '#AFAB9E'),
    band: tones('#FFFFFF', '#F4F2EA', '#C9C5B8'),
    socks: tones('#FFFFFF', '#F1EFE6', '#C2BEB2'),
    shoes: tones('#FFFFFF', '#E6E4DC', '#A9A598'),
    accent: tones('#F2664F', '#D3302A', '#8E1C19'),
    frame: tones('#A8703C', '#73451F', '#45260F'),
    grip: tones('#F2664F', '#B8241F', '#7A1614'),
    strings: hex('#F4ECCF'),
  },
  cpu: {
    skin: tones('#F0C298', '#D49E72', '#A06E48'),
    hair: tones('#F6DC8E', '#D9B256', '#A07E30'),
    shirt: tones('#7FE6F6', '#2DB6D8', '#17789A'),
    shorts: tones('#3E4E92', '#24305E', '#151C3C'),
    visor: tones('#4A5BA6', '#24305E', '#151C3C'),
    socks: tones('#FFFFFF', '#F1EFE6', '#C2BEB2'),
    shoes: tones('#FFFFFF', '#E6E4DC', '#A9A598'),
    accent: tones('#7FE6F6', '#2DB6D8', '#17789A'),
    frame: tones('#6A6A76', '#3A3A42', '#1C1C22'),
    grip: tones('#F4F2EA', '#D8D4C8', '#9C988C'),
    strings: hex('#EDF2F2'),
  },
};

// --- poses ---------------------------------------------------------------------------------------------------
// a: the racket's direction (radians from +u towards +v), h: the racket hand, f: the other hand (null: on the racket), s: shoulder turn
const READY = { a: -0.35, h: [3.0, 1.8], f: null, s: 0 };
const STROKES = {
  // forehand: the racket goes back on the right, sweeps round to meet the ball beside the body, and finishes over the left shoulder
  fh: [
    { t: 0.3, a: 2.5, h: [-1.6, 6.0], f: [2.6, -5.0], s: 0.55 },
    { t: 0.5, a: 1.45, h: [1.8, 6.6], f: [1.2, -6.0], s: 0 },
    { t: 0.75, a: -1.15, h: [3.0, -2.2], f: [1.6, -4.0], s: -0.45 },
  ],
  // two-handed backhand: back on the left, out in front on the left, round to finish on the right
  bh: [
    { t: 0.3, a: -2.4, h: [-0.6, -3.4], f: null, s: -0.6 },
    { t: 0.5, a: -1.5, h: [2.4, -2.6], f: null, s: -0.25 },
    { t: 0.75, a: 1.0, h: [3.0, 3.0], f: null, s: 0.25 },
  ],
};
export const SWING_T = 0.42, CONTACT = 0.5; // a stroke takes SWING_T seconds and meets the ball halfway through

const ease = (x) => x * x * (3 - 2 * x);
const mix = (a, b, k) => a + (b - a) * k;
const mix2 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k)];
const dirOf = (a) => [Math.cos(a), Math.sin(a)];

function pose(p) {
  let q;
  if (!p.swing) q = { ...READY };
  else {
    const keys = [{ t: 0, ...READY }, ...STROKES[p.swing.type].map((k) => ({ ...k })), { t: 1, ...READY }];
    // the contact point follows the ball a little: the arm reaches out further or stays closer to the body
    keys[2].h = [keys[2].h[0], keys[2].h[1] + p.swing.reach];
    const t = Math.min(1, p.swing.t);
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const A = keys[i], B = keys[i + 1], k = ease((t - A.t) / (B.t - A.t));
    q = { a: mix(A.a, B.a, k), h: mix2(A.h, B.h, k), s: mix(A.s, B.s, k), f: null };
    const fa = A.f ?? onRacket(A), fb = B.f ?? onRacket(B);
    q.f = A.f || B.f ? mix2(fa, fb, k) : null;
  }
  const d = dirOf(q.a);
  if (!q.f) q.f = onRacket(q);
  // running: the free hand pumps, the racket bobs a little
  const run = p.run, ph = p.phase;
  if (!p.swing || p.swing.type === 'fh') q.f = [q.f[0] + Math.sin(ph) * 1.4 * run, q.f[1]];
  q.h = [q.h[0] - Math.sin(ph) * 0.5 * run, q.h[1]];
  q.d = d;
  return q;
}
function onRacket(k) { const d = dirOf(k.a); return [k.h[0] + d[0] * 1.8, k.h[1] + d[1] * 1.8]; }

// --- shapes (all in the local frame; each returns a normal [nu, nv] for the shading, or null) ---------------------------
function ellipse(u, v, cu, cv, ru, rv) {
  const nu = (u - cu) / ru, nv = (v - cv) / rv, r = nu * nu + nv * nv;
  return r <= 1 ? [nu, nv, r] : null;
}
// squarer than an ellipse: shoulders are broad and flat seen from above
function superellipse(u, v, cu, cv, ru, rv) {
  const nu = (u - cu) / ru, nv = (v - cv) / rv, r = Math.pow(Math.abs(nu), 2.6) + Math.pow(Math.abs(nv), 2.6);
  return r <= 1 ? [nu, nv, r] : null;
}
function capsule(u, v, a, b, rad) {
  const du = b[0] - a[0], dv = b[1] - a[1], L = du * du + dv * dv || 1;
  const k = Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / L));
  const pu = u - (a[0] + du * k), pv = v - (a[1] + dv * k), dist = Math.hypot(pu, pv);
  return dist <= rad ? [pu / rad, pv / rad, k] : null;
}
const rot = (p, s) => [p[0] * Math.cos(s) - p[1] * Math.sin(s), p[0] * Math.sin(s) + p[1] * Math.cos(s)];

/** One player's sprite: draws them centred on (x, y) of the court. */
export class PlayerSprite {
  constructor(kit, facing) {
    this.kit = kit; this.s = facing; // +1 faces right, -1 faces left (turned half round)
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = G;
    this.g = this.canvas.getContext('2d');
    this.img = this.g.createImageData(G, G);
    this.col = new Array(G * G); this.hole = new Uint8Array(G * G);
  }
  /** shade one tone set by the shape's normal, turned into court coordinates */
  tone(set, n) {
    const l = (n[0] * LIGHT[0] + n[1] * LIGHT[1]) * this.s;
    return l > 0.38 ? set[0] : l < -0.42 ? set[2] : set[1];
  }
  /** the colour of one art pixel at local (u, v), or 'hole' for the racket's open strings, or null */
  sample(u, v, q, p, i, j) {
    const K = this.kit, d = q.d, H = q.h;
    let n;
    // head, on top of everything: leaning a little over the toes
    const hc = [0.7, 0];
    if (K.visor) {
      // a sun visor over fair hair, and a ponytail that swings out behind as she runs
      const sway = Math.sin(p.phase * 0.5) * 1.2 * p.run;
      if ((n = ellipse(u, v, hc[0], 0, 2.5, 2.7))) {
        if (n[2] > 0.58 && n[0] > -0.35) return this.tone(K.visor, n); // the band round the front of the head
        if (Math.abs(n[1] - 0.1) < 0.12 && n[0] < 0.5) return K.hair[2]; // the hair drawn back
        return this.tone(K.hair, [n[0] * 0.8, n[1] * 0.8]);
      }
      if (u > hc[0] + 1.8 && (n = ellipse(u, v, hc[0] + 2.1, 0, 1.6, 2.2))) return this.tone(K.visor, [0.3, n[1] * 0.3]); // the peak
      if ((n = ellipse(u, v, hc[0] - 2.5, 0, 0.6, 0.9))) return K.visor[1]; // the scrunchie
      if ((n = capsule(u, v, [hc[0] - 2.6, 0], [hc[0] - 4.8, sway], 0.85))) return this.tone(K.hair, n);
      if ((n = ellipse(u, v, hc[0] + 0.3, 2.65, 0.7, 0.6)) || (n = ellipse(u, v, hc[0] + 0.3, -2.65, 0.7, 0.6))) return this.tone(K.skin, n);
    } else {
      if ((n = ellipse(u, v, hc[0], 0, 2.6, 2.75))) {
        if (n[0] > 0.62 && Math.abs(n[1]) < 0.62) return this.tone(K.skin, n); // forehead and nose
        if (n[2] > 0.6) return this.tone(K.band, n); // the headband, all round
        // a parting and a few strands
        if (Math.abs(n[1] + 0.15) < 0.12 && n[0] < 0.4) return K.hair[2];
        return this.tone(K.hair, n);
      }
      if ((n = ellipse(u, v, hc[0] + 0.3, 2.75, 0.7, 0.6)) || (n = ellipse(u, v, hc[0] + 0.3, -2.75, 0.7, 0.6))) return this.tone(K.skin, n);
    }
    // racket: grip, throat, then the head with its strings
    const at = (k) => [H[0] + d[0] * k, H[1] + d[1] * k];
    const hd = at(5.3), ru = 2.75, rv = 2.15;
    {
      const du = u - hd[0], dv = v - hd[1];
      const a = du * d[0] + dv * d[1], b = -du * d[1] + dv * d[0];
      const e = (a / ru) ** 2 + (b / rv) ** 2;
      if (e <= 1) {
        const inner = (a / (ru - 0.8)) ** 2 + (b / (rv - 0.8)) ** 2;
        if (inner > 1) return this.tone(K.frame, rot([a / ru, b / rv], Math.atan2(d[1], d[0])));
        return (i + j) % 2 ? K.strings : 'hole';
      }
    }
    if ((n = capsule(u, v, at(1.9), at(2.8), 0.55))) return this.tone(K.frame, n);
    if ((n = capsule(u, v, at(-0.7), at(1.9), 0.72))) {
      if (n[2] < 0.12) return K.grip[2]; // the butt cap
      return this.tone(K.grip, n);
    }
    // arms: hands and forearms in skin, sleeves in the shirt's colour from the shoulders
    const sR = rot([0.0, 4.2], q.s), sL = rot([0.0, -4.2], q.s);
    if ((n = ellipse(u, v, H[0], H[1], 0.95, 0.95))) return this.tone(K.skin, n);
    if ((n = ellipse(u, v, q.f[0], q.f[1], 0.9, 0.9))) return this.tone(K.skin, n);
    for (const [S, hand] of [[sR, H], [sL, q.f]]) {
      if ((n = capsule(u, v, S, hand, 0.78))) return n[2] < 0.3 ? this.tone(K.shirt, n) : this.tone(K.skin, n);
    }
    // shoulders and back, turned with the stroke, and the shorts just showing behind
    {
      const [tu, tv] = rot([u, v], -q.s);
      if ((n = superellipse(tu, tv, 0, 0, 2.1, 5.2))) {
        return this.tone(K.shirt, n);
      }
      if ((n = ellipse(tu, tv, -1.5, 0, 1.55, 3.1))) return this.tone(K.shorts, n);
    }
    // legs and shoes: in the ready stance the feet are wide apart; running, they swing to and fro
    const run = p.run, ph = p.phase;
    const feet = [
      [-0.9 + Math.sin(ph) * 2.4 * run, -6.6 + Math.cos(ph) * 1.0 * run],
      [-0.9 - Math.sin(ph) * 2.4 * run, 6.6 + Math.cos(ph) * 1.0 * run],
    ];
    for (const [k, F] of feet.entries()) {
      if ((n = ellipse(u, v, F[0] + 0.5, F[1], 1.55, 0.95))) {
        if (n[0] > 0.55) return K.shoes[2]; // the toe
        if (Math.abs(n[0]) < 0.25) return K.accent[1]; // the stripe
        return this.tone(K.shoes, n);
      }
      const hip = [-1.8, k ? 2.2 : -2.2];
      if ((n = capsule(u, v, hip, F, 0.9))) return n[2] > 0.78 ? this.tone(K.socks, n) : this.tone(K.skin, n);
    }
    return null;
  }
  draw(ctx, x, y, p) {
    const q = pose(p), s = this.s, col = this.col, hole = this.hole;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const wx = (i + 0.5 - G / 2) / SC, wy = (j + 0.5 - G / 2) / SC, c = this.sample(s * wx, s * wy, q, p, i, j);
      col[j * G + i] = c === 'hole' ? null : c; hole[j * G + i] = c === 'hole' ? 1 : 0;
    }
    const data = this.img.data; data.fill(0);
    const put = (k, c, a = 255) => { data[k * 4] = c[0]; data[k * 4 + 1] = c[1]; data[k * 4 + 2] = c[2]; data[k * 4 + 3] = a; };
    const filled = (i, j) => i >= 0 && j >= 0 && i < G && j < G && col[j * G + i];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i;
      if (col[k]) { put(k, col[k]); continue; }
      if (hole[k]) continue;
      if (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1)) put(k, OUTLINE);
    }
    this.g.putImageData(this.img, 0, 0);
    const ox = Math.round(x - (G * P) / 2), oy = Math.round(y - (G * P) / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // the shadow: the same silhouette, cast a little down and to the right
    ctx.globalCompositeOperation = 'source-over';
    if (!this.shadow) { this.shadow = document.createElement('canvas'); this.shadow.width = this.shadow.height = G; this.sg = this.shadow.getContext('2d'); }
    const sg = this.sg; sg.globalCompositeOperation = 'copy'; sg.drawImage(this.canvas, 0, 0);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = SHADOW; sg.fillRect(0, 0, G, G);
    ctx.drawImage(this.shadow, ox + SHADOW_AT[0] * P, oy + SHADOW_AT[1] * P, G * P, G * P);
    ctx.drawImage(this.canvas, ox, oy, G * P, G * P);
    ctx.restore();
  }
}

/** The ball, in the same pixels: a fuzzy yellow ball with its white seam, and its shadow on the court. */
export class BallSprite {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 8;
    const g = this.canvas.getContext('2d'), img = g.createImageData(8, 8), T = tones('#F6FF9C', '#DCE93A', '#97A21E');
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = i + 0.5 - 4, y = j + 0.5 - 4, r = Math.hypot(x, y), k = (j * 8 + i) * 4;
      let c = null;
      if (r <= 2.7) {
        const l = (x * LIGHT[0] + y * LIGHT[1]) / 2.7;
        c = l > 0.35 ? T[0] : l < -0.4 ? T[2] : T[1];
        if (Math.abs(Math.hypot(x + 2.6, y - 2.6) - 3.0) < 0.45) c = [250, 250, 240]; // the seam
      } else if (r <= 3.5) c = OUTLINE;
      if (c) { img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  }
  draw(ctx, x, y, z) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(8, 30, 14, 0.35)';
    const sx = Math.round(x / P) * P, sy = Math.round((y + 5) / P) * P;
    ctx.fillRect(sx - 2 * P, sy - P, 4 * P, 2 * P); ctx.fillRect(sx - P, sy - 2 * P, 2 * P, 4 * P);
    ctx.drawImage(this.canvas, Math.round(x - 4 * P), Math.round(y - z - 4 * P), 8 * P, 8 * P);
    ctx.restore();
  }
}
