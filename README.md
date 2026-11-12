# Lo Scrittoio con Vista

An interactive wedding announcement: a 1990s Italian study at sunset, drawn in pen and ink.
Turn around the room; every piece of wedding information lives in an object.

- **Typewriter**: RSVP (5 questions on the LCD, type with your keyboard)
- **TV + remote**: teletext pages (100 index, 101 programme, 200 travel, 300 weather, 400 dress code, 500 RSVP, 600 live guestbook, 700 FAQ, 888 hidden; a page too long for one screen is split into subpages, turned with ◀ ▶ on the remote, the arrow keys or a tap on the screen; a yellow CONTINUA bar under the last line says there is more, and the remote's ▶ lights up). AV = the console's tennis game. The remote's red POWER key switches the set off (the picture squeezes to a line and a dot, as on a CRT) and takes you back to the room; going back to the TV switches it on again. On a phone the remote stays small while you read (page display, ◀ ▶, coloured keys): its number pad opens with 123 and folds again once the page comes up, and A+ (the old remotes' SIZE key) redraws the pages in 28 bigger columns.
- **Album**: photos
- **LEGGIMI**: the glowing gold book lying on the desk, right of the typewriter, where the notebooks used to be. Tap it and it props itself up, cover to you, and its text opens
- **Bookshelf**: 383 real books in their Italian editions. Tap a book (or the Aa hotspot) to get close to a shelf: drag along it, ▲▼ to change shelf, author chips to jump, pinch or wheel to zoom. Tap a book to take it out and read its library card. On the third shelf a friend's novel, *La causa dei vivi* (Anna Gabriella Rusconi, Cronache Ribelli), stands face-out on a little stand: taken out, it turns to show its cover (tap it to turn it over) and its card links to the publisher's page. On the second shelf from the bottom, right, lies a bottle-green tennis racket bag
- **Bike**: a yellow Wheeler 2100 in the corner between the TV and the shelf. Tap it, the pedals above all, and the pedals get a push backwards (one tap = one turn), clicking like a freewheel at exactly the speed they turn; taps add up. Tap it faster than 5 a second (8 taps within 1.5 s) and the chain falls off the ring, for good until the page is reloaded.
- **Tennis racket**: an old 1970s wooden racket (laminated frame, gut strings, leather grip) hangs on a nail on the wall right of the bookshelf, before the corner with the door. Tap it and it rocks on its nail.
- **Bass**: the real one, from a photo: a Squier 40th Anniversary Jazz Bass (Gold Edition, metallic ruby) hangs by its neck on a wall hanger in the corner of the desk wall by the door. Tap it to go up close and pluck a string; up close, each tap plucks the string nearest to it (E, A, D or G), and the string shivers while it rings.
- **Due terre**: two framed prints on the desk wall, right of the window: a graphite rubbing of the rock carvings in Valle Camonica (Darfo) and an etching of San Giorgio in Modica. Tap them to look closer.
- **Il cestino delle bozze**: a wicker bin right of the desk, full of crumpled drafts of the invitation, one smoothed out on the floor. Tap it to pull out a draft; the drafts (`DRAFTS` in `content.js`) are crossed out with a note in red, until the one that went out.
- **Il tappeto**: a Sicilian frazzata (rag rug) in the middle of the floor.
- **Window**: living landscape (trains on the viaduct, donkeys and foals, rooster, swallows); pull the shutter strap
- **Lamp**: comes on by itself at the blue hour; click it to turn it on or off.
- **Calendar**: countdown. **Phone**: FAQ.
- `facts.html`: "Solo i fatti", a plain text version of everything.

Design: see `knowledge/claude/final-design-scrittoio-con-vista.md` in the project files.

## Run it

No build step. Serve the folder and open it:

```
python3 -m http.server 8000
# open http://localhost:8000
```

