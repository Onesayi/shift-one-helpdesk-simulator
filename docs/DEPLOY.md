# Deploying to Library of Code Cloud Services

Shift One stays on GitHub Pages. This kit also serves it from a Library of Code Cloud Services container (CSG2), so it can run on your own domain on a box you manage. Each push to `main` runs the tests, uploads the site over SSH, switches to it in one step, and checks that the public URL serves the new version. If anything goes wrong, one command rolls it back.

It follows what the Library of Code team said in `#programming-support`:

- **There's no shared web root.** You run your own process on a port. Library of Code then opens the port and links your custom domain, and their reverse proxy forwards traffic to it (and handles HTTPS).
- **Build locally and push the output.** Shift One has no build step anyway, so the "build" just copies files. The server never runs Node or a bundler.
- **Keep resources small.** nginx-light serving static files uses a few MB of RAM. The Python fallback is capped at 64 MB in its unit file.

## What's in the kit

| File | Runs on | What it does |
|---|---|---|
| [`tools/build-site.sh`](../tools/build-site.sh) | CI or your machine | Copies the site into `_site/` and writes `version.txt` (the commit). GitHub Pages uses the same script |
| [`tools/deploy/install-server.sh`](../tools/deploy/install-server.sh) | The container, once, as root | Creates `/srv/shift-one/releases`, installs the nginx site for your port, and checks the config |
| [`tools/deploy/shift-one.nginx.conf`](../tools/deploy/shift-one.nginx.conf) | The container | The nginx site: your port, `root /srv/shift-one/current`, cache headers, no dotfiles |
| [`tools/deploy/shift-one-static.service`](../tools/deploy/shift-one-static.service) | The container | A fallback without nginx: Python's static server as a systemd user unit |
| [`tools/deploy/deploy.sh`](../tools/deploy/deploy.sh) | CI or your machine | Uploads a release with rsync, activates it, and health-checks the public URL |
| [`tools/deploy/activate.sh`](../tools/deploy/activate.sh) | The container (piped over SSH) | Swaps the `current` symlink and keeps the newest 5 releases. Also how you roll back |
| [`.github/workflows/deploy-loc.yml`](../.github/workflows/deploy-loc.yml) | GitHub Actions | Runs all of the above on every push to `main`. It's off until you set `LOC_DEPLOY` |

On the server it looks like this:

```
/srv/shift-one/
├── current -> releases/3f9c1e2…      what nginx serves
└── releases/
    ├── 3f9c1e2…/                     one folder per deploy (the commit), newest 5 kept
    └── a71b0d4…/
```

## One-time setup

### 1. Wait for the account

The application went in on 8 November 2026, and Library of Code takes up to 72 hours to decide. Nothing below works until the container exists.

### 2. Make a deploy user and install the server side

SSH into the container, then run:

```bash
sudo adduser --disabled-password --gecos "" deploy        # CI logs in as this user, never as root
git clone --depth 1 https://github.com/Onesayi/shift-one-helpdesk-simulator.git ~/shift-one-src
ss -ltn                                                   # pick a free port, e.g. 8090
sudo bash ~/shift-one-src/tools/deploy/install-server.sh 8090 deploy
curl -s http://127.0.0.1:8090/version.txt                 # prints "placeholder"
```

