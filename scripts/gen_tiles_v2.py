#!/usr/bin/env python3
"""Seamless top-down terrain textures (not diorama scenes)."""
import time, urllib.parse, urllib.request, io
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

OUT = Path("/workspace/qingyu/src/assets/art/tiles")
RAW = Path("/tmp/qingyu_tiles_v2")
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

BASE = (
  "seamless square tile texture ONLY, orthographic top-down close-up of ground surface, "
  "hand-painted fantasy SRPG, rich brush detail, NO border, NO frame, NO UI, NO text, "
  "NO watermark, NO logo, NO characters, NO miniature diorama, NO floating island, "
  "fill entire image edge to edge, tileable texture"
)

JOBS = [
  ("plain.png", 9101, "lush hand-painted emerald grass with soft dirt flecks and tiny wildflowers"),
  ("forest.png", 9102, "dense mossy forest floor with pine needles, roots, dappled shadow greens"),
  ("hill.png", 9103, "rocky highland dirt and short grass with scattered stones, warm gray-green"),
  ("wall.png", 9104, "top-down ancient mossy stone pavement blocks, carved masonry, lichen"),
  ("ford.png", 9105, "shallow teal water with ripples and wet stones, river ford surface"),
  ("village.png", 9106, "warm cobblestone village plaza with soft dirt joints"),
  ("shop.png", 9107, "wooden market floor planks with crate shadows and teal cloth scraps"),
  ("secret.png", 9108, "grass with glowing cyan rune stones circle, soft mystical light"),
  ("harbor.png", 9109, "wet wooden pier planks top-down with rope and teal water gaps"),
]

def fetch(prompt, seed):
    q = urllib.parse.quote(BASE + ", " + prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width=512&height=512&nologo=true&enhance=true&seed={seed}&model=flux"
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-tiles/2.0"})
    with urllib.request.urlopen(req, timeout=200) as r:
        return r.read()

def process(data, dest, size=112):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    # crop inward 8% to remove accidental borders/frames
    m = int(min(w, h) * 0.08)
    im = im.crop((m, m, w - m, h - m))
    s = min(im.size)
    left = (im.size[0] - s) // 2
    top = (im.size[1] - s) // 2
    im = im.crop((left, top, left + s, top + s))
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.12)
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Sharpness(im).enhance(1.15)
    # light edge darken for sculpted cell look
    overlay = Image.new("RGB", im.size, (0, 0, 0))
    mask = Image.new("L", im.size, 0)
    # soft vignette via radial
    import math
    px = mask.load()
    cx, cy = size / 2, size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot((x - cx) / cx, (y - cy) / cy)
            v = max(0, min(255, int((d - 0.55) * 90)))
            px[x, y] = v
    im = Image.composite(ImageEnhance.Brightness(im).enhance(0.82), im, mask)
    im.save(dest, "PNG", optimize=True)
    print(f"OK {dest.name} {dest.stat().st_size}", flush=True)

def main():
    for name, seed, prompt in JOBS:
        print("GEN", name, flush=True)
        for attempt in range(3):
            try:
                data = fetch(prompt, seed + attempt * 31)
                (RAW / name).write_bytes(data)
                process(data, OUT / name)
                break
            except Exception as e:
                print(" fail", attempt, e, flush=True)
                time.sleep(2)
        time.sleep(0.6)
    print("TILES_V2_DONE", flush=True)

if __name__ == "__main__":
    main()
