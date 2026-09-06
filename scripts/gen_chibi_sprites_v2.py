#!/usr/bin/env python3
"""Q-version full-body sprites with rembg cutout — identity-matched to 青嶼戰記 cast."""
import io, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageFilter
from rembg import remove

OUT = Path("/workspace/qingyu/src/assets/art")
RAW = Path("/tmp/qingyu_chibi_v2")
RAW.mkdir(parents=True, exist_ok=True)

BASE = (
  "cute chibi super-deformed SD full body game sprite, big head small body, "
  "2.5 heads tall, clean anime game art, Taiwan island fantasy wuxia, "
  "standing front three-quarter view, feet planted at bottom of frame, "
  "NO animal ears, NO cat ears, NO fox ears, NO horns, NO wings, "
  "NO text, NO watermark, NO logo, NO UI, plain solid light grey studio background"
)

JOBS = [
  ("sprite-lin.png", 22101,
   "YOUNG EAST ASIAN MALE warrior hero, short tousled black hair, determined eyes, "
   "deep teal high-collar cloak with gold trim, bronze scale armor chest, spear held upright, heroic stance"),
  ("sprite-su.png", 22102,
   "YOUNG EAST ASIAN FEMALE healer, long straight black hair middle part, gentle smile, "
   "teal layered robes with ornate gold shoulder plates, wooden staff, soft kind pose"),
  ("sprite-fang.png", 22103,
   "YOUNG EAST ASIAN MALE archer, short messy brown-black hair, playful grin, "
   "orange scarf, brown leather armor, longbow, cheerful energetic pose"),
  ("sprite-hai.png", 22104,
   "YOUNG EAST ASIAN MALE scout youth, wind-swept dark hair, reserved quiet eyes, "
   "travel cloak earth tones with teal sash, short bow, humble stance"),
  ("sprite-bandit.png", 22105,
   "EAST ASIAN MALE bandit enemy, rough short hair, patched dark armor, hand axe, menacing scowl"),
  ("sprite-pirate.png", 22106,
   "EAST ASIAN MALE pirate raider enemy, bandana, teal sash, cutlass, weathered mean face"),
  ("sprite-deserter.png", 22107,
   "EAST ASIAN MALE imperial deserter officer boss, scarred brow, tarnished gold and teal armor, imposing chibi stance"),
]


def fetch(prompt, w, h, seed):
    q = urllib.parse.quote(BASE + ", " + prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width={w}&height={h}&nologo=true&enhance=true&seed={seed}&model=flux"
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-chibi/2.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        return r.read()


def try_fetch(prompt, seed, retries=3):
    last = None
    for i in range(retries):
        try:
            return fetch(prompt, 512, 640, seed + i * 37)
        except Exception as e:
            last = e
            print(f"  retry {i}: {e}", flush=True)
            time.sleep(2 + i)
    raise last


def process(data, dest, canvas=(240, 300)):
    cut = remove(data)
    im = Image.open(io.BytesIO(cut)).convert("RGBA")
    # trim
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # light edge cleanup: drop near-transparent fringe noise
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40:
                px[x, y] = (r, g, b, 0)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail(canvas, Image.Resampling.LANCZOS)
    canvas_im = Image.new("RGBA", canvas, (0, 0, 0, 0))
    ox = (canvas[0] - im.width) // 2
    oy = canvas[1] - im.height
    canvas_im.paste(im, (ox, max(0, oy)), im)
    canvas_im.save(dest, "PNG", optimize=True)
    opaque = sum(1 for p in canvas_im.getdata() if p[3] > 128)
    pct = 100 * opaque / (canvas[0] * canvas[1])
    print(f"  OK {dest.name} opaque={pct:.1f}% size={dest.stat().st_size}", flush=True)
    return pct


def main():
    for fname, seed, desc in JOBS:
        print("GEN", fname, flush=True)
        ok = False
        for attempt in range(3):
            try:
                data = try_fetch(desc, seed + attempt * 111)
                (RAW / fname.replace(".png", f"_{attempt}.jpg")).write_bytes(data)
                print(f"  fetched {len(data)} bytes attempt {attempt}", flush=True)
                pct = process(data, OUT / fname)
                if pct > 8 and pct < 70:  # not empty, not full-bg
                    ok = True
                    break
                print(f"  opaque {pct:.1f}% suspect, retry", flush=True)
            except Exception as e:
                print(f"  FAIL attempt {attempt}: {e}", flush=True)
                time.sleep(2)
        if not ok:
            print(f"  WARN kept last for {fname}", flush=True)
        time.sleep(0.8)
    print("CHIBI_V2_DONE", flush=True)


if __name__ == "__main__":
    main()
