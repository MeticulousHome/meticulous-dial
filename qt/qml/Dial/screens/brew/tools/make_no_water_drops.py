#!/usr/bin/env python3
# make_no_water_drops.py [out.json]
#
# Writes lottie/brew-no-water.json, the animation of the no water screen (NoWaterScreen.qml): a big drop
# whose water drains with a moving surface, three smaller drops that fall beside it, each smaller than the
# last, with a ripple where they land, and the empty drop that turns red and beats once before the loop
# starts again. 320 x 240, 30 frames a second, 5 s.
#
# There is no After Effects source: this script is the source, so edit it and run it again. It needs
# nothing outside the standard library. Keys are written in insertion order, "ty" first: rlottie's parser
# reads some objects in key order (docs/qt-migration/DECISIONS.md).
import json
import os
import sys

WIDTH, HEIGHT = 320, 240
FPS, FRAMES = 30, 150

# Theme.dataBlueLight, Theme.error and a darker blue for the water behind the surface.
BLUE = [0x78 / 255, 0xD6 / 255, 0xFF / 255, 1]
DEEP = [0x2B / 255, 0x8F / 255, 0xC9 / 255, 1]
RED = [0xF4 / 255, 0x43 / 255, 0x36 / 255, 1]

HERO_R = 62
HERO_X, HERO_Y = 160, 128
FLOOR_Y = 212

# The water's surface, relative to the center of the big drop, and when it moves.
LEVEL_FULL, LEVEL_EMPTY = -56, 72
DRAIN_START, DRAIN_END = 14, 112
WAVE_PERIOD, WAVE_AMPLITUDE, WAVE_FRAMES = 80, 5, 37.5

# (x, half width of the drop, frame it starts, frame it lands, size of the ripple in percent)
SMALL_DROPS = [(56, 15, 12, 36, 100), (264, 12, 42, 66, 82), (56, 9, 72, 94, 64)]
SWELL = 8

EASE_IN_OUT = ([0.6], [0.0], [0.4], [1.0])
GRAVITY = ([0.55], [0.06], [0.9], [0.6])
LINEAR = ([0.0], [0.0], [1.0], [1.0])


def fixed(value):
    return {"a": 0, "k": value}


def keys(*points, ease=EASE_IN_OUT):
    """Animated property: points are (frame, value); a value is a number or a list."""
    out = []
    o_x, o_y, i_x, i_y = ease
    for n, (frame, value) in enumerate(points):
        key = {"t": frame, "s": value if isinstance(value, list) else [value]}
        if n < len(points) - 1:
            key.update({"o": {"x": o_x, "y": o_y}, "i": {"x": i_x, "y": i_y}})
        out.append(key)
    return {"a": 1, "k": out}


def transform(position=None, scale=None, opacity=None, anchor=None):
    return {
        "o": opacity or fixed(100),
        "r": fixed(0),
        "p": position or fixed([0, 0, 0]),
        "a": fixed(anchor or [0, 0, 0]),
        "s": scale or fixed([100, 100, 100]),
    }


def group_transform(position=None):
    return {"ty": "tr", "p": position or fixed([0, 0]), "a": fixed([0, 0]), "s": fixed([100, 100]),
            "r": fixed(0), "o": fixed(100), "sk": fixed(0), "sa": fixed(0)}


def group(name, items, position=None):
    return {"ty": "gr", "nm": name, "it": items + [group_transform(position)]}


def drop_path(r):
    """A drop with its tip up, the center of its round part at the origin."""
    c = 0.5523 * r
    return {
        "c": True,
        "v": [[0, -1.7 * r], [r, 0], [0, r], [-r, 0]],
        "i": [[-0.25 * r, 0.6 * r], [0, -0.62 * r], [c, 0], [0, c]],
        "o": [[0.25 * r, 0.6 * r], [0, c], [-c, 0], [0, -0.62 * r]],
    }


def wave_path(phase):
    """The water: a wavy top, wide enough for the whole travel, and a body far below the drop."""
    half = WAVE_PERIOD / 2
    handle = WAVE_PERIOD * 0.18
    count = int((640 + 240) / half)
    v, i, o = [], [], []
    for n in range(count + 1):
        v.append([-240 + n * half, (WAVE_AMPLITUDE if (n + phase) % 2 else -WAVE_AMPLITUDE)])
        i.append([-handle, 0])
        o.append([handle, 0])
    v += [[v[-1][0], 320], [-240, 320]]
    i += [[0, 0], [0, 0]]
    o += [[0, 0], [0, 0]]
    return {"c": True, "v": v, "i": i, "o": o}


