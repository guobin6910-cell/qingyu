#!/usr/bin/env python3
"""Generate hand-painted terrain tiles + upgraded battlefield panoramas for 青嶼戰記."""
import time, urllib.parse, urllib.request, io
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

OUT = Path("/workspace/qingyu/src/assets/art")
TILES = OUT / "tiles"
RAW = Path("/tmp/qingyu_battle_art")
RAW.mkdir(parents=True, exist_ok=True)
TILES.mkdir(parents=True, exist_ok=True)

STYLE = (
  "hand-painted fantasy SRPG terrain tile, Taiwan coastal island wuxia aesthetic, "
  "rich oil-paint brush strokes, soft golden rim light, teal sea accents, "
  "subtle isometric sculpted depth with soft shadow, seamless square tile texture, "
  "no text, no UI, no watermark, no logo, no characters, high detail"
)

TILE_JOBS = [
  {"file": "plain.png", "seed": 7101, "prompt": STYLE + ", lush emerald grass meadow with soft dirt path flecks, wildflowers, gentle height variation"},
  {"file": "forest.png", "seed": 7102, "prompt": STYLE + ", dense pine and bamboo forest canopy top-down-ish, mossy ground, dappled light, deep greens"},
  {"file": "hill.png", "seed": 7103, "prompt": STYLE + ", rocky highland hill stone and short grass, cliff ridge, warm gray-green, sculpted elevation"},
  {"file": "wall.png", "seed": 7104, "prompt": STYLE + ", ancient mossy stone fortification wall top, carved blocks, gold-teal lichen, impassable fortress"},
  {"file": "ford.png", "seed": 7105, "prompt": STYLE + ", shallow teal river ford with stones and rippling water, wet sand banks, sparkling highlights"},
  {"file": "village.png", "seed": 7106, "prompt": STYLE + ", coastal village plaza cobblestones, wooden eaves hint, warm lantern glow, friendly settlement"},
  {"file": "shop.png", "seed": 7107, "prompt": STYLE + ", market stall plaza with crates and teal awning fabric, gold trim, trading post floor"},
  {"file": "secret.png", "seed": 7108, "prompt": STYLE + ", ancient glowing rune stone circle on grass, soft cyan mystical aura, hidden shrine tile"},
  {"file": "harbor.png", "seed": 7109, "prompt": STYLE + ", wooden harbor pier planks with rope and teal water between boards, wet wood sheen"},
]

BG_STYLE = (
  "epic hand-painted fantasy SRPG battlefield panorama, Taiwan island wuxia, "
  "gorgeous cinematic lighting, floating coastal cliffs, fluffy clouds, rich color grading, "
  "no text, no UI, no watermark, no logo, no readable characters, wide establishing shot"
)

BG_JOBS = [
  {"file": "bg-m1.jpg", "seed": 8201, "w": 1280, "h": 720,
   "prompt": BG_STYLE + ", floating coastal island plains with grassy paths to a fishing village, waterfall off cliff edge, teal sea horizon, warm afternoon gold light, depth and vignette"},
  {"file": "bg-m2.jpg", "seed": 8202, "w": 1280, "h": 720,
   "prompt": BG_STYLE + ", misty mountain pass on floating highland cliffs, pine forest, stone bridge over abyss, dramatic fog shafts, teal-gold rim light"},
  {"file": "bg-m3.jpg", "seed": 8203, "w": 1280, "h": 720,
   "prompt": BG_STYLE + ", fantasy harbor vista golden hour, wooden docks and junk ships, teal water reflections, lantern glow, cliffside town behind"},
]


def fetch(prompt, w, h, seed):
    q = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width={w}&height={h}&nologo=true&enhance=true&seed={seed}&model=flux"
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-art/2.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        return r.read()


def save_tile(data, dest, size=128):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    # center-crop square then resize
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    im = im.crop((left, top, left + s, top + s))
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    # slight contrast for readability on phone
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = ImageEnhance.Color(im).enhance(1.1)
    im.save(dest, "PNG", optimize=True)
    print(f"  tile {dest.name} {im.size} {dest.stat().st_size}", flush=True)


def save_bg(data, dest, max_w=1100, quality=82):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im.thumbnail((max_w, max_w), Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.08)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    print(f"  bg {dest.name} {im.size} {dest.stat().st_size}", flush=True)


def try_fetch(prompt, w, h, seed, retries=2):
    last = None
    for i in range(retries + 1):
        try:
            return fetch(prompt, w, h, seed + i * 17)
        except Exception as e:
            last = e
            print(f"  retry {i}: {e}", flush=True)
            time.sleep(2 + i)
    raise last


def main():
    for i, job in enumerate(TILE_JOBS):
        print(f"TILE {job['file']}", flush=True)
        try:
            data = try_fetch(job["prompt"], 512, 512, job["seed"])
            (RAW / job["file"]).write_bytes(data)
            save_tile(data, TILES / job["file"], size=128)
        except Exception as e:
            print(f"FAIL tile {job['file']}: {e}", flush=True)
        time.sleep(0.8)

    for job in BG_JOBS:
        print(f"BG {job['file']}", flush=True)
        try:
            data = try_fetch(job["prompt"], job["w"], job["h"], job["seed"])
            (RAW / job["file"]).write_bytes(data)
            save_bg(data, OUT / job["file"])
        except Exception as e:
            print(f"FAIL bg {job['file']}: {e}", flush=True)
        time.sleep(0.8)
    print("DONE", flush=True)

if __name__ == "__main__":
    main()
