// Where RSVPs go. Tried in order:
//  1. A Google Sheet, through the Apps Script web app in /apps-script (set SHEET_URL below).
//  2. The claude.ai artifact database, when the page runs as a published preview.
//  3. This browser only (localStorage), so the page still works offline / locally.
// Every backend exposes the same two calls: add(record) and onGuests(callback).

export const SHEET_URL = ''; // e.g. 'https://script.google.com/macros/s/XXXX/exec'

const LOCAL_KEY = 'scrittoio-rsvps';

function localBackend() {
  const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } };
  const subs = new Set();
  return {
    name: 'local',
    async add(r) { const all = read(); all.push(r); try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch {} subs.forEach((f) => f(all)); },
    onGuests(f) { subs.add(f); f(read()); },
  };
}

function sheetBackend(url) {
  let guests = [];
  const subs = new Set();
  const refresh = async () => {
    try {
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      guests = (data.guests || []).map((g) => ({ ...g, coming: g.coming === true || g.coming === 'TRUE' || g.coming === 'SI', count: Number(g.count) || 0 }));
      subs.forEach((f) => f(guests));
    } catch (e) { console.warn('Sheet read failed', e); }
  };
  refresh(); setInterval(refresh, 60000);
  return {
    name: 'sheet',
    async add(r) {
      guests = [...guests, r]; subs.forEach((f) => f(guests));
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(r) });
      setTimeout(refresh, 2500);
    },
    onGuests(f) { subs.add(f); f(guests); },
  };
}

async function artifactBackend() {
  if (!window.claude?.use) return null;
  const db = await window.claude.use('db');
  if (!db) return null;
  const col = db.collection('rsvps');
  return {
    name: 'artifact',
    async add(r) { await col.add(r); },
    onGuests(f) { col.orderBy('at').onSnapshot((snap) => f(snap.docs.map((d) => d.data())), (e) => console.warn(e)); },
  };
}

/** Starts on the local backend at once, then switches when a shared one answers. */
export function createStore() {
  let backend = SHEET_URL ? sheetBackend(SHEET_URL) : localBackend();
  const subs = new Set();
  const fan = (g) => subs.forEach((f) => f(g));
  backend.onGuests(fan);
  if (!SHEET_URL) artifactBackend().then((b) => { if (b) { backend = b; b.onGuests(fan); } }).catch(() => {});
  return {
    get name() { return backend.name; },
    add: (r) => backend.add(r),
    onGuests(f) { subs.add(f); },
  };
}
