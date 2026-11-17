#!/usr/bin/env python3
# crop_lottie.py <in.json> <out.json> X Y W H
#
# The purge screen's Lotties (src/components/PurgePiston/piston.json and blink.json) are 480 x 480 but draw
# in a small part of it (the piston within x 166..313, y 123..409; the blink within 166..313, 331..412, over
# all frames). LottieItem renders the whole item every frame and uploads it as a texture, so the files are
# cropped to the part they draw in: the composition becomes W x H and every root layer moves by (-X, -Y).
# Shown at (X, Y), 1:1, the pictures are the same, with a fraction of the pixels to render and upload.
import json
import sys


def shift(value, dx, dy):
    return [value[0] + dx, value[1] + dy] + value[2:]


def main():
    src, dst = sys.argv[1], sys.argv[2]
    x, y, w, h = (float(v) for v in sys.argv[3:7])
    d = json.load(open(src))
    for layer in d["layers"]:
        if "parent" in layer:
            continue
        p = layer["ks"]["p"]
        assert not p.get("s"), "split position not handled"
        if p.get("a"):
            for k in p["k"]:
                for key in ("s", "e"):
                    if key in k:
                        k[key] = shift(k[key], -x, -y)
        else:
            p["k"] = shift(p["k"], -x, -y)
    d["w"], d["h"] = int(w), int(h)
    json.dump(d, open(dst, "w"), separators=(",", ":"))
    print(dst, d["w"], "x", d["h"])


if __name__ == "__main__":
    main()
