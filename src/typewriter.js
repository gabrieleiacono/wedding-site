// The electronic typewriter (design F1 #1, F8): the RSVP.
// A one-line LCD asks the questions; your real keyboard (or the phone keyboard) drives the keys,
// each answer types onto the sheet, Return goes to the next question, and the sheet rolls out at the end.
import * as THREE from 'three';
import { makeInk, makeScreen } from './ink.js';
import { M, box, cyl, slab } from './room.js';

export const STEPS = [
  { id: 'name', q: 'COME TI CHIAMI?', label: 'NOME' },
  { id: 'coming', q: 'VERRAI? (S/N)', label: 'VIENE', yn: true },
  { id: 'count', q: 'IN QUANTI?', label: 'IN', numeric: true, onlyIfComing: true },
  { id: 'allergies', q: 'ALLERGIE?', label: 'ALLERGIE', onlyIfComing: true },
  { id: 'song', q: 'UNA CANZONE?', label: 'CANZONE', onlyIfComing: true },
  { id: 'message', q: 'UN MESSAGGIO?', label: 'MSG' },
];
const ROWS_KEYS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const PAPER_W = 0.21, PAPER_H = 0.297, LINE_H = 0.0135, MARGIN_TOP = 0.032, COLS = 27;
const TEX_W = 840, TEX_H = Math.round(TEX_W * PAPER_H / PAPER_W);

export class Typewriter {
  constructor(parent, audio) {
    this.audio = audio;
    this.group = new THREE.Group();
    this.group.position.set(0.0, 0.75, -1.43);
    parent.add(this.group);
    this.keys = new Map();
    this.pressed = [];
    this.build();
    this.reset();
    this.onDone = () => {};
    this.active = false;
  }

