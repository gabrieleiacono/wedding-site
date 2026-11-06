// Close-ups that open on top of the room: album, notebooks, the LEGGIMI book, the RSVP reply card,
// the wall calendar, the hi-fi playlist and the closing credits (no longer reachable from the room).
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { PHOTOS, STORIES, LEGGIMI, CREDITS, PLAYLIST, WEDDING } from './content.js';

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
    this.card.className = cls; this.card.innerHTML = html; this.el.hidden = false;
    $('#overlay-close').focus();
  }
  close() { if (this.el.hidden) return; this.el.hidden = true; this.card.innerHTML = ''; this.onClose(); }

  album() {
    let spread = 0;
    const per = 4, spreads = Math.ceil(PHOTOS.length / per);
    const photo = (p, i) => {
      if (!p) return '<div></div>';
      const tilt = ((i * 37) % 9) - 4;
      const img = p.src ? `background-image:url('${esc(p.src)}')` : `background:${sketch(i)}`;
      return `<figure class="photo" style="transform:rotate(${tilt}deg);margin:0"><div class="img" style="${img}" role="img" aria-label="${esc(p.caption)}"></div><span class="corner c1"></span><span class="corner c2"></span><figcaption class="cap">${esc(p.caption)}</figcaption></figure>`;
    };
    const render = (dir) => {
      const a = spread * per;
      this.card.querySelector('.album').innerHTML =
        `<div class="page left">${photo(PHOTOS[a], a)}${photo(PHOTOS[a + 1], a + 1)}</div>` +
        `<div class="page right">${photo(PHOTOS[a + 2], a + 2)}${photo(PHOTOS[a + 3], a + 3)}</div>`;
      this.card.querySelector('.count').textContent = `${spread + 1} / ${spreads}`;
      if (dir) { const p = this.card.querySelector(dir > 0 ? '.page.right' : '.page.left'); p.style.transform = `rotateY(${dir > 0 ? 90 : -90}deg)`; requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transform = ''; })); }
    };
    this.show(`<div class="album"></div><div class="album-nav"><button class="pill btn" data-d="-1">← Indietro</button><span class="count mono"></span><button class="pill btn" data-d="1">Avanti →</button></div>`);
    const turn = (d) => { const n = Math.max(0, Math.min(spreads - 1, spread + d)); if (n !== spread) { spread = n; render(d); } };
    this.card.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => turn(+b.dataset.d)));
    let sx = null; const al = this.card.querySelector('.album');
    al.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    al.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) turn(e.clientX < sx ? 1 : -1); sx = null; });
    render(0);
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

  playlist() {
    this.show(`<div class="sheet" style="max-width:420px"><div class="mono" style="font-size:12px;color:#9A8A72">MINI HI-FI · CASSETTA LATO A</div><h2 class="hand" style="font-size:34px;margin:6px 0 10px;color:#B6402A">La nostra playlist</h2><ol class="hand" style="font-size:22px;margin:0;padding-left:24px">${PLAYLIST.map((p) => `<li>${esc(p)}</li>`).join('')}</ol><p class="mono" style="font-size:12px;color:#6A5A4A;margin:14px 0 0">Le canzoni scritte alla macchina da scrivere finiscono qui.</p></div>`);
  }

  replyCard(r, n) {
    const row = (k, v) => v ? `<div>${k}: ${esc(v)}</div>` : '';
    this.show(`<div class="sheet card"><div class="num">RISPOSTA N. ${String(n).padStart(3, '0')}</div><div style="margin-top:8px">${esc(r.name).toUpperCase()}</div>${row('VIENE', r.coming ? 'SÌ' : 'NO')}${r.coming ? row('IN', String(r.count)) + row('ALLERGIE', r.allergies || 'nessuna') + row('CANZONE', r.song) : ''}${row('MSG', r.message)}<hr><div class="thanks">${r.coming ? 'grazie! a presto' : 'grazie lo stesso!'}</div><div class="mono" style="font-size:12px;color:#6A5A4A">Il tuo nome è sul televideo, pagina 600.</div></div>`);
  }

  calendar() {
    const days = daysLeft();
    this.show(`<div class="sheet calendar"><div class="mono" style="font-size:12px;color:#9A8A72">${esc(WEDDING.dateLong)}</div><div class="big">${days > 0 ? days : '🎉'}</div><div class="hand" style="font-size:28px">${days > 1 ? 'giorni al matrimonio' : days === 1 ? 'domani!' : 'è oggi!'}</div><p class="mono" style="font-size:12px;color:#6A5A4A">Ogni sera una croce rossa sul calendario.</p></div>`);
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

// a sketchy watercolour placeholder for photos not yet supplied
function sketch(i) {
  const pal = [['#7FA8C9', '#5E8A5A'], ['#D98A6A', '#F3D9A4'], ['#C9A44C', '#8A3A2A'], ['#3E6A6A', '#9C8AB4'], ['#E58C8A', '#F4B183']][i % 5];
  return `linear-gradient(${150 + i * 20}deg, ${pal[0]} 0 55%, ${pal[1]} 55% 100%)`;
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
