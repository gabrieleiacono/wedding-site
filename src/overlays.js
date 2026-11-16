// Close-ups that open on top of the room: the photo viewer, notebooks (unused for now), the LEGGIMI book, the RSVP reply card,
// the wall calendar and the closing credits (no longer reachable from the room).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { STORIES, LEGGIMI, CREDITS, WEDDING } from './content.js';
import { PHOTOS } from './photos.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Overlays {
  constructor() {
    this.el = $('#overlay'); this.card = $('#overlay-card');
    this.onClose = () => {};
    $('#overlay-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }
  get open() { return !this.el.hidden; }
  show(html, cls = '') {
    this.cleanup?.(); this.cleanup = null;
    this.card.className = cls; this.card.innerHTML = html; this.el.hidden = false;
    this.el.classList.toggle('viewing', cls === 'viewer');
    $('#overlay-close').focus();
  }
  close() { if (this.el.hidden) return; this.cleanup?.(); this.cleanup = null; this.el.hidden = true; this.el.classList.remove('viewing'); this.card.innerHTML = ''; this.onClose(); }

  /** The photos, one at a time, full screen and without captions, opened on photo i: ‹ › or the arrow
   *  keys to go through them, a swipe on a phone, ✕, Esc or a tap beside the photo to close. */
  photos(i = 0) {
    const n = PHOTOS.length;
    if (!n) return;
    this.show(`<div class="v-stage"><div class="v-blur"></div><img class="v-img" alt="" draggable="false"></div>` +
      `<button type="button" class="v-prev pill btn round" aria-label="Foto precedente">‹</button>` +
      `<button type="button" class="v-next pill btn round" aria-label="Foto successiva">›</button>` +
      `<div class="v-count pill mono" aria-live="polite"></div>`, 'viewer');
    const c = this.card, stage = c.querySelector('.v-stage'), img = c.querySelector('.v-img'), blur = c.querySelector('.v-blur');
    const wrap = (k) => (k % n + n) % n;
    const preload = (k) => { const im = new Image(); im.src = PHOTOS[wrap(k)].l; };
    const show = (k, dir = 0) => {
      i = wrap(k);
      const p = PHOTOS[i];
      blur.style.backgroundImage = `url('${esc(p.s)}')`;
      img.classList.remove('in'); img.style.transform = dir ? `translateX(${dir * 6}%)` : '';
      img.alt = `Foto ${i + 1} di ${n}`;
      img.onload = () => requestAnimationFrame(() => { img.style.transform = ''; img.classList.add('in'); });
      img.src = p.l;
      c.querySelector('.v-count').textContent = `${i + 1} / ${n}`;
      preload(i + 1); preload(i - 1);
    };
    c.querySelector('.v-prev').addEventListener('click', () => show(i - 1, -1));
    c.querySelector('.v-next').addEventListener('click', () => show(i + 1, 1));
    if (n < 2) c.querySelectorAll('.v-prev, .v-next').forEach((b) => { b.hidden = true; });
    // a swipe: the photo follows the finger, and past a third of a thumb's throw it turns
    let sx = null, sy = 0, dx = 0, moved = false;
    stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; dx = 0; moved = false; img.style.transition = 'none'; });
    stage.addEventListener('pointermove', (e) => {
      if (sx === null) return;
      dx = e.clientX - sx;
      if (Math.abs(dx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true;
      if (n > 1) img.style.transform = `translateX(${dx}px)`;
    });
    const end = (e) => {
      if (sx === null) return;
      sx = null; img.style.transition = '';
      if (n > 1 && Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      else { img.style.transform = ''; if (!moved && e.type === 'pointerup' && e.target !== img) this.close(); }
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    const key = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1, -1); }
    };
    window.addEventListener('keydown', key);
    this.cleanup = () => window.removeEventListener('keydown', key);
    show(i);
  }

  notebooks(start = 0) {
    this.show(`<div class="notebook"><div class="tabs">${STORIES.map((s, i) => `<button style="background:${s.color};color:${i === 4 ? '#2A1A10' : '#FBF8F0'}" data-i="${i}">${i + 1} · ${esc(s.title)}</button>`).join('')}</div><div class="lined"></div></div>`);
    const show = (i) => {
      this.card.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
      this.card.querySelector('.lined').innerHTML = `<h2>${esc(STORIES[i].title)}</h2>${esc(STORIES[i].body)}`;
    };
    this.card.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(+b.dataset.i)));
    show(start);
  }

  leggimi() { this.show(`<div class="lined" style="max-width:560px"><h2>${esc(LEGGIMI.title)}</h2>${esc(LEGGIMI.body)}</div>`); }

  replyCard(r, n) {
    const row = (k, v) => v ? `<div>${k}: ${esc(v)}</div>` : '';
    this.show(`<div class="sheet card"><div class="num">RISPOSTA N. ${String(n).padStart(3, '0')}</div><div style="margin-top:8px">${esc(r.name).toUpperCase()}</div>${row('CI SARÀ', r.coming ? 'SÌ' : 'NO')}${r.coming ? row('ALLERGIE', r.allergies || 'nessuna') + row('PAROLA BUFFA', r.word) : ''}${row('MSG', r.message)}<hr><div class="thanks">${r.coming ? 'grazie! a presto' : 'grazie lo stesso!'}</div><div class="mono" style="font-size:12px;color:#6A5A4A">Il tuo nome è sul televideo, pagina 600.</div></div>`);
  }

  calendar() {
    const days = daysLeft();
    this.show(`<div class="sheet calendar"><div class="mono" style="font-size:12px;color:#9A8A72">${esc(WEDDING.dateLong)}</div><div class="big">${days > 0 ? days : '🎉'}</div><div class="hand" style="font-size:28px">${days > 1 ? 'giorni al matrimonio' : days === 1 ? 'domani!' : 'è oggi!'}</div></div>`);
  }

  credits() {
    this.show(`<div class="credits"><div class="roll"><h2>Titoli di coda</h2>${CREDITS.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}<div class="row" style="margin-top:60px"><b class="hand" style="font-size:34px">Fine.</b></div></div></div>`);
  }
}

