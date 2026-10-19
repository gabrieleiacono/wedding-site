// All sounds are synthesised with WebAudio (no files): typewriter clack, bell, correction "zzzt",
// carriage return, TV click, distant train, donkey bray and a rooster. Audio starts on first click.
export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ctx.destination);
      this.room();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  toggle() { this.on = !this.on; if (this.master) this.master.gain.value = this.on ? 0.6 : 0; return this.on; }
  get ok() { return this.ctx && this.on; }
  noise(dur) {
    const b = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(); s.buffer = b; return s;
  }
  env(node, t, a, peak, decay) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay); node.connect(g); g.connect(this.master); return g; }
  // soft room tone: very quiet filtered noise
  room() {
    const n = this.noise(4); n.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = this.ctx.createGain(); g.gain.value = 0.015;
    n.connect(f); f.connect(g); g.connect(this.master); n.start();
  }
  clack() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const n = this.noise(0.05); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 900; f.Q.value = 1.2;
    n.connect(f); this.env(f, t, 0.001, 0.9, 0.045); n.start(t);
    const o = this.ctx.createOscillator(); o.frequency.value = 140; this.env(o, t, 0.001, 0.25, 0.03); o.start(t); o.stop(t + 0.06);
  }
  ding() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    for (const [fr, v] of [[2093, 0.35], [4186, 0.12], [3136, 0.08]]) { const o = this.ctx.createOscillator(); o.frequency.value = fr; this.env(o, t, 0.002, v, 1.4); o.start(t); o.stop(t + 1.5); }
  }
  zzzt() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(70, t + 0.35);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f); this.env(f, t, 0.02, 0.18, 0.35); o.start(t); o.stop(t + 0.4);
  }
  ret() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const n = this.noise(0.4); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1200, t + 0.3); f.Q.value = 3;
    n.connect(f); this.env(f, t, 0.05, 0.3, 0.3); n.start(t);
    setTimeout(() => this.clack(), 320);
  }
  buzz() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 180; this.env(o, t, 0.005, 0.08, 0.15); o.start(t); o.stop(t + 0.2);
  }
  tvClick() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const n = this.noise(0.03); this.env(n, t, 0.001, 0.4, 0.03); n.start(t);
    const o = this.ctx.createOscillator(); o.frequency.value = 15734 / 2; this.env(o, t, 0.01, 0.015, 0.4); o.start(t); o.stop(t + 0.5);
  }
  train(intercity) {
    if (!this.ok) return; const t = this.ctx.currentTime, dur = intercity ? 9 : 7;
    const n = this.noise(dur); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + dur * 0.45); g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t);
    // a distant two-tone whistle
    const w0 = t + dur * 0.35;
    for (const [fr, s] of [[660, 0], [554, 0.45]]) { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; const ff = this.ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 1200; o.connect(ff); this.env(ff, w0 + s, 0.05, 0.05, 0.5); o.start(w0 + s); o.stop(w0 + s + 0.7); }
  }
  bray() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const hi = i % 2 === 0, s = t + i * 0.42;
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(hi ? 520 : 180, s); o.frequency.linearRampToValueAtTime(hi ? 440 : 150, s + 0.38);
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hi ? 1100 : 600; f.Q.value = 2;
      o.connect(f); this.env(f, s, 0.03, 0.22, 0.36); o.start(s); o.stop(s + 0.42);
    }
  }
  rooster() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    // chic - chi - ri - chììì
    const notes = [[700, 0.12], [900, 0.12], [1050, 0.16], [1250, 0.75]];
    let s = t;
    for (const [fr, d] of notes) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr * 0.85, s); o.frequency.linearRampToValueAtTime(fr, s + 0.04); o.frequency.linearRampToValueAtTime(fr * 0.8, s + d);
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 28; const lg = this.ctx.createGain(); lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency); lfo.start(s); lfo.stop(s + d);
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.5;
      o.connect(f); this.env(f, s, 0.02, 0.07, d); o.start(s); o.stop(s + d + 0.05);
      s += d + 0.03;
    }
  }
}
