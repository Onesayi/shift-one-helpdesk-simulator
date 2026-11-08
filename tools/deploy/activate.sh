#!/usr/bin/env bash
# Runs on the server: makes one release live by swapping the `current` symlink, then prunes old
# releases. The deploy workflow pipes this over SSH; you can also run it by hand to roll back:
#   bash activate.sh /srv/shift-one <release> [keep]     # release = a folder name in releases/
#   ls -t /srv/shift-one/releases                        # newest first, to pick one
set -euo pipefail
root="${1:?usage: activate.sh <site-root> <release> [keep]}"
rel="${2:?usage: activate.sh <site-root> <release> [keep]}"
keep="${3:-5}"

[[ "$rel" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Bad release name: $rel" >&2; exit 1; }
[ -f "$root/releases/$rel/index.html" ] || { echo "No release at $root/releases/$rel" >&2; exit 1; }

# ln + mv -T replaces the symlink in one step, so no request ever sees a half-switched site.
ln -sfn "releases/$rel" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
touch "$root/releases/$rel"
echo "Live: $rel"

# Keep the newest $keep releases, the live one included. Release names are checked above
# ([A-Za-z0-9._-]), so parsing ls is safe here.
cd "$root/releases"
# shellcheck disable=SC2010
ls -1t | grep -vx "$rel" | tail -n +"$keep" | while read -r old; do
  [ -n "$old" ] && rm -rf -- "./$old" && echo "Pruned: $old"
done
