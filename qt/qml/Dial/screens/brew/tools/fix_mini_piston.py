#!/usr/bin/env python3
# fix_mini_piston.py <miniPiston.json> <brew-mini-piston.json>
#
# Makes Brew complete's small piston (src/components/MiniPurgePiston/miniPiston.json, a LottieFiles Figma
# export) render in rlottie as lottie-web renders it:
# - rlottie refuses the file: its composition is 41.06 x 90.25 and rlottie wants whole numbers. The size is
#   rounded down (41 x 90) and the layers moved by half the difference, so the drawing stays centered as
#   lottie-web centers it in its box (xMidYMid meet) at the same scale; rlottie does not clip the edges.
# - The hatch under the piston is 14 stripes, each under a track matte (the same rectangle) and parented to
#   a "Mask group" layer; rlottie draws none of them. The transforms are static translations, so every
#   matte becomes a layer mask on its stripe (the rectangle moved into the stripe's own space) and the
#   matte layers go.
import json
import math
import sys


def static(prop):
    assert not prop.get("a"), prop
    return prop["k"]


def offset_of(layer):
    """Layer space -> parent space is a translation by p - a (scale 100, no rotation, checked)."""
    ks = layer["ks"]
    assert static(ks["s"])[:2] == [100, 100] and static(ks["r"]) == 0
    p, a = static(ks["p"]), static(ks["a"])
    return [p[0] - a[0], p[1] - a[1]]


def main():
    src, dst = sys.argv[1], sys.argv[2]
    d = json.load(open(src))
    layers = d["layers"]
    out = []
    i = 0
    while i < len(layers):
        layer = layers[i]
        if layer.get("td") == 1:
            matted = layers[i + 1]
            assert matted.get("tt") == 1 and matted.get("parent") == layer.get("parent")
            path = next(s for s in layer["shapes"] if s["ty"] == "sh")["ks"]["k"]
            mo, so = offset_of(layer), offset_of(matted)
            dx, dy = mo[0] - so[0], mo[1] - so[1]
            mask = {"inv": False, "mode": "a", "nm": "Mask 1", "o": {"a": 0, "k": 100}, "x": {"a": 0, "k": 0},
                    "pt": {"a": 0, "k": dict(path, v=[[x + dx, y + dy] for x, y in path["v"]])}}
            matted = dict(matted, hasMask=True, masksProperties=[mask])
            matted.pop("tt")
            out.append(matted)
            i += 2
            continue
        out.append(layer)
        i += 1
    d["layers"] = out

    w, h = math.floor(d["w"]), math.floor(d["h"])
    dx, dy = (w - d["w"]) / 2, (h - d["h"]) / 2
    for layer in out:
        if "parent" in layer:
            continue
        p = layer["ks"]["p"]
        if p.get("a"):
            for k in p["k"]:
                for key in ("s", "e"):
                    if key in k:
                        k[key] = [k[key][0] + dx, k[key][1] + dy] + k[key][2:]
        else:
            p["k"] = [p["k"][0] + dx, p["k"][1] + dy] + p["k"][2:]
    d["w"], d["h"] = w, h
    json.dump(d, open(dst, "w"), separators=(",", ":"))
    print("layers", len(out), "size", w, h)


if __name__ == "__main__":
    main()
