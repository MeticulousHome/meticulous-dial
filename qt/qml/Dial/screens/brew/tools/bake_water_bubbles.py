#!/usr/bin/env python3
# bake_water_bubbles.py <WaterBubbles.json> <brew-water-bubbles.json>
#
# Makes the heating screen's bubbles (src/components/Heating/WaterBubbles.json) playable by LottieItem
# (rlottie) and ready for the temperature gradient without a blend effect:
#
# 1. Each bubble's scale cycles with the expression loopOut() from a negative start time (st). rlottie runs
#    no expressions, so every layer would hold its last key: the cycle is baked into keys in composition
#    time (the qt-proto tools/lottie_qt.py idea). Before the first key a layer holds its first value, as
#    loopOut() does (only after the last key does it cycle).
# 2. The React screen multiplies a gradient over white bubbles on black (mix-blend-mode: multiply), which
#    is the gradient wherever a bubble is. So the file is turned inside out: one shape layer, a black
#    rectangle with a hole per bubble (even-odd fill; the bubbles never overlap, 12 px apart at their
#    largest), and the gradient drawn under it shows through the holes, antialiased edges included.
#    Every bubble layer is the same: a 15 px circle scaled 23.183 % in a group whose position is the
#    layer's anchor, so a bubble is a circle at the layer's position whose diameter is
#    15 * 0.23183 * the layer's scale: one ellipse with an animated size. (An inverted track matte would
#    do the same, but rlottie's mattes top out at alpha 251, which lets 1.6 % of the gradient through the
#    black, and cost 0.6 ms a frame on amd64 against about 0.1 ms for the path.)
import json
import math
import sys


def bake(prop, st, op):
    keys = prop["k"]
    t0, t1 = keys[0]["t"], keys[-1]["t"]
    period = t1 - t0
    out = []
    n = 0
    while True:
        base = st + n * period
        if base + t0 > op + period:
            break
        # The last key of a cycle is the first key of the next one.
        for k in keys[:-1]:
            out.append(dict(k, t=k["t"] + base))
        n += 1
    out.sort(key=lambda k: k["t"])
    # Keep one key at or before 0 so the first segment starts in the right place.
    while len(out) > 1 and out[1]["t"] <= 0:
        out.pop(0)
    last = out[-1]
    out[-1] = {"t": last["t"], "s": last["s"]}
    return out


def value_at_key_times(original_keys, st, t):
    """The original property at composition time t, with loopOut('cycle') semantics, at key times only."""
    local = t - st
    t0, t1 = original_keys[0]["t"], original_keys[-1]["t"]
    if local > t1:
        local = t0 + (local - t0) % (t1 - t0)
    for k in original_keys:
        if abs(k["t"] - local) < 1e-6:
            return k["s"]
    return None


def two(easing):
    return {axis: (v[:2] if isinstance(v, list) else v) for axis, v in easing.items()}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    d = json.load(open(src))
    op, w, h = d["op"], d["w"], d["h"]
    holes = []
    for layer in d["layers"]:
        ks = layer["ks"]
        group = layer["shapes"][0]["it"]
        ellipse = next(i for i in group if i["ty"] == "el")
        transform = next(i for i in group if i["ty"] == "tr")
        assert ks["a"]["k"][:2] == transform["p"]["k"] and ellipse["p"]["k"] == [0, 0]
        assert ks["r"]["k"] == 0 and ks["o"]["k"] == 100 and layer["ip"] <= 0 and layer["op"] >= op
        diameter = ellipse["s"]["k"][0] * transform["s"]["k"][0] / 100
        keys = bake(ks["s"], layer.get("st", 0), op)
        # Every baked key holds the value the original has at that time (z is unused: ddd 0).
        for k in keys:
            if 0 <= k["t"] <= op:
                expected = value_at_key_times(ks["s"]["k"], layer.get("st", 0), k["t"])
                if expected is not None and expected[:2] != k["s"][:2]:
                    raise SystemExit(f"layer {layer.get('ind')}: {k['s']} at {k['t']}, expected {expected}")
        size = []
        for k in keys:
            key = {"t": k["t"], "s": [diameter * k["s"][0] / 100, diameter * k["s"][1] / 100]}
            if "i" in k:
                key["i"] = two(k["i"])
                key["o"] = two(k["o"])
            size.append(key)
        holes.append({"ty": "el", "d": 1, "p": {"a": 0, "k": ks["p"]["k"][:2]}, "s": {"a": 1, "k": size}})

    # The black: larger than the composition, which leaves a strip above and below when fitted in the item.
    cover = {"ty": "rc", "d": 1, "s": {"a": 0, "k": [w + 100, h + 100]}, "p": {"a": 0, "k": [w / 2, h / 2]},
             "r": {"a": 0, "k": 0}}
    fill = {"ty": "fl", "c": {"a": 0, "k": [0, 0, 0, 1]}, "o": {"a": 0, "k": 100}, "r": 2}
    identity = {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]}, "s": {"a": 0, "k": [100, 100]},
                "r": {"a": 0, "k": 0}, "o": {"a": 0, "k": 100}}
    d["layers"] = [{
        "ddd": 0, "ind": 1, "ty": 4, "nm": "black with bubble holes", "sr": 1, "ao": 0, "ip": 0, "op": op + 1, "st": 0,
        "bm": 0, "ks": {"o": {"a": 0, "k": 100}, "r": {"a": 0, "k": 0}, "p": {"a": 0, "k": [0, 0, 0]},
                         "a": {"a": 0, "k": [0, 0, 0]}, "s": {"a": 0, "k": [100, 100, 100]}},
        "shapes": [{"ty": "gr", "nm": "holes", "it": [cover] + holes + [fill, identity]}],
    }]
    d.pop("assets", None)
    json.dump(d, open(dst, "w"), separators=(",", ":"))
    print("holes", len(holes), "keys in hole 0:", len(holes[0]["s"]["k"]))


if __name__ == "__main__":
    main()