export function daysLeft() {
  const d = new Date(WEDDING.dateISO + 'T00:00:00'), now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

/** The wall calendar as a drawn texture: this month, past days crossed in red, and the countdown. */
export function calendarTexture() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 440;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const now = new Date();
    x.fillStyle = '#FBF8F0'; x.fillRect(0, 0, 320, 440);
    // picture: the villa among cypresses, in wash
    x.fillStyle = '#F4B183'; x.fillRect(14, 14, 292, 150);
    x.fillStyle = '#C9A44C'; x.beginPath(); x.moveTo(14, 130); x.quadraticCurveTo(160, 90, 306, 125); x.lineTo(306, 164); x.lineTo(14, 164); x.fill();
    x.fillStyle = '#F1DFC2'; x.fillRect(120, 92, 80, 40); x.fillStyle = '#C2552E'; x.beginPath(); x.moveTo(112, 94); x.lineTo(160, 70); x.lineTo(208, 94); x.fill();
    x.fillStyle = '#2F4A2E'; for (const cx of [60, 84, 236, 262]) { x.beginPath(); x.ellipse(cx, 112, 9, 34, 0, 0, 7); x.fill(); }
    x.strokeStyle = '#1A1714'; x.lineWidth = 2; x.strokeRect(14, 14, 292, 150);
    const months = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
    x.fillStyle = '#1A1714'; x.font = '800 26px "Bricolage Grotesque", sans-serif'; x.textAlign = 'center';
    x.fillText(`${months[now.getMonth()]} ${now.getFullYear()}`, 160, 198);
    x.font = '600 13px "IBM Plex Mono", monospace';
    ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach((d, i) => x.fillText(d, 36 + i * 41, 222));
    const first = new Date(now.getFullYear(), now.getMonth(), 1), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const off = (first.getDay() + 6) % 7;
    for (let d = 1; d <= dim; d++) {
      const i = d - 1 + off, cx = 36 + (i % 7) * 41, cy = 248 + Math.floor(i / 7) * 30;
      x.fillStyle = i % 7 === 6 ? '#B6402A' : '#1A1714'; x.font = '500 15px "IBM Plex Mono", monospace'; x.fillText(String(d), cx, cy);
      if (d < now.getDate()) { x.strokeStyle = '#D23A2A'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx - 10, cy - 15); x.lineTo(cx + 10, cy + 4); x.moveTo(cx + 10, cy - 15); x.lineTo(cx - 10, cy + 4); x.stroke(); }
      if (d === now.getDate()) { x.strokeStyle = '#D23A2A'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy - 5, 14, 0, 7); x.stroke(); }
    }
    x.fillStyle = '#B6402A'; x.font = '700 26px Caveat, cursive';
    const n = daysLeft();
    x.fillText(n > 0 ? `mancano ${n} giorni!` : 'è il giorno!', 160, 428);
    tex.needsUpdate = true;
  };
  draw();
  return { tex, draw };
}
