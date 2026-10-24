#!/usr/bin/env python3
"""Measures how smoothly the Qt Dial runs on the machine: plays a scenario of knob / button events into
its test port and counts the frames that reach the panel (new framebuffers on the primary plane, read
from DRM debugfs; the same counter as the Qt prototype's flips.py). Runs ON the machine, stdlib only:

    python3 flipsrun.py SCENARIO [--port 9310] [--hz 63.533] [--reps 1]

Scenarios: browse, spin, menu, zoom, static, bubble. Prints one JSON line per run: frames per second while
something moves, the share of frames on consecutive vblanks, hitches of 3+ vblanks, worst interval, and the
CPU use of the Dial process.
"""
import argparse
import base64
import json
import os
import re
import socket
import statistics as st
import struct
import threading
import time

CW, CCW, CTX = "ENCODER_CLOCKWISE", "ENCODER_COUNTERCLOCKWISE", "CONTEXT"
DOWN, UP, PUSH = "ENCODER_PRESSED", "ENCODER_RELEASED", "ENCODER_PUSH"


def steps(kind, n, every, start=0):
    return [(start + i * every, kind) for i in range(n)]


def cycles(one, n, period):
    return [(at + i * period, kind) for i in range(n) for at, kind in one]


SCENARIOS = {
    # Ten cards to the right and back, a detent every 300 ms (each step animates 150 ms + the 440 ms bounce).
    "browse": (steps(CCW, 10, 300) + steps(CW, 10, 300, 3000), 8),
    # Fast spin: a detent every 80 ms.
    "spin": (steps(CCW, 10, 80) + steps(CW, 10, 80, 1800), 4),
    # The quick settings: open, 8 down, 8 up, close.
    "menu": ([(0, CTX)] + steps(CW, 8, 300, 800) + steps(CCW, 8, 300, 800 + 8 * 300) + [(800 + 16 * 300 + 300, CTX)], 8),
    # Select a card, hold 0.6 s (the ring fills and winds back, "Hold to start"), unselect; three times.
    # Never longer: a full hold starts a shot.
    "zoom": (cycles([(0, DOWN), (100, UP), (1000, DOWN), (1600, UP), (3000, CW)], 3, 4000), 13),
    # Nothing moves: should be ~0 frames.
    "static": ([], 6),
    # Quick settings -> "config" (a bubble component switch) -> close. The entry is found by its label
    # (SELECT below), never by position: positions differ per screen and some entries act on the machine.
    "bubble": ([(0, CTX), (800, "SELECT:config"), (2400, CTX)], 6),
}


