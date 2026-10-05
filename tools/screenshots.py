"""Regenerate every README image: screenshots, the demo GIF and the banner.

Usage (from the repo root):
    python tools/screenshots.py              # everything
    python tools/screenshots.py pricing      # just the named screenshots

Needs Microsoft Edge or Google Chrome (headless) and Pillow (`pip install pillow`).
"""
import functools
import http.server
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screenshots"
FRAMES = ROOT / "docs" / ".frames"
PORT = 8799

# name: (page, width, height, virtual-time budget ms)
SHOTS = {
    "start": ("shot.html#start", 1440, 900, 4000),
    "queue": ("shot.html#queue", 1440, 900, 12000),
    "directory-dark": ("shot.html?theme=dark#directory", 1440, 900, 8000),
    "terminal": ("shot.html#terminal", 1440, 900, 8000),
    "remote-desktop": ("shot.html#remote", 1440, 900, 8000),
    "apps": ("shot.html#apps", 1440, 900, 6000),
    "server-room-dark": ("shot.html?theme=dark#server", 1440, 900, 8000),
    "network": ("shot.html#network", 1440, 900, 6000),
    "servers": ("shot.html#servers", 1440, 900, 6000),
    "social-engineering": ("shot.html#cfo", 1440, 900, 10000),
    "ticket-closed": ("shot.html#closed", 1440, 900, 10000),
    "report": ("shot.html#report", 1440, 1600, 45000),
    "pricing": ("shot.html?links=demo#pricing", 1440, 960, 4000),
    "phones-call": ("shot.html?shift=2#call", 1440, 900, 9000),
    "phones-voicemail": ("shot.html?shift=2#voicemail", 1440, 900, 6000),
    "phones-ransomware": ("shot.html?shift=2#ransom", 1440, 900, 8000),
    "phones-mfa-dark": ("shot.html?shift=2&theme=dark#mfa", 1440, 900, 8000),
    "phones-outage": ("shot.html?shift=2#outage", 1440, 900, 8000),
    "phones-storage": ("shot.html?shift=2#storage", 1440, 900, 6000),
    "phones-report": ("shot.html?shift=2#report2", 1440, 1600, 45000),
    "mobile": ("mobile.html", 1100, 900, 16000),
    "coordinator-board": ("dispatch-shot.html#board", 1440, 900, 4000),
    "coordinator-dispatch-dark": ("dispatch-shot.html?theme=dark#dispatch", 1440, 900, 4000),
    "coordinator-call": ("dispatch-shot.html#call", 1440, 900, 4000),
    "coordinator-report": ("dispatch-shot.html#report", 1440, 1600, 4000),
}
FLOW_STEPS = 7


def find_browser():
    """Chrome first: Edge silently refuses to run headless while an update is staged."""
    if os.environ.get("SCREENSHOT_BROWSER"):
        return os.environ["SCREENSHOT_BROWSER"]
    candidates = [shutil.which(n) for n in ("google-chrome", "chromium", "chromium-browser", "chrome")]
    candidates += [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("msedge"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    sys.exit("No Chrome/Edge found for headless screenshots (or set SCREENSHOT_BROWSER).")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        # headless browsers reuse their cache between runs; always serve fresh files
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def capture(browser, url, path, w, h, budget=12000):
    # A throwaway profile stops headless runs from attaching to an already-open
    # browser window (which silently skips the screenshot) or reusing its cache.
    path = Path(path)
    before = path.stat().st_mtime if path.exists() else 0
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([
            browser, "--headless=new", f"--user-data-dir={profile}", "--no-first-run", "--disable-gpu",
            "--hide-scrollbars", "--force-device-scale-factor=1",
            f"--window-size={w},{h}", f"--virtual-time-budget={budget}", f"--screenshot={path}", url,
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not path.exists() or path.stat().st_mtime == before:
        sys.exit(f"Screenshot was not written: {path}")


def main():
    browser = find_browser()
    OUT.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    base = f"http://127.0.0.1:{PORT}/tools"
    only = set(sys.argv[1:])  # e.g. `python tools/screenshots.py pricing queue` redoes just those
    try:
        for name, (page, w, h, budget) in SHOTS.items():
            if only and name not in only:
                continue
            print("shot", name)
            capture(browser, f"{base}/{page}", OUT / f"{name}.png", w, h, budget)
        if only:
            return

        print("gif frames")
        frames = []
        for i in range(FLOW_STEPS):
            p = FRAMES / f"flow{i}.png"
            capture(browser, f"{base}/shot.html#flow{i}", p, 1440, 900)
            frames.append(Image.open(p).convert("RGB").resize((960, 600), Image.LANCZOS))
        durations = [1400, 1400, 1800, 2200, 1800, 2200, 3200]
        palette_frames = [f.quantize(colors=256, method=Image.Quantize.MEDIANCUT) for f in frames]
        palette_frames[0].save(ROOT / "docs" / "demo.gif", save_all=True, append_images=palette_frames[1:],
                               duration=durations, loop=0, optimize=True)

        print("banner")
        capture(browser, f"{base}/banner.html", ROOT / "docs" / "banner.png", 1280, 640)
    finally:
        httpd.shutdown()
        shutil.rmtree(FRAMES, ignore_errors=True)
    print("done ->", OUT)


if __name__ == "__main__":
    main()
