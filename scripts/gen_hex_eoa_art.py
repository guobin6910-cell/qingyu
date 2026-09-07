#!/usr/bin/env python3
"""Premium continuous boards + high-detail chibi sprites for 青嶼戰記 hex remake.
Homage only — original IP, zero Softstar names/logos/characters/assets."""
import io, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import remove

OUT = Path("/workspace/qingyu/src/assets/art")
RAW = Path("/tmp/qingyu_hex_art")
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

BOARD_STYLE = (
  "single continuous hand-painted fantasy SRPG battlefield painting filling entire square canvas edge to edge, "
  "gorgeous oil-paint brushwork, premium mobile RPG quality, "
  "NO tile seams, NO floating blocks, NO grid lines, NO UI, NO text, NO watermark, NO logo, NO characters, NO miniatures, "
  "Taiwan coastal floating-island fantasy vibe, lush greens, teal sea, soft golden afternoon light, "
  "open playable midfield with gentle terrain variation for hex overlay, cinematic depth"
)

BOARDS = [
  {
    "file": "board-m1.jpg",
    "seed": 34011,
    "prompt": BOARD_STYLE + ", coastal village plains grassy path to fishing hamlet with thatched roofs, dirt trail meadow, forest clumps, gentle hills, distant teal bay horizon, warm pastoral Taiwan island",
  },
  {
    "file": "board-m2.jpg",
    "seed": 34022,
    "prompt": BOARD_STYLE + ", misty mountain pass continuous highland cliffs pine forest stone path between peaks rocky ridges fog shafts teal-gold rim light plateau with ruined market stall, dramatic elevation",
  },
  {
    "file": "board-m3.jpg",
    "seed": 34033,
    "prompt": BOARD_STYLE + ", fantasy harbor docks continuous wooden piers teal water sandy shore warehouse roofs junk ships golden hour lantern glow continuous shoreline battlefield, open dock plaza",
  },
]

SPRITE_STYLE = (
  "premium mobile SRPG chibi SD full-body character sprite, Empire-of-Angels quality homage style, "
  "super deformed cute proportions big head detailed small body, highly detailed ornate armor weapons accessories, "
  "painterly anime shading soft rim light crisp outlines, standing on transparent ground facing camera three-quarter, "
  "feet clearly visible at bottom, NO animal ears, NO cat ears, NO fox ears, NO wings unless specified, "
  "NO text, NO watermark, NO logo, NO UI, solid pure chroma key green background #00FF00"
)

SPRITES = [
  ("sprite-lin.png", 34101,
   "YOUNG EAST ASIAN MALE island guardian warrior, short tousled black hair teal highlights, determined cute eyes, "
   "ornate deep teal and polished gold armor with carved pauldrons high collar cloak, spear, heroic chibi stance"),
  ("sprite-su.png", 34102,
   "YOUNG EAST ASIAN FEMALE tide healer priestess, long straight black hair, gentle smile blush, "
   "layered teal robes gold embroidery ornate shoulder plates wooden staff with tide charm, soft kind chibi pose"),
  ("sprite-fang.png", 34103,
   "YOUNG EAST ASIAN MALE cheerful archer, short messy hair, playful grin, "
   "orange scarf brown leather gold-trim armor longbow quiver, energetic chibi stance"),
  ("sprite-hai.png", 34104,
   "YOUNG EAST ASIAN MALE quiet highland scout, wind-swept dark hair reserved eyes, "
   "travel cloak earth tones teal sash short bow, humble detailed chibi"),
  ("sprite-bandit.png", 34105,
   "EAST ASIAN MALE highland bandit enemy, rough hair patched dark iron armor hand axe, menacing cute chibi scowl"),
  ("sprite-pirate.png", 34106,
   "EAST ASIAN MALE coastal pirate raider enemy, bandana teal sash cutlass, weathered mean detailed chibi"),
  ("sprite-deserter.png", 34107,
   "EAST ASIAN MALE imperial deserter officer boss, scarred brow tarnished gold teal heavy armor cape, imposing detailed chibi"),
]

PORTRAIT_STYLE = (
  "high quality anime waist-up portrait for premium mobile RPG character panel, "
  "detailed face ornate costume soft cinematic lighting shallow depth of field, "
  "NO text NO watermark NO logo, Taiwan island fantasy wuxia aesthetic"
)