Deep links for testing: `?wall=0..3` faces a wall, `?focus=typewriter|tv|album|leggimi|calendar|...` opens an object, `?shelf=0..3` opens a shelf close-up (0 = top) and `&book=N` takes out its Nth book. `?pitch=-40` starts looking that many degrees down (the lean over the desk), Dragging moves the room with your finger both ways (drag up to look down); `?look=tilt` flips the vertical back so dragging down looks down.

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
| `src/shelfview.js` | Shelf close-up and taking a book out (its library card notes live in `BOOK_NOTES` in `content.js`); a book with a `shop` link is held cover first, with its card beside it |
| `src/friendbook.js` | *La causa dei vivi*: its spine for the shelf, and the paperback you take out (cover boards, spine, red flaps, page block; front cover from `assets/books/`, back drawn in Cinzel). Its card text and link are `FRIEND_BOOK` in `content.js` |
| `src/landscape.js` | The view from the window: 3D terrain, fields, trees, casale, chapel, hill town, viaduct and trains, sky and clouds |
| `src/creatures.js` | Articulated donkeys, foals, rooster and swallows, with their little behaviours |
| `src/typewriter-model.js` | The detailed electronic typewriter (keys, legends, LCD, paper slot) |
| `src/console.js` | The first PlayStation (SCPH-1000/1002) under the TV, at real size: deck and raised panels, the round lid with its SONY / PlayStation top, RESET, POWER and OPEN, the LED, the front block with the memory card slots and controller ports (the pad's plug in port 1), vented flanks |
| `src/phone.js` | The Sirio-style desk phone with its keypad and coiled cord |
| `src/lamp.js` | The desk lamp: a Caltagirone majolica baluster with a pleated linen shade that glows at the blue hour; a click on it turns it on or off (main.js, `toggleLamp`) |
| `src/racket.js` | The old wooden tennis racket on the wall right of the bookshelf: frame extruded from its outline with the laminations drawn on its face, walnut throat wedge, woven gut strings as one texture, spiral leather grip; a tap swings it on its nail (main.js), damped like a pendulum (constants `NAIL` and `SWING` at the top) |
| `src/bass.js`, `src/bass-outline.js` | The bass on the desk wall, from a photo of the instrument: the body, the pickguard and control plate, and the headstock are outlines traced off the photo (`bass-outline.js`, in millimetres, scaled to a 34" scale) and extruded; the rest is built to the instrument's measurements: a neck tapering 38 → 60 mm, a bound 7¼"-radius rosewood board with pearloid blocks and 20 frets at their true positions, the four-saddle bent-plate bridge, two J pickups, knobs and jack, open-gear tuners with cloverleaf keys, strings of real gauges. Textures (metallic ruby, brushed gold, the board, the maple headstock with its decal) are drawn in canvas. `pluck()` finds the nearest string to a tap and `tick()` blurs it while it rings (the strings don't cast shadows, so the shadow map isn't redrawn); `AT` and `LEAN` at the top place it |
| `src/keepsakes.js`, `src/keepsakes-art.js` | The two prints right of the window, the wicker bin of drafts by the desk, and the frazzata rug; the pictures (rubbing, etching, wicker, the draft on the floor, the rug's weave) are drawn in canvas in `keepsakes-art.js` |
| `src/bike.js` | The 1990s Wheeler 2100 Pro Line in neon yellow, between the TV and the bookshelf: frame paint (splatter and decals) drawn into one texture, every other fixed part merged into one mesh, spokes as lines; the crank set, the two pedals and the chain are their own meshes so a tap can push them round, and the chain is a rope that can fall off (the constants for the push, the friction and the spam limit are at the top of the file) |
| `src/ficodindia.js` | The ficu d'India (prickly pear, *Opuntia ficus-indica*) in its terracotta pot left of the TV, from photos: obovate pads, each growing from the rim of the one below and mostly turned to the room, with areoles in staggered rows (one instanced mesh) and a few pale spines (lines); ripe fruits along two pads' tops, one open yellow flower and a bud, a new pad with its little leaves; a rolled-rim pot with mineral bloom, on a saucer, with grit on the soil. Pads, fruits, flower and pot are one vertex-coloured mesh; `BOUNDS` keeps the pads off the wall and the cabinet |
| `src/mini.js` | The 1:12 model of a classic Mk1 Mini on the bookshelf, next to the tennis trophy: British racing green with twin white stripes over bonnet and roof, on a walnut base. Shaped from photos of real Minis (`wedding-site-shots/mini/refs` in the project files) and the real car's measurements in full-size millimetres, shrunk 12 times (254 mm long): one side profile with the arches cut out, bellied and narrowed per vertex, merged into one vertex-coloured mesh; the number plates (`PLATE`) are drawn in canvas |
| `src/tennisbag.js` | The tennis racket bag on the second shelf from the bottom (right-hand bay), from photos of real six-racket bags (`wedding-site-shots/tennis-bag/refs` in the project files): a superquadric body, padded and wedge-shaped like a real racket bag (tall and round at the racket-head end, the top sloping down to a handle end less than half as high and a little narrower) (`BAG` holds its size, `C` its colours), with cream piping round the side panels, two main zips with pullers, a padded front pocket with its zip and a plain badge, carry handles sewn on with box-and-cross stitching and a wrapped grip, and a shoulder strap on D-rings with its pad over the front edge. Bands, cords and small parts are laid on the surface along paths in its (θ, φ) coordinates, then everything is merged into one vertex-coloured mesh |
| `src/geo.js` | Noise and geometry helpers shared by the landscape and the animals |
| `src/leggimi.js` | The LEGGIMI book on the desk: spine from `spines.js`, a cover drawn in canvas, and how it props itself up when tapped |
| `src/overlays.js` | Album, LEGGIMI, cards, calendar, a draft from the bin, credits (and the notebooks' stories, not opened from the room any more) |
| `src/audio.js` | Synthesised sounds (including the bicycle freewheel's ratchet, a plucked bass string and crumpled paper) |
| `src/store.js` | RSVP storage (Google Sheet / claude.ai / local) |
| `src/main.js` | Lights, camera rig, hotspots, frame loop |

Three.js r169 is vendored in `vendor/`. Everything is built in code for now; the plan is to swap props for Blender-made models with baked sunset light (design F9).