  build() {
    const g = this.group;
    const beige = makeInk({ color: '#D9D0BC', wash: 0.55 });
    const beigeDark = makeInk({ color: '#BDB39C', wash: 0.6 });
    const keyMat = makeInk({ color: '#5A5650', wash: 0.85 });
    const keyLight = makeInk({ color: '#CFC6B0', wash: 0.6 });
    // body: lower deck with the keyboard, raised back with the platen
    const base = slab(0.47, 0.065, 0.36, 0.035, beige, 0.01); base.position.set(0, 0.0325, 0); g.add(base);
    const back = slab(0.47, 0.06, 0.15, 0.03, beige, 0.012); back.position.set(0, 0.09, -0.1); g.add(back);
    box(0.44, 0.012, 0.03, beigeDark, 0, 0.068, 0.165, g);
    // keyboard: four rows + space bar, slightly stepped
    ROWS_KEYS.forEach((row, r) => {
      [...row].forEach((ch, i) => {
        const k = box(0.024, 0.014, 0.022, r === 0 ? keyLight : keyMat, -0.16 + r * 0.008 + i * 0.033, 0.072 + (3 - r) * 0.002, -0.025 + r * 0.03, g);
        k.userData.rest = k.position.y;
        this.keys.set(ch, k);
      });
    });
    const space = box(0.2, 0.014, 0.022, keyMat, 0, 0.072, 0.126, g); space.userData.rest = space.position.y; this.keys.set(' ', space);
    const ret = box(0.045, 0.014, 0.05, keyLight, 0.19, 0.074, 0.05, g); ret.userData.rest = ret.position.y; this.keys.set('Enter', ret);
    const bs = box(0.04, 0.014, 0.022, keyLight, 0.19, 0.075, -0.025, g); bs.userData.rest = bs.position.y; this.keys.set('Backspace', bs);
    const shiftL = box(0.04, 0.014, 0.022, keyLight, -0.2, 0.073, 0.065, g); shiftL.userData.rest = shiftL.position.y;
    // power LED
    this.led = box(0.006, 0.004, 0.006, makeInk({ color: '#E2412F', emissive: 1.6 }), 0.21, 0.07, 0.15, g);

    // LCD: one line, green
    this.lcdCanvas = document.createElement('canvas'); this.lcdCanvas.width = 1024; this.lcdCanvas.height = 96;
    this.lcdTex = new THREE.CanvasTexture(this.lcdCanvas); this.lcdTex.colorSpace = THREE.SRGBColorSpace;
    box(0.25, 0.006, 0.035, makeInk({ color: '#3A3A34', wash: 0.85 }), 0.0, 0.12, -0.03, g).rotation.x = 0.5;
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.024), makeScreen(this.lcdTex));
    lcd.position.set(0, 0.1245, -0.029); lcd.rotation.x = -Math.PI / 2 + 0.5; // faces up, tilted towards you
    g.add(lcd);
    this.lcd = lcd;

    // platen, knobs, paper bail
    const platen = cyl(0.026, 0.026, 0.5, M.black, 0, 0.135, -0.12, g, 24); platen.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) { const k = cyl(0.022, 0.022, 0.03, M.black, s * 0.265, 0.135, -0.12, g, 16); k.rotation.z = Math.PI / 2; }
    const bail = cyl(0.003, 0.003, 0.4, M.grey, 0, 0.15, -0.1, g, 8); bail.rotation.z = Math.PI / 2;
    // print head carrier, moves along the line
    this.head = box(0.03, 0.03, 0.03, beigeDark, 0, 0.12, -0.085, g);

    // the sheet
    this.paperCanvas = document.createElement('canvas'); this.paperCanvas.width = TEX_W; this.paperCanvas.height = TEX_H;
    this.paperTex = new THREE.CanvasTexture(this.paperCanvas); this.paperTex.colorSpace = THREE.SRGBColorSpace;
    this.paperTex.anisotropy = 8;
    this.paperMat = makeScreen(this.paperTex, { transparent: true, side: THREE.DoubleSide });
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, PAPER_H), this.paperMat);
    this.paperPivot = new THREE.Group();
    this.paperPivot.position.set(0, 0.155, -0.13);
    this.paperPivot.rotation.x = -0.28;
    this.paperPivot.add(this.paper);
    g.add(this.paperPivot);
    // the rest of the sheet, fed from behind, stands up behind the platen
    const backSheet = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, 0.17), makeInk({ color: '#FBF8F0', wash: 0.1, side: THREE.DoubleSide }));
    backSheet.position.set(0, 0.21, -0.165); backSheet.rotation.x = -0.32;
    g.add(backSheet);
  }

  get world() { return this.group.position.clone().add(new THREE.Vector3(0, 0.1, 0)); }

  reset() {
    this.answers = {};
    this.step = 0;
    this.value = '';
    this.lines = [];
    this.col = 0;
    this.finished = false;
    this.rollOut = 0;
    this.paperMat.opacity = 1;
    this.lines.push({ t: '', c: '#2A2420' });
    this.drawPaper();
    this.paperOffset = this.targetOffset();
    this.updatePaper();
  }

  // keyboard routing -------------------------------------------------------
  type(ch) {
    if (this.finished) return;
    const st = STEPS[this.step];
    if (st.yn) { const u = ch.toUpperCase(); if (u !== 'S' && u !== 'N') { this.audio?.buzz(); return; } this.value = u; this.retypeLine(); this.press(u); this.audio?.clack(); return; }
    if (st.numeric && !/[0-9]/.test(ch)) { this.audio?.buzz(); return; }
    if (this.value.length >= 140) return;
    this.value += ch;
    this.press(ch.toUpperCase());
    this.audio?.clack();
    this.appendChar(ch);
  }
  backspace() {
    if (this.finished || !this.value) return;
    this.value = this.value.slice(0, -1);
    this.press('Backspace');
    this.audio?.zzzt();
    this.retypeLine();
  }
  enter() {
    if (this.finished) return;
    const st = STEPS[this.step];
    let v = this.value.trim();
    if (st.id === 'name' && !v) { this.audio?.buzz(); this.flash = performance.now(); return; }
    if (st.yn && !v) { this.audio?.buzz(); this.flash = performance.now(); return; }
    if (st.numeric) v = String(Math.max(1, Math.min(20, parseInt(v || '1', 10))));
    this.answers[st.id] = st.yn ? v === 'S' : v;
    if (st.numeric && !this.value) { this.value = v; this.retypeLine(); }
    this.press('Enter');
    this.audio?.ret();
    // next step, skipping the ones that only make sense for a yes
    let next = this.step + 1;
    while (next < STEPS.length && STEPS[next].onlyIfComing && this.answers.coming === false) next++;
    if (next >= STEPS.length) return this.finish();
    this.step = next; this.value = '';
    this.lines.push({ t: '', c: '#2A2420' }); this.col = 0;
    this.startLine();
  }
  startLine() {
    const st = STEPS[this.step];
    this.lines[this.lines.length - 1].prefix = st.label + ': ';
    this.drawPaper();
  }
  appendChar() {
    this.retypeLine();
    if (this.currentText().length % COLS === COLS - 4) this.audio?.ding();
  }
  currentText() { return (this.lines[this.lines.length - 1].prefix || '') + this.value; }
  retypeLine() { this.lines[this.lines.length - 1].t = this.value; this.drawPaper(); }

  finish() {
    this.finished = true;
    const a = this.answers;
    this.record = {
      name: a.name, coming: !!a.coming, count: a.coming ? parseInt(a.count || '1', 10) : 0,
      allergies: a.allergies || '', song: a.song || '', message: a.message || '', at: new Date().toISOString(),
    };
    this.lines.push({ t: '', c: '#2A2420' });
    this.lines.push({ t: a.coming ? 'A PRESTO!' : 'CI MANCHERAI.', c: '#B6402A', prefix: '' });
    this.drawPaper();
    this.audio?.ding();
    setTimeout(() => { this.rollOut = performance.now(); this.audio?.zzzt(); }, 900);
    setTimeout(() => this.onDone(this.record), 2300);
  }

  press(ch) {
    const k = this.keys.get(ch);
    if (!k) return;
    k.position.y = k.userData.rest - 0.006;
    this.pressed.push({ k, t: performance.now() });
  }

  // drawing ----------------------------------------------------------------
  targetOffset() { return (this.lines.length - 1) * LINE_H; }
  drawPaper() {
    const c = this.paperCanvas.getContext('2d'), s = TEX_W / PAPER_W;
    c.clearRect(0, 0, TEX_W, TEX_H);
    c.fillStyle = '#FBF8F0'; c.fillRect(0, 0, TEX_W, TEX_H);
    // faint printed form
    c.fillStyle = '#9A8A72'; c.font = `500 ${Math.round(0.0062 * s)}px "IBM Plex Mono", monospace`;
    c.fillText('RISPOSTA AL MATRIMONIO', 0.018 * s, 0.018 * s);
    c.strokeStyle = '#C9B9A0'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(0.018 * s, 0.022 * s); c.lineTo((PAPER_W - 0.018) * s, 0.022 * s); c.stroke(); c.setLineDash([]);
    c.font = `700 ${Math.round(0.0098 * s)}px "Courier Prime", "Courier New", monospace`;
    this.lines.forEach((l, i) => {
      const y = (MARGIN_TOP + i * LINE_H) * s;
      const text = (l.prefix || '') + l.t;
      // typewriter ink: each glyph slightly jittered in darkness and baseline
      let x = 0.018 * s;
      for (const ch of text.slice(0, COLS * 3)) {
        c.globalAlpha = 0.78 + ((ch.charCodeAt(0) * 37) % 20) / 100;
        c.fillStyle = l.c;
        c.fillText(ch, x, y + (((ch.charCodeAt(0) * 13) % 5) - 2) * 0.4);
        x += 0.0059 * s;
        if (x > (PAPER_W - 0.018) * s) break;
      }
      c.globalAlpha = 1;
    });
    this.paperTex.needsUpdate = true;
    this.col = Math.min(COLS, this.currentText().length);
  }
  drawLCD(now) {
    const c = this.lcdCanvas.getContext('2d');
    const flash = this.flash && now - this.flash < 400;
    c.fillStyle = flash ? '#C9D9B8' : '#9AB094'; c.fillRect(0, 0, 1024, 96);
    c.fillStyle = 'rgba(31,42,30,0.08)';
    for (let i = 0; i < 32; i++) c.fillRect(8 + i * 31.5, 14, 28, 68);
    c.fillStyle = '#1F2A1E'; c.font = '700 54px "IBM Plex Mono", monospace'; c.textBaseline = 'middle';
    let text;
    if (this.finished) text = this.answers.coming ? ' GRAZIE! STAMPA IN CORSO' : ' GRAZIE LO STESSO.';
    else {
      const st = STEPS[this.step];
      const shown = this.step + 1;
      const total = this.answers.coming === false ? 3 : STEPS.length;
      const cursor = Math.floor(now / 450) % 2 ? '_' : ' ';
      const display = this.answers.coming === false && st.id === 'message' ? 3 : shown;
      text = `${display}/${total} ${st.q} ${this.value.toUpperCase()}${cursor}`;
      if (text.length > 32) text = text.slice(text.length - 32);
    }
    c.fillText(text, 12, 50);
    this.lcdTex.needsUpdate = true;
  }
  updatePaper() {
    const p = this.paper;
    // the paper slides up one line per Return; rows sit at the print line (pivot origin)
    p.position.y = -PAPER_H / 2 + MARGIN_TOP + this.paperOffset + 0.004;
  }

  tick(now, dt) {
    this.drawLCD(now);
    this.paperOffset += (this.targetOffset() - this.paperOffset) * Math.min(1, dt * 14);
    if (this.rollOut) {
      const t = Math.min(1, (now - this.rollOut) / 1300);
      this.paperOffset = this.targetOffset() + t * t * 0.28;
      this.paperMat.opacity = 1 - Math.max(0, (t - 0.6) / 0.4);
    }
    this.updatePaper();
    this.head.position.x = -0.1 + Math.min(1, this.col / COLS) * 0.2;
    for (let i = this.pressed.length - 1; i >= 0; i--) {
      const { k, t } = this.pressed[i];
      if (now - t > 90) { k.position.y = k.userData.rest; this.pressed.splice(i, 1); }
    }
  }
}
