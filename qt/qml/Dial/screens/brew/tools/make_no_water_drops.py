#!/usr/bin/env python3
# make_no_water_drops.py [out.json]
#
# Writes lottie/brew-no-water.json, the animation of the no water screen (NoWaterScreen.qml): a drop made
# of dots, in the manner of the heating screen's bubbles. The water drains from the tip down: where the level
# passes, the blue bubbles shrink to small grey dots, as the heating bubbles go grey without water. The empty
# drop stays for a while, then the water comes back from the bottom and the loop starts again.
# 180 x 200, 30 frames a second, 5.4 s.
#
# There is no After Effects source: this script is the source, so edit it and run it again. It needs
# nothing outside the standard library. Keys are written in insertion order, "ty" first: rlottie's parser
# reads some objects in key order (docs/qt-migration/DECISIONS.md).
import json
import math
import os
import sys

WIDTH, HEIGHT = 180, 200
FPS, FRAMES = 30, 162

# Theme.dataBlueLight for the water, Theme.gray6 for the dots it leaves.
BLUE = [round(c / 255, 4) for c in (0x78, 0xD6, 0xFF)] + [1]
GREY = [round(c / 255, 4) for c in (0x89, 0x88, 0x86)] + [1]

# The drop: a circle and a tip above it, TIP radii from the center (DROP_X, DROP_Y) of the circle.
DROP_R = 66
DROP_X, DROP_Y = 90, 126
TIP = 1.8

# The dots: a staggered grid, as the bubbles of the heating screen.
PITCH = 17
ROW_PITCH = 14.7
EDGE = 3                      # a dot's center stays this far inside the drop
WET_RADII = (6.2, 5.0, 3.6)   # the bubbles, by a fixed pattern
DRY_RADIUS = 2.0

# When the water moves (frames).
DRAIN_START, DRAIN_END = 20, 92
DRY_FRAMES = 10
REFILL_START, REFILL_END = 138, 148
WET_FRAMES = 6
SETTLE_FRAMES = 5
OVERSHOOT = 1.14

EASE_IN_OUT = ([0.6], [0.0], [0.4], [1.0])
EASE_OUT = ([0.2], [0.0], [0.2], [1.0])


def fixed(value):
    return {"a": 0, "k": value}


def transform():
    return {"o": fixed(100), "r": fixed(0), "p": fixed([0, 0, 0]), "a": fixed([0, 0, 0]), "s": fixed([100, 100, 100])}


def group_transform():
    return {"ty": "tr", "p": fixed([0, 0]), "a": fixed([0, 0]), "s": fixed([100, 100]),
            "r": fixed(0), "o": fixed(100), "sk": fixed(0), "sa": fixed(0)}


def half_width(y):
    """Half the drop's width at y (relative to the center of its round part), or None outside it: a circle
    and the two straight lines from the tip that touch it."""
    r, d = DROP_R, TIP * DROP_R
    if y > r or y < -d:
        return None
    if y >= -r / TIP:
        return math.sqrt(r * r - y * y)
    return (y + d) * r / math.sqrt(d * d - r * r)


def outline():
    """Points along the drop's outline (one side is enough: the drop is symmetric)."""
    steps = 400
    span = (1 + TIP) * DROP_R
    heights = [min(DROP_R, -TIP * DROP_R + span * n / steps) for n in range(steps + 1)]
    return [(half_width(y), y) for y in heights]


OUTLINE = outline()


def edge_distance(x, y):
    """How far inside the drop a point is; negative outside it."""
    w = half_width(y)
    if w is None or abs(x) > w:
        return -1.0
    return min(math.hypot(abs(x) - ox, y - oy) for ox, oy in OUTLINE)


def pattern(row, column):
    """A fixed pseudo-random pick, so that the file is the same on every run."""
    n = (row * 73856093) ^ (column * 19349663) ^ 0x5BD1E995
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFF


