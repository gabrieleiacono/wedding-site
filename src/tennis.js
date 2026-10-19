// PS1 easter egg: switch the TV to AV and play a tiny tennis match against the console.
// Up/Down (or W/S) moves your player; the remote's ▲▼ do the same on phones.
const SCORE = ['0', '15', '30', '40', 'GIOCO'];

export class Tennis {
  constructor(ctx, w, h) { this.ctx = ctx; this.w = w; this.h = h; this.input = 0; this.reset(); }
  reset() {
    this.me = { y: this.h / 2, s: 0, games: 0 };
    this.cpu = { y: this.h / 2, s: 0, games: 0 };
    this.serve(1);
    this.last = 0; this.msg = 'PREMI ▲▼ PER GIOCARE'; this.msgUntil = performance.now() + 2500;
  }
  serve(dir) {
    this.ball = { x: this.w / 2, y: this.h / 2, vx: 300 * dir, vy: (Math.random() - 0.5) * 260, z: 0 };
  }
  point(mine) {
    const p = mine ? this.me : this.cpu, o = mine ? this.cpu : this.me;
    if (p.s === 3 && o.s === 3) { p.s = 4; } // vantaggio, simplified
    p.s++;
    if (p.s >= 4 && p.s - o.s >= 2) { p.games++; p.s = 0; o.s = 0; this.msg = mine ? 'GIOCO A TE!' : 'GIOCO ALLA CONSOLE'; this.msgUntil = performance.now() + 1800; }
    else if (p.s > 4) { p.s = 4; o.s = 3; }
    this.serve(mine ? -1 : 1);
  }
  step(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    const { w, h } = this, top = 70, bot = h - 40, left = 50, right = w - 50;
    this.me.y = Math.max(top + 30, Math.min(bot - 30, this.me.y + this.input * 420 * dt));
    this.cpu.y += Math.max(-250 * dt, Math.min(250 * dt, this.ball.y - this.cpu.y));
    const b = this.ball;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.abs(Math.sin(b.x / 70)) * 14;
    if (b.y < top || b.y > bot) { b.vy *= -1; b.y = Math.max(top, Math.min(bot, b.y)); }
    const hit = (p, x) => Math.abs(b.x - x) < 12 && Math.abs(b.y - p.y) < 38;
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
    // players: chunky low-poly-ish figures
    const player = (x, y, col) => {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 10, y + 22, 24, 8);
      ctx.fillStyle = col; ctx.fillRect(x - 9, y - 20, 18, 34);
      ctx.fillStyle = '#F3D9A4'; ctx.fillRect(x - 7, y - 34, 14, 14);
      ctx.fillStyle = '#C9A44C'; ctx.fillRect(x + (x < w / 2 ? 9 : -21), y - 12, 12, 26);
    };
    player(left + 20, this.me.y, '#E8261C');
    player(right - 20, this.cpu.y, '#2BD9F2');
    const b = this.ball;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, 8, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#E8F04A'; ctx.beginPath(); ctx.arc(b.x, b.y - b.z, 8, 0, 7); ctx.fill();
    ctx.font = '700 26px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, 54);
    ctx.fillStyle = '#FFF24A';
    ctx.fillText(`TU ${this.me.games}  ${SCORE[Math.min(4, this.me.s)]}-${SCORE[Math.min(4, this.cpu.s)]}  ${this.cpu.games} CONSOLE`, 20, 12);
    ctx.fillStyle = '#38E05A'; ctx.fillText('AV1', w - 80, 12);
    if (now < this.msgUntil) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(w / 2 - 230, h / 2 - 30, 460, 60);
      ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.fillText(this.msg, w / 2, h / 2 - 14); ctx.textAlign = 'left';
    }
  }
}
