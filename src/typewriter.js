// The electronic typewriter (design F1 #1, F8): the RSVP.
// A one-line LCD asks the questions; your real keyboard (or the phone keyboard) drives the keys,
// each answer types onto the sheet, Return goes to the next question, and the sheet rolls out at the end.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { makeInk, makeScreen } from './ink.js';
import { buildTypewriterModel } from './typewriter-model.js';

export const STEPS = [
  { id: 'name', q: 'COME TI CHIAMI?', label: 'NOME' },
  { id: 'coming', q: 'CI SARAI? (S/N)', label: 'CI SARÀ', yn: true },
  { id: 'allergies', q: 'ALLERGIE?', label: 'ALLERGIE', onlyIfComing: true },
  { id: 'word', q: 'UNA PAROLA BUFFA?', label: 'PAROLA', onlyIfComing: true },
  { id: 'message', q: 'UN MESSAGGIO?', label: 'MSG' },
];
const PAPER_W = 0.21, PAPER_H = 0.297, LINE_H = 0.0135, MARGIN_TOP = 0.032, COLS = 27;
const PRINT_LIFT = 0.019; // how far above the slot the typing line shows
const TEX_W = 840, TEX_H = Math.round(TEX_W * PAPER_H / PAPER_W);

export class Typewriter {
  constructor(parent, audio) {
    this.audio = audio;
    this.group = new THREE.Group();
    this.group.position.set(0.0, 0.75, -1.43);
    parent.add(this.group);
    this.pressed = [];
    this.build();
    this.reset();
    this.onDone = () => {};
    this.active = false;
  }

  build() {
    const g = this.group;
    // LCD: one line, green
    this.lcdCanvas = document.createElement('canvas'); this.lcdCanvas.width = 1024; this.lcdCanvas.height = 176;
    this.lcdTex = new THREE.CanvasTexture(this.lcdCanvas); this.lcdTex.colorSpace = THREE.SRGBColorSpace;
    const parts = buildTypewriterModel(g, this.lcdTex);
    this.keys = parts.keyMap; this.head = parts.head; this.lcd = parts.lcd;
    const slot = parts.slotPos;

    // the sheet: comes out of the paper slot, leaning back
    this.paperCanvas = document.createElement('canvas'); this.paperCanvas.width = TEX_W; this.paperCanvas.height = TEX_H;
    this.paperTex = new THREE.CanvasTexture(this.paperCanvas); this.paperTex.colorSpace = THREE.SRGBColorSpace;
    this.paperTex.anisotropy = 8;
    this.paperMat = makeScreen(this.paperTex, { transparent: true, side: THREE.DoubleSide });
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, PAPER_H), this.paperMat);
    this.paperPivot = new THREE.Group();
    this.paperPivot.position.set(0, slot.y - 0.002, slot.z + 0.004);
    this.paperPivot.rotation.x = -0.32;
    this.paperPivot.add(this.paper);
    // clip the part of the sheet still inside the machine
    this.paperMat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.group.position.y + slot.y - 0.004))];
    g.add(this.paperPivot);
    // the rest of the sheet, fed from behind, stands up behind the platen
    const backSheet = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, 0.15), makeInk({ color: '#FBF8F0', wash: 0.1, side: THREE.DoubleSide, hatch: 0.6 }));
    backSheet.position.set(0, slot.y + 0.07, slot.z - 0.03); backSheet.rotation.x = -0.42;
    g.add(backSheet);
  }

  get world() { return this.group.position.clone().add(new THREE.Vector3(0, 0.1, 0)); }

  /** World points the camera keeps in frame while you type: the LCD, and the sheet from the print line up past the form's heading. */
  readPoints() {
    this.group.updateMatrixWorld(true);
    const pts = [], TEXT_W = PAPER_W - 0.03; // the typed column, not the bare margins
    for (const [x, y] of [[-0.066, -0.012], [0.066, -0.012], [-0.066, 0.012], [0.066, 0.012]]) pts.push(this.lcd.localToWorld(new THREE.Vector3(x, y, 0)));
    // the line being typed sits on the print line (the pivot); earlier lines and the heading climb above it, five questions at most
    const top = PRINT_LIFT + (STEPS.length - 1) * LINE_H + (MARGIN_TOP - 0.018) + 0.012;
    for (const [x, y] of [[-TEXT_W / 2, -0.004], [TEXT_W / 2, -0.004], [-TEXT_W / 2, top], [TEXT_W / 2, top]]) pts.push(this.paperPivot.localToWorld(new THREE.Vector3(x, y, 0)));
    return pts;
  }

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
      name: a.name, coming: !!a.coming, count: a.coming ? 1 : 0, // one answer, one guest
      allergies: a.allergies || '', word: a.word || '', message: a.message || '', at: new Date().toISOString(),
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
    k.position.y = k.userData.rest - 0.004;
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
    c.fillText('RISPOSTA ALL\'INVITO', 0.018 * s, 0.018 * s);
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
    const flash = this.flash && now - this.flash < 400;
    const text = this.lcdText(now);
    // redraw (and re-upload) the LCD only when what it shows changes: the cursor blinks twice a second
    if (text === this.lcdShown && flash === this.lcdFlash) return;
    this.lcdShown = text; this.lcdFlash = flash;
    const c = this.lcdCanvas.getContext('2d');
    c.fillStyle = flash ? '#CCDBB4' : '#A6B793'; c.fillRect(0, 0, 1024, 176);
    c.fillStyle = 'rgba(31,42,30,0.08)';
    for (let i = 0; i < 26; i++) c.fillRect(10 + i * 38.8, 40, 35, 96);
    c.fillStyle = '#1F2A1E'; c.font = '700 64px "IBM Plex Mono", monospace'; c.textBaseline = 'middle';
    c.fillText(text, 12, 90);
    this.lcdTex.needsUpdate = true;
  }
  lcdText(now) {
    let text;
    if (this.finished) text = this.answers.coming ? ' GRAZIE! STAMPA IN CORSO' : ' GRAZIE LO STESSO.';
    else {
      const st = STEPS[this.step];
      const shown = this.step + 1;
      const total = this.answers.coming === false ? 3 : STEPS.length;
      const cursor = Math.floor(now / 450) % 2 ? '_' : ' ';
      const display = this.answers.coming === false && st.id === 'message' ? 3 : shown;
      text = `${display}/${total} ${st.q} ${this.value.toUpperCase()}${cursor}`;
      if (text.length > 26) text = text.slice(text.length - 26);
    }
    return text;
  }
  updatePaper() {
    const p = this.paper;
    // the paper slides up one line per Return; the line being typed sits just above the bail, where you can read it
    p.position.y = -PAPER_H / 2 + MARGIN_TOP + this.paperOffset + PRINT_LIFT;
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
    this.head.position.x = -0.15 + Math.min(1, this.col / COLS) * 0.3;
    for (let i = this.pressed.length - 1; i >= 0; i--) {
      const { k, t } = this.pressed[i];
      if (now - t > 90) { k.position.y = k.userData.rest; this.pressed.splice(i, 1); }
    }
  }
}