class WS:
    """A minimal text WebSocket client (RFC 6455), enough for the test port."""

    def __init__(self, port):
        self.s = socket.create_connection(("127.0.0.1", port), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET / HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(1024)
        self.rest = buf.split(b"\r\n\r\n", 1)[1]

    def send(self, text):
        data = text.encode()
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n))
        self.s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _read(self, n):
        while len(self.rest) < n:
            self.rest += self.s.recv(65536)
        out, self.rest = self.rest[:n], self.rest[n:]
        return out

    def recv(self):
        b0, b1 = self._read(2)
        n = b1 & 0x7F
        if n == 126:
            n = struct.unpack(">H", self._read(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", self._read(8))[0]
        return self._read(n).decode()

    def call(self, msg):
        self.send(json.dumps(msg))
        return json.loads(self.recv())


SAFE = {"config", "wifi", "experimental", "brew settings", "report an issue", "exit", "back"}


def select(ws, label):
    """Turns to the menu entry `label` (one of SAFE: entries that only open menus) and pushes."""
    if label.lower() not in SAFE:
        raise SystemExit(f"refusing to select {label!r}: only menus, never machine actions")
    for direction in (CW, CCW):
        for _ in range(16):
            focused = (ws.call({"cmd": "focused"}).get("focused") or "").lower()
            if focused == label.lower():
                ws.call({"cmd": "button", "type": DOWN, "t": 300})
                time.sleep(0.08)
                ws.call({"cmd": "button", "type": UP, "t": 300})
                return
            ws.call({"cmd": "button", "type": direction, "t": 300})
            time.sleep(0.25)
    raise SystemExit(f"no {label!r} in the menu")


def flips(seconds, out):
    pat = re.compile(r"plane\[\d+\]: plane-0\n\tcrtc=crtc-0\n\tfb=(\d+)")
    end = time.monotonic() + seconds
    last = None
    with open("/sys/kernel/debug/dri/1/state") as f:
        while time.monotonic() < end:
            f.seek(0)
            m = pat.search(f.read())
            fb = m.group(1) if m else None
            if fb != last:
                out.append(time.monotonic())
                last = fb
            time.sleep(0.0007)


def dial_pid():
    for pid in os.listdir("/proc"):
        if pid.isdigit():
            try:
                if open(f"/proc/{pid}/comm").read().strip() == "meticulous-dial":
                    cmd = open(f"/proc/{pid}/cmdline").read()
                    if "meticulous-dial-qt" in cmd:
                        return int(pid)
            except OSError:
                pass
    return None


def cpu_ticks(pid):
    f = open(f"/proc/{pid}/stat").read().rsplit(")", 1)[1].split()
    return int(f[11]) + int(f[12])


def run(scenario, port, hz, rep):
    """Plays the scenario once and measures it."""
    seq, cap = SCENARIOS[scenario]
    ws = WS(port)
    state = ws.call({"cmd": "state"})
    if state.get("bubbleVisible"):
        ws.call({"cmd": "button", "type": CTX})
        time.sleep(0.8)
    if state.get("screen") != "profileHome":
        ws.call({"cmd": "screen", "name": "profileHome"})
    time.sleep(1.5)
    pid = dial_pid()
    stamps = []
    t = threading.Thread(target=flips, args=(cap, stamps))
    c0, w0 = (cpu_ticks(pid) if pid else 0), time.monotonic()
    t.start()
    time.sleep(0.5)
    t0 = time.monotonic()
    for at, kind in seq:
        delay = t0 + at / 1000 - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        if kind.startswith("SELECT:"):
            select(ws, kind.split(":", 1)[1])
        else:
            ws.call({"cmd": "button", "type": kind, "t": 300})
    t.join()
    c1, w1 = (cpu_ticks(pid) if pid else 0), time.monotonic()
    period = 1 / hz
    F = stamps[1:]
    segs, cur = [], []
    for f in F:
        if cur and f - cur[-1] > 0.1:
            segs.append(cur)
            cur = []
        cur.append(f)
    if cur:
        segs.append(cur)
    segs = [s for s in segs if len(s) >= 3]
    iv = [b - a for s in segs for a, b in zip(s, s[1:])]
    vb = [round(x / period) for x in iv]
    # Where the long intervals are, in ms from the first event, with the event just before each.
    hitches = []
    for s in segs:
        for a, b in zip(s, s[1:]):
            if round((b - a) / period) >= 3:
                at = 1000 * (a - t0)
                before = [k for when, k in seq if when <= at]
                hitches.append({"at_ms": round(at), "ms": round(1000 * (b - a), 1), "after": before[-1] if before else None})
    dur = sum(s[-1] - s[0] for s in segs)
    return {
        "scenario": scenario, "rep": rep, "frames": len(F),
        "fps_motion": round(len(iv) / dur, 2) if dur else 0.0, "motion_s": round(dur, 2),
        "on_every_vblank_pct": round(100 * vb.count(1) / len(vb), 1) if vb else None,
        "hitches_ge3": sum(1 for x in vb if x >= 3), "worst_ms": round(1000 * max(iv), 1) if iv else None,
        "intervals_vblanks": {str(k): vb.count(k) for k in sorted(set(vb))},
        "hitches": hitches,
        "cpu_pct": round(100 * (c1 - c0) / os.sysconf("SC_CLK_TCK") / (w1 - w0), 1) if pid else None,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("scenario", choices=sorted(SCENARIOS))
    p.add_argument("--port", type=int, default=9310)
    p.add_argument("--hz", type=float, default=63.533)
    p.add_argument("--reps", type=int, default=1)
    a = p.parse_args()
    for rep in range(a.reps):
        print(json.dumps(run(a.scenario, a.port, a.hz, rep)), flush=True)


if __name__ == "__main__":
    main()
