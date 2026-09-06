#!/usr/bin/env python3
"""Generate continuous stage boards + Q-version (chibi) full-body sprites for 青嶼戰記.
Homage to classic Taiwan SRPG presentation; original art only — no Softstar IP."""
import io, time, urllib.parse, urllib.request
from collections import deque
from pathlib import Path
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter

OUT = Path("/workspace/qingyu/src/assets/art")
RAW = Path("/tmp/qingyu_eoa_art")
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

BOARD_STYLE = (
  "single continuous hand-painted fantasy SRPG battlefield map, "
  "top-down isometric continuous terrain filling the entire frame edge to edge, "
  "NO floating tiles, NO separated blocks, NO grid lines, NO UI, NO text, NO watermark, NO logo, NO characters, "
  "Taiwan coastal island wuxia aesthetic, lush painted grass paths, soft golden afternoon light, teal sea accents, "
  "gorgeous oil-paint brush strokes, soft clouds, playable open field in center"
)

BOARDS = [
  {
    "file": "board-m1.jpg",
    "seed": 12011,
    "prompt": BOARD_STYLE + ", village plains grassy path leading to a coastal fishing village with thatched roofs, gentle hills, forest clumps, dirt trail, warm meadow, teal sea on distant horizon",
  },
  {
    "file": "board-m2.jpg",
    "seed": 12022,
    "prompt": BOARD_STYLE + ", misty mountain pass continuous highland cliffs and pine forest, stone path winding between peaks, rocky ridges, fog shafts, teal-gold rim light, shop ruin hint on plateau",
  },
  {
    "file": "board-m3.jpg",
    "seed": 12033,
    "prompt": BOARD_STYLE + ", fantasy harbor docks continuous wooden piers and teal water, sandy shore, warehouse roofs, junk ships at edge, golden hour lantern glow, continuous shoreline battlefield",
  },
]

SPRITE_STYLE = (
  "cute Q-version chibi SD full-body character sprite for mobile SRPG, "
  "big head small body 1:2 head-to-body ratio, adorable anime proportions, "
  "clean bold outlines, painterly Taiwan island fantasy wuxia costume, "
  "standing facing slightly toward camera, feet visible at bottom, "
  "solid pure chroma green screen background #00FF00 only, no props on ground, "
  "no text, no watermark, no UI, no shadow blob, high clarity"
)

SPRITES = [
  ("sprite-lin.png", 13001, "young East Asian male warrior Lin, short black hair, teal cloak, gold-trim leather armor, spear on back, determined cute face"),
  ("sprite-su.png", 13002, "young East Asian female healer Su, long dark hair, teal robes with gold embroidery, wooden staff, gentle smile"),
  ("sprite-fang.png", 13003, "cheerful East Asian male archer Fang, short messy hair, orange scarf, leather armor, longbow, playful grin"),
  ("sprite-hai.png", 13004, "quiet highland clan scout Hai, wind-swept dark hair, travel cloak, short bow, reserved cute eyes"),
  ("sprite-bandit.png", 13005, "highland clan bandit enemy, patched dark armor, axe, rough cute menacing face"),
  ("sprite-pirate.png", 13006, "coastal pirate raider enemy, teal sash, cutlass, weathered cute scowl"),
  ("sprite-deserter.png", 13007, "imperial deserter officer boss, tarnished gold-teal armor, scarred brow, imposing cute chibi"),
]


def fetch(prompt, w, h, seed):
    q = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width={w}&height={h}&nologo=true&enhance=true&seed={seed}&model=flux"
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-eoa/1.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        return r.read()


def try_fetch(prompt, w, h, seed, retries=3):
    last = None
    for i in range(retries):
        try:
            return fetch(prompt, w, h, seed + i * 19)
        except Exception as e:
            last = e
            print(f"  retry {i}: {e}", flush=True)
            time.sleep(2 + i)
    raise last


def save_board(data, dest, size=(960, 960), quality=84):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    # center crop to square then resize
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    im = im.crop((left, top, left + s, top + s))
    im = im.resize(size, Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Sharpness(im).enhance(1.05)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    print(f"  board {dest.name} {im.size} {dest.stat().st_size}", flush=True)


def chromakey_cutout(data, dest, canvas_size=(256, 320)):
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    px = im.load()
    w, h = im.size
    # detect green via green dominance
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            green_dom = g - max(r, b)
            # also catch near-pure green
            if (green_dom > 35 and g > 85) or (g > 150 and r < 120 and b < 120):
                alpha = 0 if green_dom > 55 or g > 180 else max(0, min(255, int(255 - (green_dom - 20) * 5)))
                # decontaminate green fringe
                if alpha > 0:
                    nr = min(255, r + 10)
                    nb = min(255, b + 10)
                    ng = min(g, max(nr, nb) + 15)
                    px[x, y] = (nr, ng, nb, alpha)
                else:
                    px[x, y] = (r, g, b, 0)
    # flood from corners for remaining bg
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2)]
    refs = []
    for cx, cy in corners:
        c = px[cx, cy]
        if c[3] < 20 or (c[1] > c[0] + 20 and c[1] > c[2] + 20):
            refs.append(c[:3])
    if refs:
        visited = [[False] * w for _ in range(h)]
        q = deque()
        for cx, cy in corners:
            q.append((cx, cy))
            visited[cy][cx] = True
        def near(c):
            r, g, b = c[:3]
            for rr, gg, bb in refs:
                if abs(r - rr) + abs(g - gg) + abs(b - bb) <= 90:
                    return True
            return g > r + 25 and g > b + 25 and g > 80
        while q:
            x, y = q.popleft()
            r, g, b, a = px[x, y]
            if near((r, g, b)) or a < 30:
                px[x, y] = (r, g, b, 0)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                        visited[ny][nx] = True
                        q.append((nx, ny))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # slight edge soften
    im = im.filter(ImageFilter.SMOOTH)
    im.thumbnail(canvas_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    ox = (canvas_size[0] - im.width) // 2
    oy = canvas_size[1] - im.height  # feet at bottom
    canvas.paste(im, (ox, oy), im)
    canvas.save(dest, "PNG", optimize=True)
    print(f"  sprite {dest.name} {canvas.size} {dest.stat().st_size}", flush=True)


def main():
    for job in BOARDS:
        print("BOARD", job["file"], flush=True)
        try:
            data = try_fetch(job["prompt"], 1024, 1024, job["seed"])
            (RAW / job["file"]).write_bytes(data)
            save_board(data, OUT / job["file"])
        except Exception as e:
            print(f"FAIL board {job['file']}: {e}", flush=True)
        time.sleep(0.7)

    for fname, seed, desc in SPRITES:
        print("SPRITE", fname, flush=True)
        prompt = SPRITE_STYLE + ", " + desc
        try:
            data = try_fetch(prompt, 512, 640, seed)
            (RAW / fname.replace(".png", ".jpg")).write_bytes(data)
            chromakey_cutout(data, OUT / fname)
        except Exception as e:
            print(f"FAIL sprite {fname}: {e}", flush=True)
        time.sleep(0.7)
    print("EOA_ART_DONE", flush=True)


if __name__ == "__main__":
    main()
