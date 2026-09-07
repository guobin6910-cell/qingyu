#!/usr/bin/env python3
"""v2: identity-locked chibi sprites + landscape boards. No Softstar keywords."""
import io, time, urllib.parse, urllib.request, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat
from rembg import remove

OUT = Path("/workspace/qingyu/src/assets/art")
RAW = Path("/tmp/qingyu_hex_art_v2")
RAW.mkdir(parents=True, exist_ok=True)

BOARD_STYLE = (
  "wide rectangular hand-painted fantasy battlefield landscape filling entire square frame, "
  "continuous oil painting of playable terrain, soft isometric bird-eye view about 45 degrees, "
  "lush Taiwan coastal island fantasy, NO map diagram, NO crosshairs, NO circular island emblem, "
  "NO UI, NO text, NO watermark, NO logo, NO characters, NO miniatures, NO grid, "
  "open grassy midfield suitable for placing game units, cinematic premium mobile RPG background art"
)

BOARDS = [
  ("board-m1.jpg", 45101,
   BOARD_STYLE + ", village outskirts meadow path dirt trail to fishing village thatched roofs forest clumps gentle hills distant teal sea horizon warm afternoon"),
  ("board-m2.jpg", 45102,
   BOARD_STYLE + ", mountain pass stone path between pine cliffs fog shafts rocky ridges highland plateau ruined wooden stall teal-gold rim light"),
  ("board-m3.jpg", 45103,
   BOARD_STYLE + ", harbor docks wooden piers teal water sandy shore warehouses junk ships lantern golden hour open dock plaza shoreline"),
]

# Avoid Softstar-homage keywords that pull wrong characters
SPRITE_BASE = (
  "cute chibi full body game character sprite, big head small body SD proportions, "
  "detailed painted anime armor, clean outlines soft shading, "
  "standing front three-quarter view feet visible, "
  "human only, human ears only, NO animal ears, NO cat ears, NO fox ears, NO horns, NO wings, NO tail, "
  "solid bright green chroma key background #00FF00, NO text NO watermark NO logo"
)

SPRITES = [
  ("sprite-lin.png", 46101, "young East Asian teenage BOY warrior, short black hair, brown eyes, male face, teal and gold armor with pauldrons, spear, heroic"),
  ("sprite-su.png", 46102, "young East Asian teenage GIRL healer, long straight black hair, gentle smile, teal robes gold trim, wooden staff, kind"),
  ("sprite-fang.png", 46103, "young East Asian teenage BOY archer, messy black hair, playful grin, orange scarf leather armor, longbow"),
  ("sprite-hai.png", 46104, "young East Asian teenage BOY scout, windblown black hair, quiet eyes, earth-tone cloak teal sash, short bow"),
  ("sprite-bandit.png", 46105, "East Asian adult MAN bandit, short rough black hair, patched dark armor, hand axe, angry scowl"),
  ("sprite-pirate.png", 46106, "East Asian adult MAN pirate, bandana, teal sash, cutlass, mean weathered face"),
  ("sprite-deserter.png", 46107, "East Asian adult MAN officer boss, scar on brow, tarnished gold teal heavy armor, cape, imposing"),
]

PORTRAIT_BASE = (
  "anime waist-up character portrait premium mobile RPG, soft cinematic light, detailed face costume, "
  "NO text NO watermark NO logo, Taiwan island fantasy"
)

PORTRAITS = [
  ("unit-lin.jpg", 47101, "young East Asian male warrior short black hair teal gold ornate armor serious"),
  ("unit-su.jpg", 47102, "young East Asian female healer long black hair teal gold robes gentle smile"),
  ("unit-fang.jpg", 47103, "young East Asian male archer messy hair orange scarf leather armor cheerful"),
  ("unit-hai.jpg", 47104, "young East Asian male scout windblown hair travel cloak quiet"),
  ("enemy-bandit.jpg", 47105, "East Asian male bandit rough armor axe menacing"),
  ("enemy-pirate.jpg", 47106, "East Asian male pirate bandana cutlass scowl"),
  ("enemy-deserter.jpg", 47107, "East Asian male deserter officer scarred tarnished gold teal armor"),
]


def fetch(prompt, w, h, seed):
    q = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width={w}&height={h}&nologo=true&enhance=false&seed={seed}&model=flux"
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-hex/2.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def try_fetch(prompt, w, h, seed, retries=3):
    last = None
    for i in range(retries):
        try:
            return fetch(prompt, w, h, seed + i * 97)
        except Exception as e:
            last = e
            print(f"  retry {i}: {e}", flush=True)
            time.sleep(2 + i * 2)
    raise last


