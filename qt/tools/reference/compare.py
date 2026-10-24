#!/usr/bin/env python3
"""Side by side of the React screenshot and the Qt one, with their difference:

    compare.py REF.png QT.png OUT.png

The Qt grab keeps straight alpha: it is composited over black first. The third panel shows where they
differ (bright = different); the script prints the share of pixels that differ by more than 48 levels.
"""
import sys

from PIL import Image, ImageChops


def load(path):
    im = Image.open(path).convert("RGBA").resize((480, 480))
    bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
    return Image.alpha_composite(bg, im).convert("RGB")


ref, qt = load(sys.argv[1]), load(sys.argv[2])
diff = ImageChops.difference(ref, qt).convert("L")
changed = sum(1 for v in diff.getdata() if v > 48) / (480 * 480)
out = Image.new("RGB", (480 * 3 + 8, 480), (60, 60, 60))
out.paste(ref, (0, 0))
out.paste(qt, (484, 0))
out.paste(diff.point(lambda v: min(255, v * 3)).convert("RGB"), (968, 0))
out.save(sys.argv[3])
print(f"{sys.argv[3]}: {100 * changed:.1f}% of pixels differ")
