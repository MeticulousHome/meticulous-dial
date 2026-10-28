#!/usr/bin/env python3
# bake_piston.py <lottie.json> <out.png>:<layers> [<out.png>:<layers> ...]
#
# The purge screen's piston (lottie/brew-piston.json) and Brew complete's mini piston
# (lottie/brew-mini-piston.json) are still pictures whose moving layers only slide down, linearly, as the
# frame goes from 0 to 60. Drawn by LottieItem, the piston could only stop on whole frames (2 px apart at
# 2 subframes), and every frame was rasterized again, so the steps of the thin ellipses' edges crawled as
# it moved. Baked instead into one picture per group of layers at frame 0, the moving pictures slide by
# fractions of a pixel in QML (SmoothPiston.qml) and never change.
#
# <layers> are the root layers' indices in the file (comma-separated, top first in the file); every
# picture is the file's size, rendered 4x larger by rlottie and reduced with an area filter (premultiplied
# alpha, so no dark fringes). The moving layers' travel from frame 0 to the last frame is printed for the
# QML side.
#   pip install rlottie-python pillow
#   bake_piston.py ../../../assets/lottie/brew-piston.json \
#       ../../../assets/images/brew-piston-back.png:3 ../../../assets/images/brew-piston-rod.png:2 \
#       ../../../assets/images/brew-piston-front.png:0,1
#   bake_piston.py ../../../assets/lottie/brew-mini-piston.json \
#       ../../../assets/images/brew-mini-piston-body.png:1-16 ../../../assets/images/brew-mini-piston-plunger.png:0
import copy
import json
import os
import sys
import tempfile

from PIL import Image
from rlottie_python import LottieAnimation

SCALE = 4


def indices(spec):
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def travel(layer):
    p = layer["ks"]["p"]
    if not p.get("a"):
        return None
    keys = p["k"]
    for k in keys[:-1]:
        # Linear in time: the handles on the diagonal, no holds.
        assert not k.get("h"), "hold keys are not handled"
        assert k["o"] == {"x": 0, "y": 0} and k["i"] == {"x": 1, "y": 1}, "eased keys are not handled"
    first, last = keys[0]["s"], keys[-1]["s"]
    assert first[0] == last[0], "only vertical travel is handled"
    return last[1] - first[1]


def bake(doc, keep, out):
    layers = doc["layers"]
    kept = [layers[i] for i in keep]
    kept_ids = {layer.get("ind") for layer in kept}
    for layer in kept:
        assert layer.get("parent") is None or layer["parent"] in kept_ids, "a parent layer is missing"
    part = copy.deepcopy(doc)
    part["layers"] = copy.deepcopy(kept)
    w, h = doc["w"], doc["h"]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(part, f)
        path = f.name
    try:
        anim = LottieAnimation.from_file(path)
        big = anim.render_pillow_frame(frame_num=0, width=w * SCALE, height=h * SCALE)
    finally:
        os.unlink(path)
    picture = big.convert("RGBa").resize((w, h), Image.Resampling.BOX).convert("RGBA")
    picture.save(out, optimize=True)
    moves = {travel(layer) for layer in kept}
    print(f"{out}: layers {keep}, {w} x {h}, travel {sorted(m for m in moves if m is not None) or 'none'}")


def main():
    doc = json.load(open(sys.argv[1]))
    for arg in sys.argv[2:]:
        out, spec = arg.rsplit(":", 1)
        bake(doc, indices(spec), out)


if __name__ == "__main__":
    main()
