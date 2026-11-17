#!/usr/bin/env python3
# bake_water_bubbles.py <WaterBubbles.json> <brew-water-bubbles.json>
#
# Makes the heating screen's bubbles (WaterBubbles.json, the React art: src/components/Heating/ on the stable
# branch) playable by LottieItem (rlottie) and ready for the temperature gradient without a blend effect:
#
# 1. Each bubble's scale runs the expression loopOut(). rlottie runs no expressions, so the cycle is baked
#    into keys (the qt-proto tools/lottie_qt.py idea). Key times are composition frames, as lottie-web reads
#    them: a shape layer's start time (st, negative here) does not move its keys. Read as layer time, the
#    keys moved by each layer's st and the 60-314 loop no longer closed: every 8.8 s the bubbles jumped to
#    other sizes. The last keys sit at the end of the file (374.7-375), so loopOut() does not cycle within
#    the frames the Dial plays; it is baked anyway, from the last key on, as loopOut() does. Before the
#    first key a layer holds its first value.
#    The art's own keys do not close the loop either: at frames 62 and 312 every bubble sits at the same size
#    with flat easing, so they all stop at once and the field freezes for a moment at each wrap. close_loop()
#    replaces the keys at 62 and 312 with one pose, the size the bubble's wave has at 312, and splits the wave
#    there (De Casteljau), so size and speed continue across 312 -> 62. A wave of about 125 frames, where the
#    art skips a half-wave, gets the opposite extreme back at its midpoint. The intro (before 62) and the
#    drain (after 312) keep their keys; only their easing at the pose is set, so they arrive at and leave it
#    at the wave's speed (the vertical handles may leave 0..1: the bubble overshoots a little and turns).
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


def bake(prop, op):
    keys = prop["k"]
    t0, t1 = keys[0]["t"], keys[-1]["t"]
    period = t1 - t0
    out = []
    n = 0
    while True:
        base = n * period
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


def value_at_key_times(original_keys, t):
    """The original property at composition time t, with loopOut('cycle') semantics, at key times only."""
    t0, t1 = original_keys[0]["t"], original_keys[-1]["t"]
    if t > t1:
        t = t0 + (t - t0) % (t1 - t0)
    for k in original_keys:
        if abs(k["t"] - t) < 1e-6:
            return k["s"]
    return None


LOOP_START, LOOP_END = 62, 312
HALF_WAVE = 62.5
EASE = (0.333, 0, 0.667, 1)


def bezier(s, a, b):
    return 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3


def solve(x1, x2, u):
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if bezier(mid, x1, x2) < u:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def split(u):
    """The standard easing curve cut at time u: both halves' handles, renormalised, the progress at u and the slope there (progress per unit of time)."""
    x1, y1, x2, y2 = EASE
    s = solve(x1, x2, u)

    def lerp(p, q):
        return (p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s)

    a, b, c = lerp((0, 0), (x1, y1)), lerp((x1, y1), (x2, y2)), lerp((x2, y2), (1, 1))
    ab, bc = lerp(a, b), lerp(b, c)
    m = lerp(ab, bc)
    left = (a[0] / m[0], a[1] / m[1], ab[0] / m[0], ab[1] / m[1])
    right = ((bc[0] - m[0]) / (1 - m[0]), (bc[1] - m[1]) / (1 - m[1]),
             (c[0] - m[0]) / (1 - m[0]), (c[1] - m[1]) / (1 - m[1]))
    dx = 3 * ((1 - s) ** 2 * x1 + 2 * (1 - s) * s * (x2 - x1) + s * s * (1 - x2))
    dy = 3 * ((1 - s) ** 2 * y1 + 2 * (1 - s) * s * (y2 - y1) + s * s * (1 - y2))
    return left, right, m[1], dy / dx


def handles(h):
    return {"x": [h[0]] * 2, "y": [h[1]] * 2}, {"x": [h[2]] * 2, "y": [h[3]] * 2}


def close_loop(keys):
    """Makes keys (one hole's size keys) wrap seamlessly from LOOP_END to LOOP_START."""
    period = LOOP_END - LOOP_START
    c = min(range(len(keys)), key=lambda i: abs(keys[i]["t"] - LOOP_START))
    b = min(range(len(keys)), key=lambda i: abs(keys[i]["t"] - LOOP_END))
    assert abs(keys[c]["t"] - LOOP_START) < 1 and abs(keys[b]["t"] - LOOP_END) < 1 and c + 1 < b
    a, d = keys[b - 1], keys[c + 1]
    if d["t"] + period - a["t"] > HALF_WAVE * 1.1:
        values = [k["s"][0] for k in keys[c:b + 1]]
        opposite = max(values) if abs(a["s"][0] - min(values)) < abs(a["s"][0] - max(values)) else min(values)
        mid = {"t": a["t"] + (d["t"] + period - a["t"]) / 2, "s": [opposite, opposite]}
        mid["o"], mid["i"] = handles((EASE[0], 0, EASE[2], 1))
        a["o"], a["i"] = mid["o"], mid["i"]
        if mid["t"] < LOOP_END:
            keys.insert(b, mid)
            b += 1
            a = mid
        else:
            mid["t"] -= period
            keys.insert(c + 1, mid)
            b += 1
            d = mid
    span = d["t"] + period - a["t"]
    left, right, progress, slope = split((LOOP_END - a["t"]) / span)
    wave = d["s"][0] - a["s"][0]
    pose = a["s"][0] + wave * progress
    speed = wave * slope / span
    keys[c]["t"], keys[b]["t"] = LOOP_START, LOOP_END
    keys[c]["s"] = keys[b]["s"] = [pose, pose]
    a["o"], a["i"] = handles(left)
    keys[c]["o"], keys[c]["i"] = handles(right)
    # The intro arrives at the pose, and the drain leaves it, at the wave's own speed.
    before, after = keys[c - 1], keys[b + 1]
    rise, fall = pose - before["s"][0], after["s"][0] - pose
    assert rise and fall, (rise, fall)
    arrive = 1 - speed * (1 - before["i"]["x"][0]) * (LOOP_START - before["t"]) / rise
    leave = speed * keys[b]["o"]["x"][0] * (after["t"] - LOOP_END) / fall
    assert -2 < arrive < 3 and -2 < leave < 3, (arrive, leave, rise, fall)
    before["i"] = {"x": before["i"]["x"], "y": [arrive] * 2}
    keys[b]["o"] = {"x": keys[b]["o"]["x"], "y": [leave] * 2}


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
        keys = bake(ks["s"], op)
        # Every baked key holds the value the original has at that time (z is unused: ddd 0).
        for k in keys:
            if 0 <= k["t"] <= op:
                expected = value_at_key_times(ks["s"]["k"], k["t"])
                if expected is not None and expected[:2] != k["s"][:2]:
                    raise SystemExit(f"layer {layer.get('ind')}: {k['s']} at {k['t']}, expected {expected}")
        size = []
        for k in keys:
            key = {"t": k["t"], "s": [diameter * k["s"][0] / 100, diameter * k["s"][1] / 100]}
            if "i" in k:
                key["i"] = two(k["i"])
                key["o"] = two(k["o"])
            size.append(key)
        close_loop(size)
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
