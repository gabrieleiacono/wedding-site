#!/bin/sh
# Builds the claude.ai preview: the page body without its own <html>/<head> wrapper (the host adds one).
set -e
OUT=${1:-dist}
rm -rf "$OUT" && mkdir -p "$OUT"
cp -r src vendor assets facts.html "$OUT"/
python3 - "$OUT" <<'PY'
import re, sys
s = open('index.html').read()
head = re.search(r'<head>(.*)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*)</body>', s, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
open(sys.argv[1] + '/index.html', 'w').write(head.strip() + '\n' + body.strip() + '\n')
PY
