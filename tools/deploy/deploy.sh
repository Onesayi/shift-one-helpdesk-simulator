#!/usr/bin/env bash
# Uploads a built site to the container and makes it live. The GitHub Action runs this; you can
# run it from your own machine too. Settings come from the environment:
#   DEPLOY_HOST, DEPLOY_USER       where to SSH (required)
#   DEPLOY_SSH_PORT                default 22
#   DEPLOY_KEY_FILE                private key to use (default: your SSH agent / ~/.ssh)
#   DEPLOY_ROOT                    site root on the server, default /srv/shift-one
#   SITE_DIR                       the built site, default _site (tools/build-site.sh)
#   RELEASE                        release name, default the commit in SITE_DIR/version.txt
#   SITE_URL                       optional public URL; if set, the deploy waits until it serves this release
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
host="${DEPLOY_HOST:?set DEPLOY_HOST}"
user="${DEPLOY_USER:?set DEPLOY_USER}"
port="${DEPLOY_SSH_PORT:-22}"
root="${DEPLOY_ROOT:-/srv/shift-one}"
site="${SITE_DIR:-_site}"
[ -f "$site/index.html" ] || { echo "No site in $site. Run tools/build-site.sh first." >&2; exit 1; }
version="$(cat "$site/version.txt")"
release="${RELEASE:-$version}"

ssh_cmd=(ssh -p "$port" -o BatchMode=yes)
[ -n "${DEPLOY_KEY_FILE:-}" ] && ssh_cmd+=(-i "$DEPLOY_KEY_FILE" -o IdentitiesOnly=yes)

echo "Uploading $site to $user@$host:$root/releases/$release"
rsync -rlz --delete --chmod=D755,F644 -e "${ssh_cmd[*]}" "$site/" "$user@$host:$root/releases/$release/"

echo "Activating $release"
"${ssh_cmd[@]}" "$user@$host" bash -s -- "$root" "$release" < "$here/activate.sh"

if [ -n "${SITE_URL:-}" ]; then
  url="${SITE_URL%/}/version.txt"
  for i in 1 2 3 4 5 6; do
    live="$(curl -fsS --max-time 10 "$url" 2>/dev/null || true)"
    if [ "$live" = "$version" ]; then
      curl -fsS --max-time 10 "${SITE_URL%/}/dispatch.html" | grep -q 'Shift One' || { echo "dispatch.html didn't load from $SITE_URL" >&2; exit 1; }
      echo "Healthy: $SITE_URL is serving $version"
      exit 0
    fi
    echo "Waiting for $url to show $version (got '${live:-nothing}'), try $i of 6"
    sleep 5
  done
  echo "$SITE_URL never served $version. Check the port open and domain link with Library of Code." >&2
  exit 1
fi