def path(shape):
    return {"ty": "sh", "ks": fixed(shape)}


def fill(color):
    return {"ty": "fl", "c": fixed(color), "o": fixed(100), "r": 1}


def stroke(color, width):
    return {"ty": "st", "c": color, "o": fixed(100), "w": fixed(width), "lc": 2, "lj": 2}


def layer(index, name, shapes, ks, **extra):
    return {"ddd": 0, "ind": index, "ty": 4, "nm": name, "sr": 1, "ks": ks, "ao": 0, "shapes": shapes,
            "ip": 0, "op": FRAMES, "st": 0, "bm": 0, **extra}


def hero_outline(index):
    beat = keys((112, [100, 100, 100]), (121, [109, 109, 100]), (132, [100, 100, 100]), (FRAMES, [100, 100, 100]))
    color = keys((0, BLUE), (98, BLUE), (114, RED), (136, RED), (FRAMES, BLUE))
    return layer(index, "big drop", [group("outline", [path(drop_path(HERO_R)), stroke(color, 6)])],
                 transform(position=fixed([HERO_X, HERO_Y, 0]), scale=beat))


def hero_water(index):
    level = keys((0, [0, LEVEL_FULL]), (DRAIN_START, [0, LEVEL_FULL]), (DRAIN_END, [0, LEVEL_EMPTY]), (FRAMES, [0, LEVEL_EMPTY]))
    # Whole periods, so that the surface never jumps while it shows.
    travel = round(FRAMES / WAVE_FRAMES) * WAVE_PERIOD
    front = keys((0, [0, 0]), (FRAMES, [-travel, 0]), ease=LINEAR)
    back = keys((0, [-travel, 0]), (FRAMES, [0, 0]), ease=LINEAR)
    water = group("level", [
        group("surface", [path(wave_path(0)), fill(BLUE)], position=front),
        group("depth", [path(wave_path(1)), fill(DEEP)], position=back),
    ], position=level)
    opacity = keys((0, 0), (DRAIN_START, 100), (FRAMES, 100))
    return layer(index, "water", [water], transform(position=fixed([HERO_X, HERO_Y, 0]), opacity=opacity),
                 hasMask=True,
                 masksProperties=[{"inv": False, "mode": "a", "pt": fixed(drop_path(HERO_R)), "o": fixed(100),
                                   "x": fixed(0), "nm": "drop"}])


def small_drop(index, x, r, start, land):
    # It swells where it starts, inside the canvas, and then falls.
    top = 1.7 * r + 4
    fall = keys((0, [x, top, 0]), (start, [x, top, 0]), (land, [x, FLOOR_Y - r, 0]), (FRAMES, [x, FLOOR_Y - r, 0]), ease=GRAVITY)
    stretch = keys((0, [84, 90, 100]), (start, [84, 90, 100]), (land, [76, 120, 100]), (FRAMES, [76, 120, 100]))
    opacity = keys((0, 0), (start - SWELL, 0), (start, 100), (land, 100), (land + 1, 0), (FRAMES, 0))
    return layer(index, f"drop {index}", [group("drop", [path(drop_path(r)), fill(BLUE)])],
                 transform(position=fall, scale=stretch, opacity=opacity))


def ripple(index, x, land, size):
    grow = keys((0, [20, 20, 100]), (land, [20, 20, 100]), (land + 22, [size, size, 100]), (FRAMES, [size, size, 100]))
    opacity = keys((0, 0), (land - 1, 0), (land, 100), (land + 22, 0), (FRAMES, 0))
    ellipse = {"ty": "el", "p": fixed([0, 0]), "s": fixed([84, 18])}
    return layer(index, f"ripple {index}", [group("ring", [ellipse, stroke(fixed(BLUE), 3)])],
                 transform(position=fixed([x, FLOOR_Y, 0]), scale=grow, opacity=opacity))


def document():
    layers = [hero_outline(1), hero_water(2)]
    index = 3
    for x, r, start, land, size in SMALL_DROPS:
        layers.append(small_drop(index, x, r, start, land))
        layers.append(ripple(index + 1, x, land, size))
        index += 2
    return {"v": "5.7.0", "fr": FPS, "ip": 0, "op": FRAMES, "w": WIDTH, "h": HEIGHT, "nm": "no water", "ddd": 0,
            "assets": [], "layers": layers, "markers": []}


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "../../../assets/lottie/brew-no-water.json")
    with open(out, "w") as f:
        json.dump(document(), f, separators=(",", ":"))
        f.write("\n")
    print(os.path.normpath(out))


if __name__ == "__main__":
    main()