The script installs `nginx-light` if it's missing, writes `/etc/nginx/sites-available/shift-one`, removes nginx's stock welcome site (it isn't needed and fails on containers without IPv6), runs `nginx -t` and reloads. It's safe to run again, for example with a new port.

If you'd rather skip nginx, run `install-server.sh --python 8090 deploy` instead, then follow the two commands it prints. That sets up the systemd user unit with `loginctl enable-linger`, which is the pattern in the Library of Code FAQ. nginx is the better choice, and it's good practice for an IT support CV.

### 3. Ask for the port and the domain

Message the Cloud Services help desk with something like:

> Hi, my container is serving a static site on port 8090. Could you open that port and link my custom domain `<your domain>` to it? Also, can I SSH into the container from GitHub Actions to deploy, and if so on which host and port?

The last question matters. The automatic deploy needs SSH access from GitHub's runners. If they only allow SSH from certain places, use the manual deploy below.

### 4. Create a deploy key

On your own machine (on Windows, use WSL or Git Bash):

```bash
ssh-keygen -t ed25519 -N "" -C "shift-one github actions" -f loc_deploy
```

Put the **public** key on the server, limited so it can't open a shell with a terminal or forward ports:

```bash
sudo -u deploy mkdir -p ~deploy/.ssh
echo "restrict $(cat loc_deploy.pub)" | sudo -u deploy tee -a ~deploy/.ssh/authorized_keys
sudo chmod 700 ~deploy/.ssh && sudo chmod 600 ~deploy/.ssh/authorized_keys
```

Get the server's host key so CI can check it's talking to the right machine:

```bash
ssh-keyscan -p <ssh-port> <ssh-host> > known_hosts.txt
ssh-keygen -lf known_hosts.txt                      # compare with this, run on the server:
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

### 5. Add the settings to GitHub

In the repository, go to **Settings → Secrets and variables → Actions**.

| Kind | Name | Value |
|---|---|---|
| Secret | `LOC_SSH_KEY` | The whole **private** key file `loc_deploy` |
| Secret | `LOC_KNOWN_HOSTS` | The contents of `known_hosts.txt` |
| Variable | `LOC_SSH_HOST` | The host you SSH to |
| Variable | `LOC_SSH_PORT` | The SSH port (leave unset for 22) |
| Variable | `LOC_SSH_USER` | `deploy` |
| Variable | `LOC_SITE_URL` | Your public URL, e.g. `https://shiftone.example.org` |
| Variable | `LOC_SITE_ROOT` | Only if you used a different root than `/srv/shift-one` |
| Variable | `LOC_DEPLOY` | `true`. This switches the workflow on |

Then delete `loc_deploy` from your machine, or keep it somewhere safe.

### 6. First deploy

Go to **Actions → Deploy to Library of Code → Run workflow**. The workflow runs the tests, builds the site, uploads the release, switches to it, and then polls `LOC_SITE_URL/version.txt` until it shows the new commit. After that, every merge to `main` deploys on its own.

## Day to day

**Roll back.** On the server, run:

```bash
ls -t /srv/shift-one/releases                                          # newest first
sudo -u deploy bash ~/shift-one-src/tools/deploy/activate.sh /srv/shift-one <release>
```

**Deploy by hand** (from your machine, or if GitHub can't reach the container):

```bash
tools/build-site.sh
DEPLOY_HOST=<host> DEPLOY_SSH_PORT=<port> DEPLOY_USER=deploy \
DEPLOY_KEY_FILE=~/.ssh/loc_deploy SITE_URL=https://<your domain> tools/deploy/deploy.sh
```

**See what's live:** `curl -s https://<your domain>/version.txt`, then compare it with `git log -1 --format=%H`.

**Logs:** `/var/log/nginx/shift-one.access.log` and `shift-one.error.log`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Permission denied (publickey)` | The public key isn't in `~deploy/.ssh/authorized_keys`, the permissions on `.ssh` are too open, or the deploy user's password field is locked in a way sshd rejects (`sudo usermod -p '*' deploy` fixes that) |
| `Host key verification failed` | `LOC_KNOWN_HOSTS` is missing or out of date. Scan again and compare fingerprints |
| `curl 127.0.0.1:<port>` works on the server but the deploy waits forever on the URL | The port isn't open yet, or the domain isn't linked. That's the help desk request in step 3 |
| `nginx: [emerg] socket() [::]:80 failed` | The stock site's IPv6 listen. `install-server.sh` removes it; run it again |
| `No release at …` from `activate.sh` | The release name doesn't match a folder in `releases/`. Copy it from `ls -t` |

## How it was tested

The whole path ran on a local Ubuntu box against a real nginx and sshd: `install-server.sh`, a deploy through `deploy.sh` with the health check, six more deploys to check that only 5 releases are kept, a rollback with `activate.sh`, a health check against a wrong URL to make sure it fails, and the Python fallback serving through the symlink. What hasn't been tested is anything specific to Library of Code: their SSH access from GitHub's runners, and their reverse proxy.
