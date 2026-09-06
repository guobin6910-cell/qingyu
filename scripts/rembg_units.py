#!/usr/bin/env python3
import io, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image
from rembg import remove

OUT = Path("/workspace/qingyu/src/assets/art")
RAW = Path("/tmp/qingyu_art_raw")
STYLE = "painterly Taiwan-island fantasy wuxia SRPG character portrait, warm gold rim light, sea teal accents, soft brush strokes, no text, no watermark"

UNITS = [
  ("unit-lin.png", "lin2", "bust portrait young East Asian male warrior age 20, short black hair, teal cloak, gold-trim leather armor, determined expression, facing camera, upper body, plain soft grey studio backdrop"),
  ("unit-su.png", "su2", "bust portrait young East Asian female healer, long dark hair, teal robes with gold embroidery, gentle smile, facing camera, upper body, plain soft grey studio backdrop"),
  ("unit-fang.png", "fang2", "bust portrait cheerful East Asian male archer, short messy hair, orange scarf, leather armor, playful grin, facing camera, upper body, plain soft grey studio backdrop"),
  ("unit-hai.png", "hai2", "bust portrait quiet highland clan scout youth East Asian, wind-swept hair, travel cloak, reserved eyes, facing camera, upper body, plain soft grey studio backdrop"),
  ("enemy-bandit.png", "bandit2", "bust portrait highland clan bandit enemy, patched armor, rough menacing face, facing camera, upper body, plain soft grey studio backdrop"),
  ("enemy-pirate.png", "pirate2", "bust portrait coastal pirate raider enemy, teal sash, weathered face, facing camera, upper body, plain soft grey studio backdrop"),
  ("enemy-deserter.png", "deserter2", "bust portrait imperial deserter officer boss, tarnished gold-teal armor, scarred face, facing camera, upper body, plain soft grey studio backdrop"),
]

def fetch(prompt, dest, seed):
    q = urllib.parse.quote(STYLE + ", " + prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width=640&height=768&nologo=true&enhance=true&seed={seed}"
    print("GET", dest.name, flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-art/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dest.write_bytes(r.read())
    print("  bytes", dest.stat().st_size, flush=True)

def cutout(src, dst):
    out = remove(src.read_bytes())
    im = Image.open(io.BytesIO(out)).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((360, 420), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (360, 420), (0, 0, 0, 0))
    ox = (360 - im.width) // 2
    oy = max(0, 420 - im.height)
    canvas.paste(im, (ox, oy), im)
    canvas.save(dst, optimize=True)
    print("  rembg", dst.name, canvas.size, dst.stat().st_size, flush=True)

def main():
    for i, (fname, rawname, prompt) in enumerate(UNITS):
        raw = RAW / f"{rawname}.jpg"
        try:
            fetch(prompt, raw, 6100 + i)
        except Exception as e:
            print("FAIL", fname, e, flush=True)
            time.sleep(2)
            fetch(prompt, raw, 7100 + i)
        cutout(raw, OUT / fname)
        time.sleep(1)
    print("DONE")

if __name__ == "__main__":
    main()
