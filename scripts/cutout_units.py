#!/usr/bin/env python3
import io, time, urllib.parse, urllib.request
from collections import deque
from pathlib import Path
from PIL import Image

OUT = Path("/workspace/qingyu/src/assets/art")
RAW = Path("/tmp/qingyu_art_raw")
STYLE = "painterly Taiwan-island fantasy wuxia SRPG character portrait, warm gold rim light, sea teal accents, soft brush strokes, no text, no watermark"

UNITS = [
  ("unit-lin.png", "lin2", "bust portrait young East Asian male warrior age 20, short black hair, teal cloak, gold-trim leather armor, determined expression, facing camera, upper body, solid flat light grey background"),
  ("unit-su.png", "su2", "bust portrait young East Asian female healer, long dark hair, teal robes with gold embroidery, gentle smile, facing camera, upper body, solid flat light grey background"),
  ("unit-fang.png", "fang2", "bust portrait cheerful East Asian male archer, short messy hair, orange scarf, leather armor, playful grin, facing camera, upper body, solid flat light grey background"),
  ("unit-hai.png", "hai2", "bust portrait quiet highland clan scout youth East Asian, wind-swept hair, travel cloak, reserved eyes, facing camera, upper body, solid flat light grey background"),
  ("enemy-bandit.png", "bandit2", "bust portrait highland clan bandit enemy, patched armor, rough menacing face, facing camera, upper body, solid flat light grey background"),
  ("enemy-pirate.png", "pirate2", "bust portrait coastal pirate raider enemy, teal sash, weathered face, facing camera, upper body, solid flat light grey background"),
  ("enemy-deserter.png", "deserter2", "bust portrait imperial deserter officer boss, tarnished gold-teal armor, scarred face, facing camera, upper body, solid flat light grey background"),
]

def fetch(prompt, dest, seed):
    q = urllib.parse.quote(STYLE + ", " + prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width=512&height=640&nologo=true&enhance=true&seed={seed}"
    print("GET", dest.name, flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-art/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dest.write_bytes(r.read())
    print("  bytes", dest.stat().st_size, flush=True)

def flood_cutout(src, dst, tol=38):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    # sample corners
    corners = [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,0),(0,h//2),(w-1,h//2)]
    refs = [px[x,y][:3] for x,y in corners]
    def near(c, refs=refs):
        r,g,b = c[:3]
        for rr,gg,bb in refs:
            if abs(r-rr)+abs(g-gg)+abs(b-bb) <= tol*3:
                return True
        return False
    visited = [[False]*w for _ in range(h)]
    q = deque()
    for x,y in corners:
        q.append((x,y)); visited[y][x]=True
    while q:
        x,y = q.popleft()
        r,g,b,a = px[x,y]
        if near((r,g,b)):
            px[x,y] = (r,g,b,0)
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if 0<=nx<w and 0<=ny<h and not visited[ny][nx]:
                    visited[ny][nx]=True
                    q.append((nx,ny))
        else:
            # edge feather
            px[x,y] = (r,g,b, min(a, 180))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((360, 420), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (360, 420), (0,0,0,0))
    ox = (360-im.width)//2
    oy = max(0, 420-im.height)
    canvas.paste(im, (ox, oy), im)
    canvas.save(dst, optimize=True)
    # also make circular token
    tok = Image.new("RGBA", (128,128), (0,0,0,0))
    face = canvas.copy()
    face.thumbnail((120,120), Image.Resampling.LANCZOS)
    mask = Image.new("L", (128,128), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((4,4,124,124), fill=255)
    cx = (128-face.width)//2
    cy = (128-face.height)//2
    tmp = Image.new("RGBA", (128,128), (0,0,0,0))
    tmp.paste(face, (cx,cy), face)
    tok = Image.new("RGBA", (128,128), (0,0,0,0))
    tok.paste(tmp, (0,0), mask)
    tpath = dst.with_name(dst.stem.replace("unit-","token-").replace("enemy-","token-") + ".png")
    # keep naming: token-lin.png etc
    name = dst.name.replace("unit-","token-").replace("enemy-","token-")
    tok.save(dst.parent / name, optimize=True)
    print("  cut", dst.name, canvas.size, "token", name, flush=True)

def main():
    for i,(fname, rawname, prompt) in enumerate(UNITS):
        raw = RAW / f"{rawname}.jpg"
        try:
            fetch(prompt, raw, 8100+i)
        except Exception as e:
            print("FAIL", e, flush=True)
            time.sleep(2)
            fetch(prompt, raw, 9100+i)
        flood_cutout(raw, OUT / fname)
        time.sleep(1)
    print("DONE", sorted(p.name for p in OUT.iterdir()))

if __name__ == "__main__":
    main()
