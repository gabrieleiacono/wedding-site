// The room is in Rome: its clocks show Rome time (Europe/Rome, with summer time),
// whatever time zone the visitor is in.
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
let lastSec = NaN, last = { h: 0, m: 0, s: 0 };

/** Hours (0–23), minutes and seconds in Rome right now. Worked out at most once a second. */
export function romeTime(ms = Date.now()) {
  const sec = Math.floor(ms / 1000);
  if (sec !== lastSec) {
    lastSec = sec;
    const p = {};
    for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = +value;
    last = { h: p.hour % 24, m: p.minute, s: p.second };
  }
  return last;
}
