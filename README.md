# Lo Scrittoio con Vista

An interactive wedding announcement: a 1990s Italian study at sunset, drawn in pen and ink.
Turn around the room; every piece of wedding information lives in an object.

- **Typewriter**: RSVP (6 questions on the LCD, type with your keyboard)
- **TV + remote**: teletext pages (100 index, 101 programme, 200 travel, 210 stay, 300 weather, 400 dress code, 500 RSVP, 600 live guestbook, 700 FAQ, 888 hidden). AV = the console's tennis game.
- **Album, notebooks**: photos and five short stories
- **Bookshelf**: 383 real books in their Italian editions. Tap a book (or the Aa hotspot) to get close to a shelf: drag along it, ▲▼ to change shelf, author chips to jump, pinch or wheel to zoom. Tap a book to take it out and read its library card. The glowing LEGGIMI book, the hi-fi playlist
- **Bike**: a yellow Wheeler 2100 in the corner between the TV and the shelf. Tap it, the pedals above all, and the pedals get a push backwards (one tap = one turn), clicking like a freewheel at exactly the speed they turn; taps add up. Tap it faster than 5 a second (8 taps within 1.5 s) and the chain falls off the ring, for good until the page is reloaded.
- **Window**: living landscape (trains on the viaduct, donkeys and foals, rooster, swallows); pull the shutter strap
- **Calendar**: countdown. **Phone**: FAQ.
- `facts.html`: "Solo i fatti", a plain text version of everything.

Design: see `knowledge/claude/final-design-scrittoio-con-vista.md` in the project files.

## Run it

No build step. Serve the folder and open it:

```
python3 -m http.server 8000
# open http://localhost:8000
```

Deep links for testing: `?wall=0..3` faces a wall, `?focus=typewriter|tv|album|notebooks|calendar|...` opens an object, `?shelf=0..3` opens a shelf close-up (0 = top) and `&book=N` takes out its Nth book. `?pitch=-40` starts looking that many degrees down (the lean over the desk), and `?look=grab` flips the vertical drag so the room follows your finger (drag up to look down).

## Edit the content

All text guests read is in `src/content.js` (anything in [square brackets] is a placeholder).
Photos: set `src` on each entry of `PHOTOS`.

## RSVPs to a Google Sheet

1. Create a Google Sheet, open Extensions → Apps Script, paste `apps-script/Code.gs`.
2. Deploy → New deployment → Web app, execute as *Me*, access *Anyone*.
3. Put the `/exec` URL in `SHEET_URL` in `src/store.js`.

Without it, RSVPs are kept in the claude.ai preview's database, or in the browser when run locally.

## Code map

| File | What |
|---|---|
| `src/ink.js` | Ink look: hatching shader (6 levels, world-fixed), wood grain, herringbone parquet, outline + paper-grain post pass |
| `src/room.js` | Room shell, window + shutter, desk props, door wall |
| `src/typewriter.js` | Typewriter model, LCD, paper, RSVP flow |
| `src/teletext.js`, `src/tennis.js` | Teletext engine + pages, AV tennis |
| `src/tv.js`, `src/bookshelf.js` | East and south walls; the bookshelf draws each shelf as two meshes so its spines can swap to a sharper texture |
| `src/spines.js` | Spines drawn in canvas from the research data (typography, publisher marks, wear) and packed into atlases |
| `src/shelfview.js` | Shelf close-up and taking a book out (its library card notes live in `BOOK_NOTES` in `content.js`) |
| `src/landscape.js` | The view from the window: 3D terrain, fields, trees, casale, chapel, hill town, viaduct and trains, sky and clouds |
| `src/creatures.js` | Articulated donkeys, foals, rooster and swallows, with their little behaviours |
| `src/typewriter-model.js` | The detailed electronic typewriter (keys, legends, LCD, paper slot) |
| `src/phone.js` | The Sirio-style desk phone with its keypad and coiled cord |
| `src/lamp.js` | The desk lamp: a Caltagirone majolica baluster with a pleated linen shade that glows at the blue hour |
| `src/bike.js` | The 1990s Wheeler 2100 Pro Line in neon yellow, between the TV and the bookshelf: frame paint (splatter and decals) drawn into one texture, every other fixed part merged into one mesh, spokes as lines; the crank set, the two pedals and the chain are their own meshes so a tap can push them round, and the chain is a rope that can fall off (the constants for the push, the friction and the spam limit are at the top of the file) |
| `src/geo.js` | Noise and geometry helpers shared by the landscape and the animals |
| `src/overlays.js` | Album, notebooks, cards, calendar, credits |
| `src/audio.js` | Synthesised sounds (including the bicycle freewheel's ratchet) |
| `src/store.js` | RSVP storage (Google Sheet / claude.ai / local) |
| `src/main.js` | Lights, camera rig, hotspots, frame loop |

Three.js r169 is vendored in `vendor/`. Everything is built in code for now; the plan is to swap props for Blender-made models with baked sunset light (design F9).
