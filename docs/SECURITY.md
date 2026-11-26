# Security

Shift One is a static site: HTML, CSS and JavaScript, with no server code, no database, no accounts and no API keys. Everything a player does stays in their own browser (`localStorage`). That rules out most of the usual web-app risks, and the ones that are left are covered below.

To report a problem, open an issue (or a private security advisory under the repository's **Security** tab if it's sensitive).

## Checklist (audited 26 Nov 2026)

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Hide API keys | Pass | The site uses no API keys. Payment buttons are plain links to hosted checkout pages (`js/config.js`). |
| 2 | Check env variables | Pass | No `.env` files and no build step. The deploy workflow reads its SSH key from GitHub Actions secrets and deletes it after the run. |
| 3 | Check keys in git | Pass | Full history scanned for private keys and common token formats: nothing found. `tests/security/` re-checks tracked files on every push, and `.gitignore` blocks `.env` and key files. |
| 4 | Protect admin routes | N/A | There are no admin pages. The live server only serves files and hides dotfiles. |
| 5 | Add auth | N/A | No accounts by design. |
| 6 | Check user permissions | N/A | No users or roles on the server. |
| 7 | Sanitize user inputs | Pass (fixed) | Everything typed is escaped with `esc()` before it's shown. One gap fixed: a saved assessment answer read back from `localStorage` was shown unescaped (`js/dispatch/interview.js`). |
| 8 | Protect against XSS | Pass (fixed) | The escape fix above, plus a Content-Security-Policy that lets only the site's own script files run, so injected `<script>` or `onerror=` code is blocked even if something slips through. |
| 9 | SQL injection | N/A | No database. |
| 10 | Check DB rules | N/A | No database. |
| 11 | Rate limiting | N/A | No API or form endpoints. The LoC gateway and GitHub Pages handle abuse of plain file requests. |
| 12 | Spend cap | N/A | No paid APIs or usage billing. |
| 13 | Secure file uploads | N/A | Nothing is uploaded. |
| 14 | CSRF | N/A | No server-side actions or logged-in sessions to forge. The CSP also sets `form-action 'self'`. |
| 15 | CORS | Pass | No API, and no `Access-Control-Allow-Origin` header is sent, which is the safe default. |
| 16 | HTTPS | Pass | GitHub Pages and the LoC gateway both serve HTTPS. The header snippet adds HSTS so browsers stay on HTTPS. |
| 17 | Security headers | Action needed | The live LoC server sends none yet. Apply `tools/deploy/security-headers.conf` (steps below). GitHub Pages can't set headers, so the CSP is also in each page as a `<meta>` tag. |
| 18 | Secure cookies | N/A | The site sets no cookies (checked on the live server). |
| 19 | Disable debug mode | Pass | No debug flags, `console.log` calls or source maps in the shipped files. |
| 20 | Check prod settings | Pass (after 17) | The deploy ships only `index.html`, `dispatch.html`, `css/`, `js/` and the banner (`tools/build-site.sh`); tests, tools and docs stay out. The snippet also turns off the nginx version in the `Server` header. |

## What the headers do

`tools/deploy/security-headers.conf` sets:

- **Content-Security-Policy**: only scripts from this site run; fonts come from Google Fonts; no plugins; the site can't be framed (`frame-ancestors 'none'`). It must match the `<meta>` tag in `index.html` and `dispatch.html`; a test checks this.
- **X-Frame-Options: DENY**: stops clickjacking in older browsers.
- **X-Content-Type-Options: nosniff**, **Referrer-Policy**, **Permissions-Policy** (no camera, mic, location or payment APIs), **Cross-Origin-Opener-Policy**.
- **Strict-Transport-Security** for one year, without `includeSubDomains` (we don't own `libraryofcode.dev`).

`style-src` allows `'unsafe-inline'` because the Dispatch Board positions its blocks with inline `style="left:…"`. That only affects styling, not scripts.

One nginx rule to remember: a `location` block with its own `add_header` (like the `Cache-Control` ones) drops every `add_header` from the server block. That's why `shift-one.nginx.conf` includes the snippet inside each of those locations too.

## Apply the headers on the live LoC server (VPS 114)

The live site at `shift-one.apps.libraryofcode.dev` runs a hand-made nginx site on port 80 with web root `/var/www/shift-one`, not the `install-server.sh` layout. These steps change only that nginx site; nothing in Platform Control or the gateway changes.

1. Open a shell on the VPS (LOCGATE web terminal or `ssh` through Warpgate).
2. Install the snippet (after this change is merged to `main`):
   ```sh
   sudo mkdir -p /etc/nginx/snippets
   sudo curl -fsSL https://raw.githubusercontent.com/Onesayi/shift-one-helpdesk-simulator/main/tools/deploy/security-headers.conf \
     -o /etc/nginx/snippets/shift-one-security.conf
   ```
3. Find the site file and back it up:
   ```sh
   SITE=$(grep -rl "/var/www/shift-one" /etc/nginx/sites-enabled/ | head -1); echo "$SITE"
   sudo cp "$SITE" ~/nginx-site-backup.conf
   ```
4. Edit it (`sudo nano "$SITE"`). Inside `server { … }`, add these two lines just under the `root` line:
   ```nginx
   include snippets/shift-one-security.conf;
   server_tokens off;
   ```
   If any `location { … }` in that file has its own `add_header`, add the `include` line inside that location as well.
5. Test and reload. If `nginx -t` fails, nothing has changed yet; fix the typo or restore the backup.
   ```sh
   sudo nginx -t && sudo systemctl reload nginx
   ```
6. Check (should list 7 headers):
   ```sh
   curl -sI http://localhost/ | grep -iE "content-security|x-frame|nosniff|referrer-policy|permissions|strict-transport|cross-origin-opener"
   ```
7. Deploy the new site files so the pages get the CSP `<meta>` tag and the escape fix. Build first, so only the site files go live (not `.git`, tests or tools):
   ```sh
   cd <your checkout> && git pull && bash tools/build-site.sh /tmp/shift-one-site
   sudo rsync -a --delete /tmp/shift-one-site/ /var/www/shift-one/
   ```
   Then open the site, start a shift and the interview prep, and check the browser console for any "Content Security Policy" errors.

**Roll back:** `sudo cp ~/nginx-site-backup.conf "$SITE" && sudo nginx -t && sudo systemctl reload nginx`.

If the LoC gateway (Caddy) ever starts adding its own copy of a header, browsers use the stricter of the two for CSP, so nothing breaks.
