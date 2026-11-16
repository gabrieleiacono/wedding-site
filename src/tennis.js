// PS1 easter egg: press Game on the remote and play a tiny tennis match against the console, in English like the old games.
// Up/Down (or W/S) moves your player; the remote's ▲▼ do the same on phones.
// The players and the ball are pixel-art sprites seen from above (tennis-players.js): they run, and swing a forehand
// or a two-handed backhand as the ball comes to them.
import { PlayerSprite, BallSprite, KITS, SWING_T, CONTACT, P, SC } from './tennis-players.js';

const CALL = ['LOVE', '15', '30', '40'];

export class Tennis {
  constructor(ctx, w, h) {
    this.ctx = ctx; this.w = w; this.h = h; this.input = 0;
    this.sprites = { me: new PlayerSprite(KITS.me, 1), cpu: new PlayerSprite(KITS.cpu, -1) };
    this.ballSprite = new BallSprite();
    this.reset();
  }
  reset() {
    const fresh = () => ({ y: this.h / 2, s: 0, games: 0, run: 0, phase: 0, swing: null });
    this.me = fresh(); this.cpu = fresh();
    this.serve(1);
    this.last = 0; this.msg = 'PRESS ▲▼ TO PLAY'; this.msgUntil = performance.now() + 2500;
  }
  serve(dir) {
    this.ball = { x: this.w / 2, y: this.h / 2, vx: 300 * dir, vy: (Math.random() - 0.5) * 260, z: 0 };
  }
  point(mine) {
    const p = mine ? this.me : this.cpu, o = mine ? this.cpu : this.me;
    p.s++;
    if (p.s >= 4 && p.s - o.s >= 2) {
      p.games++; p.s = 0; o.s = 0;
      this.msg = mine ? 'GAME PLAYER!' : 'GAME CPU'; this.msgUntil = performance.now() + 1800;
    } else if (p.s >= 3 && o.s >= 3) { const lo = Math.min(p.s, o.s) - 3; p.s -= lo; o.s -= lo; } // back to deuce
    this.serve(mine ? -1 : 1);
  }
  /** the score as the umpire calls it: 15-30, DEUCE, ADV PLAYER */
  call() {
    const a = this.me.s, b = this.cpu.s;
    if (a >= 3 && b >= 3) return a === b ? 'DEUCE' : a > b ? 'ADV PLAYER' : 'ADV CPU';
    return `${CALL[a]}-${CALL[b]}`;
  }
  /** run and swing: `x` is where the player stands, `side` +1 for the player on the left */
  animate(p, x, side, y0, dt) {
    const v = (p.y - y0) / Math.max(dt, 1e-3);
    p.run += (Math.min(1, Math.abs(v) / 200) - p.run) * Math.min(1, dt * 12);
    p.phase += Math.abs(v) * dt * 0.06;
    if (p.swing) { p.swing.t += dt / SWING_T; if (p.swing.t >= 1) p.swing = null; }
    const b = this.ball;
    if (!p.swing && Math.sign(b.vx) === -side) {
      const dx = (b.x - x) * side, tta = dx / Math.abs(b.vx);
      const by = b.y + b.vy * tta, dy = by - p.y;
      if (tta > 0 && tta < SWING_T * CONTACT && Math.abs(dy) < 70) {
        // where the ball will be, in the sprite's own measures (+ = the racket side): forehand or backhand, and how far to reach
        const lv = dy * side / (P * SC), type = lv > -3 ? 'fh' : 'bh';
        const reach = type === 'fh' ? Math.max(-3, Math.min(1.5, lv - 11.9)) : Math.max(-1.5, Math.min(1.5, lv + 7.9));
        p.swing = { type, t: 0, reach };
      }
    }
  }
  step(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    const { w, h } = this, top = 70, bot = h - 40, left = 50, right = w - 50;
    const y0me = this.me.y, y0cpu = this.cpu.y;
    this.me.y = Math.max(top + 30, Math.min(bot - 30, this.me.y + this.input * 420 * dt));
    this.cpu.y += Math.max(-250 * dt, Math.min(250 * dt, this.ball.y - this.cpu.y));
    this.animate(this.me, left + 20, 1, y0me, dt);
    this.animate(this.cpu, right - 20, -1, y0cpu, dt);
    const b = this.ball;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.abs(Math.sin(b.x / 70)) * 14;
    if (b.y < top || b.y > bot) { b.vy *= -1; b.y = Math.max(top, Math.min(bot, b.y)); }
    const hit = (p, x) => Math.abs(b.x - x) < 12 && Math.abs(b.y - p.y) < 50; // about as far as the racket reaches
    if (b.vx < 0 && hit(this.me, left + 20)) { b.vx = Math.abs(b.vx) * 1.05; b.vy += (b.y - this.me.y) * 6; }
    if (b.vx > 0 && hit(this.cpu, right - 20)) { b.vx = -Math.abs(b.vx) * 1.03; b.vy += (b.y - this.cpu.y) * 5 + (Math.random() - 0.5) * 120; }
    b.vx = Math.sign(b.vx) * Math.min(720, Math.abs(b.vx));
    if (b.x < left - 10) this.point(false);
    if (b.x > right + 10) this.point(true);
    this.draw(now);
  }
  draw(now) {
    const { ctx, w, h } = this, top = 70, bot = h - 40, left = 50, right = w - 50;
    ctx.fillStyle = '#1E6A3A'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2E8A4A'; ctx.fillRect(left, top, right - left, bot - top);
    ctx.strokeStyle = '#F4F4F0'; ctx.lineWidth = 4;
    ctx.strokeRect(left, top, right - left, bot - top);
    ctx.strokeRect(left + 100, top + 40, right - left - 200, bot - top - 80);
    ctx.beginPath(); ctx.moveTo(left + 100, (top + bot) / 2); ctx.lineTo(right - 100, (top + bot) / 2); ctx.stroke();
    ctx.fillStyle = '#DDD'; ctx.fillRect(w / 2 - 3, top - 8, 6, bot - top + 16);
    this.sprites.me.draw(ctx, left + 20, this.me.y, this.me);
    this.sprites.cpu.draw(ctx, right - 20, this.cpu.y, this.cpu);
    const b = this.ball;
    this.ballSprite.draw(ctx, b.x, b.y, b.z);
    ctx.font = '700 26px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, 54);
    ctx.fillStyle = '#FFF24A';
    ctx.fillText(`PLAYER ${this.me.games}  ${this.call()}  ${this.cpu.games} CPU`, 20, 12);
    ctx.fillStyle = '#38E05A'; ctx.fillText('AV1', w - 80, 12);
    if (now < this.msgUntil) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(w / 2 - 230, h / 2 - 30, 460, 60);
      ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.fillText(this.msg, w / 2, h / 2 - 14); ctx.textAlign = 'left';
    }
  }
}
