#!/usr/bin/env python3
"""Makes the light theme's pictures: the ones drawn for a black background, recolored into assets/light, and
Core/LightAssets.js, the list Theme.asset() looks them up in.

    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/repo" -w /repo qt-dial-bookworm \\
        python3 qt/tools/theme/bake_light_assets.py

Run it again after changing one of those pictures or a light color of Theme.qml: the colors are read from
there. Baked instead of tinted while drawing because the machine's GPU has no fill rate to spare for an
effect over every icon and animation (docs/qt-migration/CONVENTIONS.md). Needs Pillow (in the image).
"""
import json
import re
import shutil
from pathlib import Path

from PIL import Image

DIAL = Path(__file__).resolve().parents[2] / "qml" / "Dial"
ASSETS = DIAL / "assets"
OUT = ASSETS / "light"
THEME = (DIAL / "Core" / "Theme.qml").read_text()
GREEN = (0x7B, 0xEE, 0xBF)
BLUE = (0x08, 0x66, 0xFF)


def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexa(c):
    return "#%02X%02X%02X" % tuple(c)


def token(name):
    m = re.search(r'property color %s: light \? "(#[0-9A-Fa-f]{6})"' % name, THEME)
    if not m:
        raise SystemExit(f"Theme.qml has no light color named {name}")
    return rgb(m.group(1))


def mix(a, b, k):
    return tuple(round(x + (y - x) * k) for x, y in zip(a, b))


PAPER, INK = token("background"), token("text")
# what a color on black becomes on paper
COLORS = {
    (255, 255, 255): INK,
    (0, 0, 0): PAPER,
    rgb("#E6E6E6"): token("textField"),
    rgb("#e0dcd0"): token("cream"),
    rgb("#4A4A4A"): token("unit"),           # the barometer's steps
    GREEN: token("dataGreenLight"),
    (255, 196, 0): token("accentLine"),
}
NAMES = {"white": (255, 255, 255), "black": (0, 0, 0)}


def recolor(c, table=COLORS):
    if c in table:
        return table[c]
    # a shade of the brew screens' green: that much of it over the background
    k = c[1] / GREEN[1]
    if all(abs(c[i] - GREEN[i] * k) <= 12 for i in range(3)):
        return mix(PAPER, table[GREEN], k)
    raise SystemExit(f"no light color for {hexa(c)}")


def svg(path, table=COLORS):
    def one(m):
        value = m.group(2)
        if value in NAMES:
            c = NAMES[value]
        elif value.startswith("#"):
            c = rgb(value)
        else:
            return m.group(0)
        return m.group(1) + hexa(recolor(c, table)) + '"'
    return re.sub(r'((?:fill|stroke|stop-color)=")([^"]*)"', one, (ASSETS / path).read_text())


def lottie(path):
    # The key order is kept: rlottie's parser reads some objects in order.
    doc = json.loads((ASSETS / path).read_text())

    def value(k):
        return [round(x / 255, 6) for x in recolor(tuple(round(x * 255) for x in k[:3]))] + k[3:]

    def walk(o):
        if isinstance(o, dict):
            if o.get("ty") in ("fl", "st") and isinstance(o.get("c"), dict):
                k = o["c"]["k"]
                if k and isinstance(k[0], dict):
                    for key in k:
                        for end in ("s", "e"):
                            if end in key:
                                key[end] = value(key[end])
                else:
                    o["c"]["k"] = value(k)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(doc)
    return json.dumps(doc, separators=(",", ":"), ensure_ascii=False)


def png(path, fn):
    im = Image.open(ASSETS / path).convert("RGBA")
    im.putdata([fn(p[:3]) + (p[3],) for p in im.getdata()])
    return im


def over_paper(full, light):
    """A picture in one color over black: the same shares of `light` over the paper."""
    i = max(range(3), key=lambda n: full[n])
    return lambda p: mix(PAPER, light, min(1, p[i] / full[i]))


WIFI = {**COLORS, (0, 0, 0): token("gray3")}     # the arcs over the level
# Not the sleep screens' (the rest of icons/idle-*, idle-metcat): they are dark in both themes.
ICONS = ["plus", "download", "clock", "profile-globe-alt", "brew-barometer-steps", "brew-cup", "brew-cup-arrow",
         "brew-drip-tray"]
ICONS += sorted(p.stem for p in (ASSETS / "icons").glob("profile-kb-*.svg"))

baked = {f"icons/{name}.svg": svg(f"icons/{name}.svg") for name in ICONS}
baked |= {f"icons/wifi-level-{n}.svg": svg(f"icons/wifi-level-{n}.svg", WIFI) for n in range(1, 5)}
baked |= {p: lottie(p) for p in sorted(f"lottie/{f.name}" for f in (ASSETS / "lottie").glob("*.json") if f.stem != "idle-metcat")}
baked |= {p: png(p, over_paper(GREEN, COLORS[GREEN])) for p in sorted(f"images/{f.name}" for f in (ASSETS / "images").glob("brew-*.png"))}
baked["icons/idle-scale-weight.png"] = png("icons/idle-scale-weight.png", over_paper(BLUE, BLUE))
baked["icons/idle-scale-overlay.png"] = png("icons/idle-scale-overlay.png", lambda p: PAPER)

shutil.rmtree(OUT, ignore_errors=True)
for path, content in baked.items():
    target = OUT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, str):
        target.write_text(content)
    else:
        content.save(target, optimize=True)

(DIAL / "Core" / "LightAssets.js").write_text(
    ".pragma library\n"
    "// The pictures with a light twin under assets/light. Written by qt/tools/theme/bake_light_assets.py.\n\n"
    "const PATHS = {\n" + ",\n".join(f'    "{p}": true' for p in sorted(baked)) + "\n}\n\n"
    "function has(path) { return PATHS[path] === true }\n")
print(len(baked), "light assets,", sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) // 1024, "KB")
