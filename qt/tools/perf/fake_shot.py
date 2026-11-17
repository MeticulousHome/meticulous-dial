#!/usr/bin/env python3
"""Frame rate of the brewing screens on the machine WITHOUT brewing: pauses the Dial's socket events and
feeds it a made-up shot through the test port (Backend.onStatus, as if the backend sent it), while counting
the frames that reach the panel. Nothing is sent to the backend or the machine. Runs ON the machine:

    python3 fake_shot.py [--seconds 14]

Phases: heating (3 s), extraction with the live graph (pressure / flow / weight curves at 10 Hz), then
"remove cup" (brew complete). The socket is resumed and the Dial sent home at the end.
"""
import argparse
import json
import math
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flipsrun  # noqa: E402


def status(name, t, extracting, p=0.0, f=0.0, w=0.0, temp=92.0, shot_t=0.0, stage=None):
    return {
        "name": name, "state": "brewing" if extracting else "idle", "extracting": extracting,
        "sensors": {"p": p, "f": f, "w": w, "t": temp, "g": w},
        "time": int(t * 1000), "profile_time": int(shot_t * 1000), "profile": "Perf test",
        "setpoints": {"active": "pressure", "pressure": 9.0}, "loaded_profile": "perf-test", "id": "perf",
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--seconds", type=float, default=14)
    p.add_argument("--port", type=int, default=9310)
    a = p.parse_args()
    ws = flipsrun.WS(a.port)
    ev = lambda js: ws.call({"cmd": "eval", "js": js})
    ev("Backend._socket.enabled = false")
    stamps = []
    total = a.seconds + 5
    t = threading.Thread(target=flipsrun.flips, args=(total, stamps))
    t.start()
    t0 = time.monotonic()
    marks = {}
    try:
        while True:
            now = time.monotonic() - t0
            if now > total - 0.5:
                break
            if now < 3:
                s = status("heating", now, False, temp=85 + now * 2)
                phase = "heating"
            elif now < 3 + a.seconds - 2:
                st = now - 3
                pressure = 9 * (1 - math.exp(-st / 2)) - 0.5 * math.sin(st)
                flow = 2.2 * (1 - math.exp(-st / 3))
                weight = max(0.0, 2.0 * (st - 2))
                s = status("Infusion", now, True, p=pressure, f=flow, w=weight, shot_t=st)
                phase = "extraction"
            else:
                s = status("remove cup", now, False, w=36.0, shot_t=a.seconds - 2)
                phase = "brewComplete"
            marks.setdefault(phase, round(now, 2))
            ev("Backend.onStatus(" + json.dumps(s) + ")")
            time.sleep(0.1)
    finally:
        t.join()
        ev("Backend._socket.enabled = true")
        ev("Nav.setScreen('profileHome')")
    # Per phase frame stats.
    period = 1 / 63.533
    out = {"marks": marks}
    bounds = [("heating", 0.3, marks.get("extraction", 3)), ("extraction", marks.get("extraction", 3) + 0.5,
              marks.get("brewComplete", total) - 0.2), ("brewComplete", marks.get("brewComplete", total) + 0.6, total - 1)]
    for name, lo, hi in bounds:
        F = [x - t0 for x in stamps if lo <= x - t0 <= hi]
        # A gap over 100 ms is idle time between two updates (nothing to draw), not a stall: left out, as
        # flipsrun does.
        iv = [b - a2 for a2, b in zip(F, F[1:]) if b - a2 <= 0.1]
        vb = [round(x / period) for x in iv]
        dur = sum(iv)
        out[name] = {"frames": len(F), "fps": round(len(iv) / dur, 2) if dur else 0,
                     "on_every_vblank_pct": round(100 * vb.count(1) / len(vb), 1) if vb else None,
                     "hitches_ge3": sum(1 for x in vb if x >= 3), "worst_ms": round(1000 * max(iv), 1) if iv else None}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