def looks_like_landscape(im: Image.Image) -> bool:
    """Reject weird emblem/diagram boards: too much white rim / centered blob."""
    im = im.convert("RGB").resize((64, 64))
    px = list(im.getdata())
    # average edge vs center brightness
    edge = []
    center = []
    for y in range(64):
        for x in range(64):
            r, g, b = px[y * 64 + x]
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            if x < 4 or x > 59 or y < 4 or y > 59:
                edge.append(lum)
            if 24 <= x <= 40 and 24 <= y <= 40:
                center.append(lum)
    avg_edge = sum(edge) / len(edge)
    avg_center = sum(center) / len(center)
    # circular emblem often has very bright white outer ring
    if avg_edge > 200 and avg_center < 140:
        return False
    return True


def save_board(data, dest):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    if not looks_like_landscape(im):
        print(f"  REJECT board diagram-like {dest.name}", flush=True)
        return False
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    im = im.resize((1024, 1024), Image.Resampling.LANCZOS)
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im.save(dest, "JPEG", quality=86, optimize=True)
    print(f"  board OK {dest.name} {dest.stat().st_size}", flush=True)
    return True


def cutout_sprite(data, dest):
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    cut = remove(im)
    px = cut.load()
    w, h = cut.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if g > 135 and g > r + 28 and g > b + 28:
                px[x, y] = (r, g, b, 0)
    bbox = cut.getbbox()
    if not bbox:
        print(f"  EMPTY {dest.name}", flush=True)
        return False
    cut = cut.crop(bbox).filter(ImageFilter.SMOOTH)
    canvas_size = (280, 360)
    cut.thumbnail((canvas_size[0] - 8, canvas_size[1] - 4), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    ox = (canvas_size[0] - cut.width) // 2
    oy = canvas_size[1] - cut.height
    canvas.paste(cut, (ox, oy), cut)
    # reject if too little opaque content
    alpha = canvas.split()[-1]
    opaque = sum(1 for v in alpha.getdata() if v > 20)
    if opaque < 4000:
        print(f"  TOO_THIN {dest.name} opaque={opaque}", flush=True)
        return False
    canvas.save(dest, "PNG", optimize=True)
    print(f"  sprite OK {dest.name} opaque={opaque} {dest.stat().st_size}", flush=True)
    return True


def save_portrait(data, dest):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im = ImageOps.fit(im, (448, 560), Image.Resampling.LANCZOS, centering=(0.5, 0.32))
    im = ImageEnhance.Color(im).enhance(1.08)
    im.save(dest, "JPEG", quality=88, optimize=True)
    print(f"  portrait OK {dest.name} {dest.stat().st_size}", flush=True)
    return True


def main():
    ok = 0
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    for fname, seed, prompt in BOARDS:
        if only and "board" not in only and fname not in only:
            continue
        print("BOARD", fname, flush=True)
        for attempt in range(4):
            try:
                data = try_fetch(prompt, 1024, 1024, seed + attempt * 33)
                (RAW / f"{attempt}_{fname}").write_bytes(data)
                if save_board(data, OUT / fname):
                    ok += 1
                    break
            except Exception as e:
                print(f"  FAIL {e}", flush=True)
            time.sleep(1)

    for fname, seed, desc in SPRITES:
        if only and "sprite" not in only and fname not in only:
            continue
        print("SPRITE", fname, flush=True)
        prompt = SPRITE_BASE + ", " + desc
        for attempt in range(3):
            try:
                data = try_fetch(prompt, 512, 704, seed + attempt * 53)
                (RAW / f"{attempt}_{fname.replace('.png','.jpg')}").write_bytes(data)
                if cutout_sprite(data, OUT / fname):
                    ok += 1
                    break
            except Exception as e:
                print(f"  FAIL {e}", flush=True)
            time.sleep(1)

    for fname, seed, desc in PORTRAITS:
        if only and "portrait" not in only and fname not in only:
            continue
        print("PORTRAIT", fname, flush=True)
        prompt = PORTRAIT_BASE + ", " + desc
        try:
            data = try_fetch(prompt, 512, 640, seed)
            (RAW / fname).write_bytes(data)
            if save_portrait(data, OUT / fname):
                ok += 1
        except Exception as e:
            print(f"  FAIL {e}", flush=True)
        time.sleep(0.8)

    print(f"HEX_ART_V2_DONE ok={ok}", flush=True)


if __name__ == "__main__":
    main()
