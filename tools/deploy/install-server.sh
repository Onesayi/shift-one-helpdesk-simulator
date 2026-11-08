#!/usr/bin/env bash
# One-time setup on the Library of Code container. Run as root (CSG2 gives you root), after you
# have your assigned port:
#   sudo bash install-server.sh <port> <deploy-user> [site-root]           # nginx (recommended)
#   sudo bash install-server.sh --python <port> <deploy-user> [site-root]  # no nginx, see below
# It creates the release folders, installs the web server config for your port, and checks it.
# Safe to run again: it rewrites its own config and leaves releases alone.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

mode=nginx
if [ "${1:-}" = "--python" ]; then mode=python; shift; fi
port="${1:?usage: install-server.sh [--python] <port> <deploy-user> [site-root]}"
user="${2:?usage: install-server.sh [--python] <port> <deploy-user> [site-root]}"
root="${3:-/srv/shift-one}"

if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
  echo "Port must be a number from 1024 to 65535." >&2; exit 1
fi
id "$user" >/dev/null 2>&1 || { echo "User $user doesn't exist. Create it first: adduser $user" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run this as root (sudo)." >&2; exit 1; }

# Release folders, owned by the deploy user so CI can upload without root.
mkdir -p "$root/releases"
chown "$user:$user" "$root" "$root/releases"
chmod 755 "$root" "$root/releases"
if [ ! -e "$root/current" ]; then
  mkdir -p "$root/releases/placeholder"
  echo '<!doctype html><title>Shift One</title><p>Shift One is being set up. The first deploy replaces this page.</p>' > "$root/releases/placeholder/index.html"
  echo placeholder > "$root/releases/placeholder/version.txt"
  chown -R "$user:$user" "$root/releases/placeholder"
  ln -sfn releases/placeholder "$root/current"
  chown -h "$user:$user" "$root/current"
fi

if [ "$mode" = nginx ]; then
  command -v nginx >/dev/null || { apt-get update -q && apt-get install -y -q nginx-light; }
  sed -e "s|__PORT__|$port|g" -e "s|__ROOT__|$root|g" "$here/shift-one.nginx.conf" > /etc/nginx/sites-available/shift-one
  ln -sfn /etc/nginx/sites-available/shift-one /etc/nginx/sites-enabled/shift-one
  # nginx's stock welcome site isn't needed (Library of Code proxies to our port, not 80), and its
  # IPv6 listen fails on containers without IPv6. Only the stock symlink is removed.
  [ -L /etc/nginx/sites-enabled/default ] && rm /etc/nginx/sites-enabled/default
  nginx -t
  if command -v systemctl >/dev/null && systemctl is-system-running >/dev/null 2>&1; then
    systemctl enable --now nginx >/dev/null && systemctl reload nginx
  else
    nginx -s reload 2>/dev/null || nginx
  fi
  echo "nginx is serving $root/current on port $port."
else
  home="$(getent passwd "$user" | cut -d: -f6)"
  mkdir -p "$home/.config/systemd/user"
  sed -e "s|__PORT__|$port|g" -e "s|__ROOT__|$root|g" "$here/shift-one-static.service" > "$home/.config/systemd/user/shift-one-static.service"
  chown -R "$user:$user" "$home/.config"
  loginctl enable-linger "$user" || true
  echo "Installed the user unit. As $user, run:"
  echo "  systemctl --user daemon-reload && systemctl --user enable --now shift-one-static"
fi

echo "Check it from the container:  curl -s http://127.0.0.1:$port/version.txt"
echo "Next: ask Library of Code to open port $port and link your custom domain to it."
