#!/usr/bin/env bash
# Assembles the static site into one folder. GitHub Pages and the Library of Code deploy both use
# this, so the two hosts always serve the same files.
#   tools/build-site.sh [out-dir]   (default: _site)
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-_site}"
rm -rf "$out"
mkdir -p "$out/docs"
cp -r index.html dispatch.html css js "$out/"
cp docs/banner.png "$out/docs/"
touch "$out/.nojekyll"
# Which commit is live: the deploy's health check reads this back through the public URL.
git rev-parse HEAD > "$out/version.txt" 2>/dev/null || echo unknown > "$out/version.txt"
echo "Built site in $out ($(find "$out" -type f | wc -l) files)"