def dots():
    """(x, y, wet radius, row, pattern) of every dot, rows from the tip down."""
    out = []
    first = -TIP * DROP_R + EDGE + 4
    rows = int((DROP_R - EDGE - first) / ROW_PITCH) + 1
    for row in range(rows):
        y = first + row * ROW_PITCH
        shift = PITCH / 2 if row % 2 else 0
        found = False
        for column in range(-5, 6):
            x = column * PITCH + shift
            inside = edge_distance(x, y)
            if inside < EDGE:
                continue
            pick = pattern(row, column)
            # Smaller toward the outline, so that the dots draw the drop's shape.
            wet = max(DRY_RADIUS + 0.8, min(WET_RADII[pick % len(WET_RADII)], inside))
            out.append((x, y, wet, row, pick))
            found = True
        if not found:
            # The tip is too narrow for the grid: one dot in the middle of each of its rows.
            out.append((0, y, DRY_RADIUS + 0.8, row, pattern(row, 0)))
    return out, rows


def track(*points):
    """Animated property: points are (frame, value, ease to the next point)."""
    out = []
    for frame, value, ease in points:
        key = {"t": frame, "s": value}
        if ease:
            o_x, o_y, i_x, i_y = ease
            key.update({"o": {"x": o_x, "y": o_y}, "i": {"x": i_x, "y": i_y}})
        out.append(key)
    return {"a": 1, "k": out}


def dot(x, y, wet, drain, refill):
    """A bubble until the level passes (drain), a small grey dot until the water is back (refill)."""
    full, dry, big = [[round(2 * r, 2)] * 2 for r in (wet, DRY_RADIUS, wet * OVERSHOOT)]
    dried, back = drain + DRY_FRAMES, refill + WET_FRAMES
    size = track((0, full, EASE_IN_OUT), (drain, full, EASE_IN_OUT), (dried, dry, EASE_IN_OUT), (refill, dry, EASE_OUT),
                 (back, big, EASE_IN_OUT), (back + SETTLE_FRAMES, full, EASE_IN_OUT), (FRAMES, full, None))
    color = track((0, BLUE, EASE_IN_OUT), (drain, BLUE, EASE_IN_OUT), (dried, GREY, EASE_IN_OUT),
                  (refill, GREY, EASE_OUT), (back, BLUE, EASE_IN_OUT), (FRAMES, BLUE, None))
    return {"ty": "gr", "nm": "dot", "it": [
        {"ty": "el", "p": fixed([round(x, 2), round(y, 2)]), "s": size},
        {"ty": "fl", "c": color, "o": fixed(100), "r": 1},
        group_transform(),
    ]}


def document():
    all_dots, rows = dots()
    shapes = []
    for x, y, wet, row, pick in all_dots:
        # The level goes down row by row; a dot leaves a little before or after its row.
        jitter = (pick >> 4) % 7 - 3
        drain = DRAIN_START + round((DRAIN_END - DRAIN_START) * row / (rows - 1)) + jitter
        refill = REFILL_START + round((REFILL_END - REFILL_START) * (rows - 1 - row) / (rows - 1)) + (pick >> 8) % 3 - 1
        shapes.append(dot(DROP_X + x, DROP_Y + y, wet, max(1, drain), refill))
    layer = {"ddd": 0, "ind": 1, "ty": 4, "nm": "drop", "sr": 1, "ks": transform(), "ao": 0, "shapes": shapes,
             "ip": 0, "op": FRAMES, "st": 0, "bm": 0}
    return {"v": "5.7.0", "fr": FPS, "ip": 0, "op": FRAMES, "w": WIDTH, "h": HEIGHT, "nm": "no water", "ddd": 0,
            "assets": [], "layers": [layer], "markers": []}


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "../../../assets/lottie/brew-no-water.json")
    with open(out, "w") as f:
        json.dump(document(), f, separators=(",", ":"))
        f.write("\n")
    print(os.path.normpath(out))


if __name__ == "__main__":
    main()