PORTRAITS = [
  ("unit-lin.jpg", 34201, "young East Asian male warrior Lin, short black hair teal-gold ornate armor pauldrons, serious determined expression"),
  ("unit-su.jpg", 34202, "young East Asian female healer Su, long black hair teal gold robes, gentle warm smile"),
  ("unit-fang.jpg", 34203, "young East Asian male archer Fang, messy hair orange scarf leather armor, cheerful grin"),
  ("unit-hai.jpg", 34204, "young East Asian male scout Hai, wind-swept hair travel cloak, quiet reserved look"),
  ("enemy-bandit.jpg", 34205, "East Asian male bandit, rough armor axe, menacing glare"),
  ("enemy-pirate.jpg", 34206, "East Asian male pirate, bandana cutlass, weathered scowl"),
  ("enemy-deserter.jpg", 34207, "East Asian male deserter officer, scarred, tarnished gold teal armor, intimidating"),
]


def fetch(prompt, w, h, seed):
    q = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width={w}&height={h}&nologo=true&enhance=true&seed={seed}&model=flux"
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-hex/1.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        return r.read()


def try_fetch(prompt, w, h, seed, retries=4):
    last = None
    for i in range(retries):
        try:
            return fetch(prompt, w, h, seed + i * 41)
        except Exception as e:
            last = e
            print(f"  retry {i}: {e}", flush=True)
            time.sleep(2.5 + i)
    raise last


def save_board(data, dest, size=(1024, 1024), quality=86):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    im = im.crop((left, top, left + s, top + s)).resize(size, Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.1)
    im = ImageEnhance.Color(im).enhance(1.15)
    im = ImageEnhance.Sharpness(im).enhance(1.08)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    print(f"  board {dest.name} {im.size} {dest.stat().st_size}", flush=True)


def cutout_sprite(data, dest, canvas_size=(280, 360)):
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    # rembg first
    cut = remove(im)
    # also punch remaining near-green
    px = cut.load()
    w, h = cut.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if g > 140 and g > r + 30 and g > b + 30:
                px[x, y] = (r, g, b, 0)
            elif g > max(r, b) + 20 and g > 100 and a < 220:
                px[x, y] = (r, g, b, max(0, a - 80))
    bbox = cut.getbbox()
    if not bbox:
        print(f"  EMPTY cutout for {dest.name}", flush=True)
        return False
    cut = cut.crop(bbox)
    # trim tiny fringe
    cut = cut.filter(ImageFilter.SMOOTH)
    # fit into canvas feet-bottom
    cut.thumbnail((canvas_size[0] - 8, canvas_size[1] - 4), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    ox = (canvas_size[0] - cut.width) // 2
    oy = canvas_size[1] - cut.height
    canvas.paste(cut, (ox, oy), cut)
    canvas.save(dest, "PNG", optimize=True)
    print(f"  sprite {dest.name} {canvas.size} bbox={bbox} bytes={dest.stat().st_size}", flush=True)
    return True


def save_portrait(data, dest, size=(448, 560), quality=88):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im = ImageOps.fit(im, size, Image.Resampling.LANCZOS, centering=(0.5, 0.35))
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.1)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    print(f"  portrait {dest.name} {im.size} {dest.stat().st_size}", flush=True)


def main():
    ok = 0
    for job in BOARDS:
        print("BOARD", job["file"], flush=True)
        try:
            data = try_fetch(job["prompt"], 1024, 1024, job["seed"])
            (RAW / job["file"]).write_bytes(data)
            save_board(data, OUT / job["file"])
            ok += 1
        except Exception as e:
            print(f"FAIL board {job['file']}: {e}", flush=True)
        time.sleep(0.8)

    for fname, seed, desc in SPRITES:
        print("SPRITE", fname, flush=True)
        prompt = SPRITE_STYLE + ", " + desc
        try:
            data = try_fetch(prompt, 576, 768, seed)
            (RAW / fname.replace(".png", ".jpg")).write_bytes(data)
            if cutout_sprite(data, OUT / fname):
                ok += 1
        except Exception as e:
            print(f"FAIL sprite {fname}: {e}", flush=True)
        time.sleep(0.8)

    for fname, seed, desc in PORTRAITS:
        print("PORTRAIT", fname, flush=True)
        prompt = PORTRAIT_STYLE + ", " + desc
        try:
            data = try_fetch(prompt, 512, 640, seed)
            (RAW / fname).write_bytes(data)
            save_portrait(data, OUT / fname)
            ok += 1
        except Exception as e:
            print(f"FAIL portrait {fname}: {e}", flush=True)
        time.sleep(0.8)

    print(f"HEX_ART_DONE ok={ok}", flush=True)


if __name__ == "__main__":
    main()
