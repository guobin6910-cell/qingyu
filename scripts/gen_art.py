#!/usr/bin/env python3
import time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image

OUT = Path("/workspace/qingyu/src/assets/art")
OUT.mkdir(parents=True, exist_ok=True)
RAW = Path("/tmp/qingyu_art_raw")
RAW.mkdir(parents=True, exist_ok=True)
STYLE = "painterly Taiwan-island fantasy wuxia SRPG illustration, warm gold sunlight, sea teal water, mountain mist, soft brush strokes, rich color, no text, no watermark, no logo, high detail"



JOBS = [
  {"name":"cover","file":"cover.jpg","w":768,"h":1280,"prompt": STYLE + ", vertical mobile game title splash, young East Asian island warrior in teal-and-gold armor overlooking misty coastal mountains and glowing harbor at dusk, epic atmosphere"},
  {"name":"hub","file":"hub.jpg","w":768,"h":1024,"prompt": STYLE + ", highland clan pavilion overlooking emerald sea, wooden map table, lantern light, soft mist, cozy SRPG hub"},
  {"name":"bg_m1","file":"bg-m1.jpg","w":960,"h":720,"prompt": STYLE + ", coastal village plains tutorial battlefield, grassy path to fishing village, gentle hills, teal sea horizon, warm afternoon"},
  {"name":"bg_m2","file":"bg-m2.jpg","w":960,"h":720,"prompt": STYLE + ", narrow misty mountain pass battlefield, steep cliffs, pine forest, stone path, highland fog, teal and gold light"},
  {"name":"bg_m3","file":"bg-m3.jpg","w":960,"h":720,"prompt": STYLE + ", fantasy harbor docks battlefield at golden hour, wooden piers, sailing junks, teal water, warm lanterns"},
  {"name":"lin","file":"unit-lin.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body young male fantasy warrior, short black hair, teal cloak, gold trim armor, spear, solid pure green screen #00FF00 background, clean silhouette"},
  {"name":"su","file":"unit-su.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body young female island healer, teal robes gold embroidery, wooden staff, long dark hair, solid pure green screen #00FF00 background, clean silhouette"},
  {"name":"fang","file":"unit-fang.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body cheerful male harbor archer, orange scarf, leather armor, longbow, solid pure green screen #00FF00 background, clean silhouette"},
  {"name":"hai","file":"unit-hai.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body highland clan scout youth, travel cloak, short bow, reserved look, solid pure green screen #00FF00 background, clean silhouette"},
  {"name":"enemy_bandit","file":"enemy-bandit.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body highland clan bandit patched armor axe, menacing, solid pure green screen #00FF00 background, clean silhouette"},
  {"name":"enemy_pirate","file":"enemy-pirate.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body coastal pirate raider cutlass teal sash, solid pure green screen #00FF00 background, clean silhouette"},
  {"name":"enemy_deserter","file":"enemy-deserter.png","w":512,"h":640,"chroma":True,"prompt": STYLE + ", full-body imperial deserter officer tarnished gold-teal armor, scarred boss, solid pure green screen #00FF00 background, clean silhouette"},
]


def fetch(prompt, w, h, dest, seed=None):
    q = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{q}?width={w}&height={h}&nologo=true&enhance=true"
    if seed is not None:
        url += f"&seed={seed}"
    print("GET", dest.name, flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "qingyu-art/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    dest.write_bytes(data)
    print("  wrote", dest, len(data), flush=True)

def chromakey(src, dst, soft=48):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    samples = [px[2, 2], px[w-3, 2], px[2, h-3], px[w-3, h-3]]
    def is_greenish(c):
        r,g,b,a=c
        return g>r+30 and g>b+30 and g>100
    greens=[c for c in samples if is_greenish(c)]
    ref = (0,255,0) if not greens else tuple(sum(c[i] for c in greens)//len(greens) for i in range(3))
    for y in range(h):
        for x in range(w):
            r,g,b,a = px[x,y]
            dr,dg,db = r-ref[0], g-ref[1], b-ref[2]
            green_dom = g - max(r,b)
            dist = (dr*dr + dg*dg + db*db) ** 0.5
            if green_dom > 40 and g > 90:
                alpha = 0 if green_dom > 70 else max(0, min(255, int(255 - (green_dom-20)*4)))
                px[x,y] = (r, min(g, r+20), b, alpha)
            elif dist < soft:
                px[x,y] = (r,g,b, int(255 * dist / soft))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((384,480), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (384,480), (0,0,0,0))
    ox = (384-im.width)//2
    oy = max(0, 480-im.height)
    canvas.paste(im, (ox, oy), im)
    canvas.save(dst, optimize=True)
    print("  chromakey", dst.name, canvas.size, dst.stat().st_size)

def shrink_jpg(src, dst, max_side=960, quality=78):
    im = Image.open(src).convert("RGB")
    im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    im.save(dst, "JPEG", quality=quality, optimize=True)
    print("  jpg", dst.name, im.size, dst.stat().st_size)

def main():
    for i, job in enumerate(JOBS):
        raw = RAW / f"{job['name']}.jpg"
        try:
            fetch(job["prompt"], job["w"], job["h"], raw, seed=4200+i)
        except Exception as e:
            print("FAIL", job["name"], e, flush=True)
            time.sleep(2)
            try:
                fetch(job["prompt"], job["w"], job["h"], raw, seed=5200+i)
            except Exception as e2:
                print("FAIL2", job["name"], e2, flush=True)
                continue
        out = OUT / job["file"]
        if job.get("chroma"):
            chromakey(raw, out)
        else:
            shrink_jpg(raw, out, max_side=max(job["w"], job["h"]), quality=80)
        time.sleep(1.0)
    print("DONE", sorted(p.name for p in OUT.iterdir()))

if __name__ == "__main__":
    main()
