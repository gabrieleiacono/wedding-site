// Wall C close-ups: "Scaffale da vicino" (the camera squares up to one shelf; drag along it, change
// shelf, pinch or wheel to zoom) and "Tira fuori il libro" (tap a book: it slides
// out, turns so its spine reads left to right, and a library card tells you what it is).
// Only taps and drags, no hover.
import * as THREE from '../vendor/three.module.min.js'; // by path, not an import map: Firefox ignores the map on the claude.ai preview
import { BOOK_NOTES } from './content.js';

const FOV = 34;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const VIS = { base: 0.25, min: 0.085, max: 0.34 }; // metres of shelf visible top to bottom
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export class ShelfView {
  constructor({ shelf, leggimi, sound }) {
    this.s = shelf; this.leggimiMesh = leggimi; this.sound = sound;
    this.rows = shelf.rows;
    this.active = false;
    this.lean = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: FOV };
    this.ri = 0; this.x = 0; this.tx = 0; this.y = 0; this.ty = 0; this.vis = VIS.base; this.tvis = VIS.base; this.vx = 0;
    this.pointers = new Map(); this.pinch = null;
    this.pulled = null; this.onLeggimi = () => {};
    this.buildUI();
    // the dim veil that drops behind a book you've taken out
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: '#140f0b', transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.veil.visible = false; this.veil.renderOrder = 2;
    shelf.group.add(this.veil);
  }

  get row() { return this.rows[this.ri]; }
  // a portrait phone stands back a little so a whole spine fits, and shows more books across
  baseVis() { return this.aspect() < 1 ? 0.3 : VIS.base; }
  aspect() { return innerWidth / innerHeight; }
  dist(vis = this.vis) { return vis / (2 * TAN); }
  halfW(vis = this.vis) { return vis / 2 * this.aspect(); }

  // --- entering, leaving, moving ------------------------------------------------------------------
  /** Square up to shelf `ri` (0 = top), centred near world x (or on the row's first book). */
  enter(ri = 1, x = null) {
    this.active = true;
    document.body.classList.add('shelf');
    this.ui.hidden = false;
    this.tvis = this.vis = this.baseVis();
    this.setRow(ri, x ?? this.rows[ri].x1 - this.halfW() + 0.02, true);
    this.hint(true);
    this.s.prefetch?.();
  }
  leave() {
    if (this.pulled) this.putBack(true);
    this.active = false;
    document.body.classList.remove('shelf');
    this.ui.hidden = true;
  }
  setRow(ri, x = this.tx, snap = false) {
    this.ri = THREE.MathUtils.clamp(ri, 0, this.rows.length - 1);
    this.s.sharpen(this.row);
    this.tx = x; this.ty = -Infinity; // the lowest view that keeps the books clear of the HUD
    this.clamp();
    if (snap) { this.x = this.tx; this.y = this.ty; }
    this.ui.querySelector('.rowpos').textContent = `${this.ri + 1}/${this.rows.length}`;
    this.ui.querySelector('[data-row="-1"]').disabled = this.ri === 0;
    this.ui.querySelector('[data-row="1"]').disabled = this.ri === this.rows.length - 1;
  }
  clamp() {
    const R = this.row, hw = this.halfW(this.tvis), m = 0.025;
    const lo = R.x0 - m + hw, hi = R.x1 + m - hw;
    this.tx = lo > hi ? (R.x0 + R.x1) / 2 : THREE.MathUtils.clamp(this.tx, lo, hi);
    // vertically, keep the books inside the band the HUD leaves free (more of the top than of the
    // bottom, more so on phones); raising the camera lowers the books on screen
    const v = this.tvis, phone = this.aspect() < 1, hv = v / 2;
    const ylo = R.y - v * (phone ? 0.1 : 0.07) + hv, yhi = R.top + v * (phone ? 0.27 : 0.15) - hv;
    this.ty = ylo > yhi ? (ylo + yhi) / 2 : THREE.MathUtils.clamp(this.ty, ylo, yhi);
  }
  pan(dxm, dym = 0) { this.tx += dxm; this.ty += dym; this.clamp(); }
  zoom(f, sx = innerWidth / 2, sy = innerHeight / 2) {
    // zoom about the point under the finger / cursor
    const before = this.screenToShelf(sx, sy, this.tvis);
    this.tvis = THREE.MathUtils.clamp(this.tvis * f, VIS.min, VIS.max);
    const after = this.screenToShelf(sx, sy, this.tvis);
    this.tx += before.x - after.x; this.ty += before.y - after.y;
    this.clamp();
  }
  screenToShelf(sx, sy, vis = this.vis) {
    // the spine plane, seen square on: viewer's right is world -x
    const k = vis / innerHeight;
    return { x: this.tx - (sx - innerWidth / 2) * k, y: this.ty - (sy - innerHeight / 2) * k };
  }

  // --- input ---------------------------------------------------------------------------------------
  pointerDown(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.multi = false;
    if (this.pointers.size === 2) {
      this.multi = true; // a pinch, so letting go isn't a tap
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), vis: this.tvis };
    }
    this.vx = 0; this.hint(false);
  }
  pointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || this.pulled) { if (p) { p.x = e.clientX; p.y = e.clientY; } return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = THREE.MathUtils.clamp(this.pinch.vis * this.pinch.d / Math.max(d, 1), VIS.min, VIS.max);
      this.zoom(target / this.tvis, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const k = this.tvis / innerHeight;
    this.pan(dx * k, dy * k);
    this.x = this.tx; this.y = this.ty; // the shelf follows the finger exactly
    this.vx = dx * k / Math.max(1 / 120, 1 / 60);
  }
  pointerUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0 && Math.abs(this.vx) > 0.02) this.pan(THREE.MathUtils.clamp(this.vx * 0.18, -0.6, 0.6));
    this.vx = 0;
  }
  wheel(e) {
    e.preventDefault();
    if (this.pulled) return;
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) this.zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    else this.pan(-e.deltaX * this.tvis / innerHeight);
    this.hint(false);
  }
  key(e) {
    const step = this.halfW(this.tvis) * 1.2;
    if (this.pulled) {
      if (e.key === 'ArrowLeft') this.step(-1); else if (e.key === 'ArrowRight') this.step(1); else if (e.key === 'Escape' || e.key === 'Enter') this.putBack();
      else if ((e.key === ' ' || e.key.toLowerCase() === 'f') && this.pulled.mesh.userData.present && !e.target.closest?.('a, button')) this.flip();
      else return false;
      return true;
    }
    if (e.key === 'ArrowLeft') this.pan(step);
    else if (e.key === 'ArrowRight') this.pan(-step);
    else if (e.key === 'ArrowUp') this.setRow(this.ri - 1);
    else if (e.key === 'ArrowDown') this.setRow(this.ri + 1);
    else if (e.key === '+' || e.key === '=') this.zoom(0.8);
    else if (e.key === '-') this.zoom(1.25);
    else if (e.key === 'Enter') { const r = this.centreBook(); if (r) this.pull(r); }
    else return false;
    return true;
  }
  /** A tap: take out the book under it (or open LEGGIMI). */
  tap(ray) {
    if (this.pulled) {
      // a book that shows its cover turns over when you tap it
      if (this.pulled.mesh.userData.present && ray.intersectObject(this.pulled.mesh, true).length) this.flip();
      return true;
    }
    const hit = ray.intersectObjects([...this.s.meshes, this.leggimiMesh], false)[0];
    if (!hit) return false;
    if (hit.object === this.leggimiMesh) { this.onLeggimi(); return true; }
    const rec = this.s.bookAt(hit);
    if (rec) this.pull(rec);
    return !!rec;
  }
  centreBook() {
    const R = this.row; let best = null, bd = Infinity;
    for (const r of R.books) { const d = Math.abs(r.pos.x - this.x); if (d < bd) { bd = d; best = r; } }
    return best;
  }

  // --- taking a book out ---------------------------------------------------------------------------
  pull(rec) {
    if (this.pulled) this.putBack(true);
    this.s.setOnShelf(rec, false);
    const mesh = this.s.loose(rec);
    this.pulled = { rec, mesh, t: 0, back: false, side: 0, sideT: 0 };
    this.sound?.slide?.();
    this.veil.visible = true;
    this.fillCard(rec);
    this.ui.classList.add('out');
    this.card.hidden = false;
    // keep the gap it leaves on screen
    if (rec.row !== this.row.row) this.setRow(this.rows.findIndex((R) => R.row === rec.row), rec.pos.x);
  }
  /** Turn a book that shows its cover over, to its back and again to its front, through the spine. */
  flip() {
    const p = this.pulled; if (!p?.mesh.userData.present || p.back) return;
    p.sideT = p.sideT ? 0 : 1;
    this.sound?.slide?.();
    const b = this.card.querySelector('[data-flip]'), label = p.sideT ? 'Giralo davanti' : 'Giralo dietro';
    if (b) { b.setAttribute('aria-label', label); b.querySelector('.fl').textContent = label; }
  }
  putBack(now = false) {
    const p = this.pulled; if (!p) return;
    if (now) { p.mesh.userData.dispose(); this.s.setOnShelf(p.rec, true); this.pulled = null; this.veil.visible = false; this.veil.material.opacity = 0; }
    else { p.back = true; }
    this.card.hidden = true; this.ui.classList.remove('out');
  }
  /** The book next to the one in your hands (‹ or ›), on to the next shelf at either end. */
  step(dir) {
    const p = this.pulled; if (!p) return;
    let ri = this.rows.findIndex((R) => R.row === p.rec.row), list = this.rows[ri].books, i = list.indexOf(p.rec) + dir;
    if (i < 0 || i >= list.length) { ri = (ri + dir + this.rows.length) % this.rows.length; list = this.rows[ri].books; i = dir > 0 ? 0 : list.length - 1; }
    const next = list[i];
    this.putBack(true);
    if (ri !== this.ri) this.setRow(ri, next.pos.x, true); else { this.tx = next.pos.x; this.clamp(); }
    this.pull(next);
    this.pulled.t = 0.3; // skip most of the slide: browsing should feel quick
  }
  fillCard(rec) {
    const b = rec.b;
    const pub = [b.publisher, b.series].filter(Boolean).join(' · ');
    // a book you can buy: the link, and a button to turn it over, stay in view under its card
    const shop = this.card.querySelector('.bc-buy');
    shop.hidden = !b.shop?.url;
    shop.innerHTML = b.shop?.url ? `
        <a class="btn buy" href="${esc(b.shop.url)}" target="_blank" rel="noopener" aria-label="${esc([b.shop.label, b.shop.where].filter(Boolean).join(' '))} (si apre in una nuova scheda)">${esc(b.shop.label)}${b.shop.where ? `<span class="where">&nbsp;${esc(b.shop.where)}</span>` : ''} <span aria-hidden="true">↗</span></a>
        <button type="button" class="btn" data-flip aria-label="Giralo dietro"><span aria-hidden="true">↻</span><span class="fl">Giralo dietro</span></button>` : '';
    const first = b.first_published && b.first_published !== b.year ? ` <span class="dim">(prima edizione ${esc(b.first_published)})</span>` : '';
    const note = BOOK_NOTES[b.title] ?? BOOK_NOTES[`${b.author} · ${b.title}`];
    this.card.querySelector('.bc-body').innerHTML = `
      <h2>${esc(b.title)}</h2>
      <p class="by">${esc(b.author)}</p>
      <dl>
        ${pub ? `<dt>Editore</dt><dd>${esc(pub)}</dd>` : ''}
        ${b.year ? `<dt>Anno</dt><dd>${esc(b.year)}${first}</dd>` : ''}
        ${b.translator ? `<dt>Traduzione</dt><dd>${esc(b.translator)}</dd>` : ''}
        ${b.pages ? `<dt>Pagine</dt><dd>${esc(b.pages)}${b.format ? ` <span class="dim">· ${esc(b.format)}</span>` : ''}</dd>` : ''}
      </dl>
      ${b.blurb ? `<p class="blurb">${esc(b.blurb)}</p>` : ''}
      ${note ? `<p class="note">${esc(note)}</p>` : ''}`;
    this.card.classList.toggle('presents', !!b.shop);
    this.card.setAttribute('aria-label', `${b.title}, ${b.author}`);
  }

  // --- every frame ---------------------------------------------------------------------------------
  update(dt, camera) {
    if (!this.active) return;
    const k = Math.min(1, dt * 9);
    // with a book out, the camera eases back so the whole book fits across the screen in front of the shelf
    let vis = this.tvis, place = null;
    const p = this.pulled;
    if (p && p.mesh.userData.present) {
      place = this.coverPlace(p.rec.b);
      vis = Math.max(this.tvis, (place.L + p.rec.b.d / 1000 + 0.1) * 2 * TAN);
    } else if (p) {
      const b = p.rec.b, h = b.h / 1000, narrow = innerWidth < 700;
      const frac = narrow ? 0.94 : 0.78;
      const L = Math.max(0.16, h / (frac * 2 * TAN * this.aspect()));
      vis = Math.max(this.tvis, (L + b.d / 1000 + 0.1) * 2 * TAN);
      place = { L, up: (narrow ? 0.33 : 0.25) * 2 * L * TAN, b };
    }
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k; this.vis += (vis - this.vis) * Math.min(1, dt * 6);
    const z = this.s.spineZ, d = this.dist();
    const g = this.s.group;
    this.lean.pos.copy(g.localToWorld(new THREE.Vector3(this.x, this.y, z - d)));
    this.lean.target.copy(g.localToWorld(new THREE.Vector3(this.x, this.y, z)));
    this.lean.fov = FOV;

    if (p) {
      p.t = Math.min(1, p.t + dt / (p.back ? 0.55 : 0.85));
      const rest = p.rec, b = rest.b;
      // where it goes: in front of the camera, lying so the spine's lettering runs left to right
      const camZ = z - d;
      
      let holdQ, hold;
      if (place.cover) {
        // upright, its front cover to you (-x is the front), turned a little so you see the spine too, and
        // swaying gently; turning it over swings it round through the spine to the back
        p.side += (p.sideT - p.side) * Math.min(1, dt * 5);
        p.clock = (p.clock ?? 0) + dt;
        const s = ease(THREE.MathUtils.clamp(p.side, 0, 1)), quarter = 0.4 + Math.sin(p.clock * 0.8) * 0.05;
        const yaw = THREE.MathUtils.lerp(-Math.PI / 2 + quarter, Math.PI / 2 - quarter, s);
        holdQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + Math.atan2(place.across, place.L));
        holdQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.atan2(place.up, place.L)));
        hold = new THREE.Vector3(this.x + place.across, this.y + place.up, camZ + place.L + b.t / 2000);
        p.mesh.userData.tick?.(dt, !p.back && p.t > 0.5);
      } else {
        const down = /down/i.test(String(b.spine?.title_orientation || 'up'));
        holdQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), down ? -Math.PI / 2 : Math.PI / 2);
        // tipped towards the eye, which is below it, so you see the spine square on
        holdQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.atan2(place.up, place.L)));
        // the spine face sits at distance L, the book behind it
        hold = new THREE.Vector3(this.x, this.y + place.up, camZ + place.L).add(new THREE.Vector3(0, 0, b.d / 2000).applyQuaternion(holdQ));
      }
      const out = rest.pos.clone(); out.z -= b.d / 1000 * 0.8;
      let pos, q;
      const e = ease(p.t);
      if (!p.back) {
        const a = Math.min(1, p.t / 0.35), c = ease(Math.max(0, (p.t - 0.35) / 0.65));
        pos = rest.pos.clone().lerp(out, ease(a)).lerp(hold, c);
        q = rest.quat.clone().slerp(holdQ, c);
      } else {
        // going home: retrace quickly
        const c = 1 - e;
        pos = out.clone().lerp(hold, c);
        if (e > 0.6) pos.lerp(rest.pos, (e - 0.6) / 0.4);
        q = rest.quat.clone().slerp(holdQ, c);
      }
      p.mesh.position.copy(pos); p.mesh.quaternion.copy(q);
      const vOn = p.back ? 1 - e : Math.min(1, p.t * 2);
      this.veil.material.opacity = 0.8 * vOn; // the room is lit above 1.0, so it takes a heavy veil to dim it
      this.veil.position.set(this.x, this.y, camZ + place.L + b.d / 1000 + 0.03);
      if (p.back && p.t >= 1) { p.mesh.userData.dispose(); this.s.setOnShelf(rest, true); this.pulled = null; this.veil.visible = false; }
      else if (!p.back) this.placeCard(place, b);
    }
  }
  /**
   * Where a book that shows its cover is held: on a wide screen it stands left of centre, most of the
   * screen's height, with its card beside it; on a phone it sits in the top part, the card below.
   * L is the distance from the eye to the cover, across and up its offset from the middle of the view.
   */
  coverPlace(b) {
    const h = b.h / 1000, w = b.d / 1000, A = this.aspect();
    const side = A >= 1.15 && innerWidth >= 760;
    if (side) {
      const L = h / ((innerHeight < 560 ? 0.74 : 0.66) * 2 * TAN), hv = 2 * L * TAN;
      return { cover: true, side, L, up: 0.015 * hv, across: (0.5 - 0.3) * hv * A, b };
    }
    const L = Math.max(h / (0.31 * 2 * TAN), w / (0.56 * 2 * TAN * A)), hv = 2 * L * TAN, k = innerHeight / hv;
    const centre = Math.min(innerHeight / 2, 116 + (h / 2) * k); // its top just under the buttons at the top
    return { cover: true, side, L, up: (innerHeight / 2 - centre) / k, across: 0, b };
  }
  placeCard(place, b) {
    if (place.cover) {
      const hv = 2 * place.L * TAN, k = innerHeight / hv;
      if (place.side) {
        // beside the book: from just right of it to the edge of the screen
        const right = innerWidth / 2 - place.across * k + (b.d / 2000) * k + 36;
        this.card.classList.add('side');
        this.card.style.left = `${right}px`;
        this.card.style.width = `${Math.min(470, innerWidth - right - 28)}px`;
        this.card.style.top = ''; this.card.style.maxHeight = `${innerHeight - 150}px`;
      } else {
        this.card.classList.remove('side');
        const top = innerHeight / 2 - place.up * k + (b.h / 2000) * k + 18;
        this.card.style.left = this.card.style.width = '';
        this.card.style.top = `${top}px`;
        this.card.style.maxHeight = `${innerHeight - top - 16}px`;
      }
      return;
    }
    this.card.classList.remove('side');
    this.card.style.left = this.card.style.width = '';
    // the card sits under the book, which is centred `up` above the middle of the screen
    const hv = 2 * place.L * TAN, pxPerM = innerHeight / hv;
    const cy = innerHeight / 2 - place.up * pxPerM, half = (b.t / 1000) * pxPerM / 2;
    const top = Math.max(60, cy + half + 18);
    this.card.style.top = `${top}px`;
    this.card.style.maxHeight = `${innerHeight - top - 40}px`;
  }

  // --- the HUD for both close-ups --------------------------------------------------------------------
  buildUI() {
    const ui = document.createElement('div');
    ui.id = 'shelfui'; ui.hidden = true;
    ui.innerHTML = `
      <div class="pill shelf-rows" role="group" aria-label="Ripiani">
        <button class="btn round" data-row="-1" aria-label="Ripiano sopra">▲</button>
        <span>Ripiano <b class="rowpos"></b></span>
        <button class="btn round" data-row="1" aria-label="Ripiano sotto">▼</button>
      </div>
      <button class="btn round pill shelf-scroll" data-scroll="1" aria-label="Scorri a sinistra">‹</button>
      <button class="btn round pill shelf-scroll" data-scroll="-1" aria-label="Scorri a destra">›</button>
      <div class="pill shelf-hint">Trascina per scorrere · tocca un libro per tirarlo fuori</div>`;
    document.getElementById('hud').appendChild(ui);
    this.ui = ui;
    ui.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.row) { if (this.pulled) this.putBack(true); this.setRow(this.ri + +t.dataset.row); }
      else if (t.dataset.scroll) this.pan(+t.dataset.scroll * this.halfW(this.tvis) * 1.2);
      this.hint(false);
    });

    const card = document.createElement('article');
    card.id = 'bookcard'; card.hidden = true;
    card.innerHTML = `<div class="bc-body"></div>
      <div class="bc-buy" hidden></div>
      <div class="bc-nav">
        <button type="button" class="btn" data-step="-1" aria-label="Il libro prima">‹</button>
        <button type="button" class="btn" data-put>Rimetti a posto</button>
        <button type="button" class="btn" data-step="1" aria-label="Il libro dopo">›</button>
      </div>`;
    document.getElementById('hud').appendChild(card);
    card.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.step) this.step(+t.dataset.step); else if (t.dataset.flip != null) this.flip(); else this.putBack();
    });
    this.card = card;
  }
  hint(on) { const h = this.ui.querySelector('.shelf-hint'); h.style.opacity = on ? 1 : 0; }
}
