#!/usr/bin/env python3
"""Turn a folder of photos into the web-sized copies the cork board and the photo viewer use.

    python3 tools/build-photos.py path/to/originals

For every image in the folder (sorted by file name, which is the order guests browse them in):
  - turns it upright from its EXIF orientation, then drops all metadata (GPS included);
  - writes assets/photos/l/NN.jpg, at most 1600 px on the long side, for the viewer;
  - writes assets/photos/s/NN.jpg, at most 480 px on the long side, for the board and as the
    viewer's placeholder while the big one loads;
and writes src/photos.js with the list (paths and sizes). Running it again replaces them all.
"""
import json
import pathlib
import sys

from PIL import Image, ImageOps

try:  # iPhone photos
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'photos'
SIZES = {'l': (1600, 80), 's': (480, 76)}  # name: (long edge, JPEG quality)
EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff'}


def main(src):
    files = sorted(p for p in pathlib.Path(src).iterdir() if p.suffix.lower() in EXTS)
    if not files:
        sys.exit(f'no photos in {src}')
    for name in SIZES:
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob('*.jpg'):
            old.unlink()
    photos = []
    for i, f in enumerate(files, 1):
        im = ImageOps.exif_transpose(Image.open(f))
        im = im.convert('RGB')
        stem = f'{i:02d}'
        entry = {}
        for name, (edge, q) in SIZES.items():
            k = min(1, edge / max(im.size))
            out = im if k == 1 else im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            path = OUT / name / f'{stem}.jpg'
            out.save(path, 'JPEG', quality=q, optimize=True, progressive=True, subsampling='4:2:0')
            entry[name] = f'assets/photos/{name}/{stem}.jpg'
            if name == 'l':
                entry['w'], entry['h'] = out.size
        photos.append(entry)
        print(f'{f.name} -> {stem} {entry["w"]}x{entry["h"]}')
    js = ('// Made by tools/build-photos.py from the original photos: do not edit by hand.\n'
          '// In browsing order. l: up to 1600 px (the viewer), s: up to 480 px (the cork board); w × h of l.\n'
          'export const PHOTOS = [\n' +
          ''.join(f'  {json.dumps(p, separators=(", ", ": "))},\n' for p in photos) +
          '];\n')
    (ROOT / 'src' / 'photos.js').write_text(js)
    total = sum(p.stat().st_size for p in OUT.rglob('*.jpg'))
    print(f'{len(photos)} photos, {total / 1e6:.1f} MB in assets/photos')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
