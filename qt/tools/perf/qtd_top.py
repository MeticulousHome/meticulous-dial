#!/usr/bin/env python3
"""The longest top-level QML/JS ranges of a qmlprofiler trace (nested ranges folded into their parent),
with the biggest child of each: what blocked the GUI thread.

    python3 qtd_top.py TRACE.qtd [MIN_MS]
"""
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
min_ms = float(sys.argv[2]) if len(sys.argv) > 2 else 20
root = ET.parse(path).getroot()
types = {ev.get("index"): {c.tag: (c.text or "") for c in ev} for ev in root.iter("event")}


def label(t):
    return f"{t.get('rangeType', t.get('type', '')):14s} {t.get('filename', '').split('/')[-1]}:{t.get('line', '')} {(t.get('details') or '')[:70]}"


ranges = sorted(
    ((int(r.get("startTime")), int(r.get("duration", 0)), types.get(r.get("eventIndex"), {})) for r in root.iter("range")
     if r.get("duration")),
    key=lambda x: (x[0], -x[1]))
top, end = [], -1
children = {}
for start, dur, t in ranges:
    if start >= end:
        top.append((start, dur, t))
        end = start + dur
        children[len(top) - 1] = []
    else:
        children[len(top) - 1].append((start, dur, t))
long = [(i, s, d, t) for i, (s, d, t) in enumerate(top) if d / 1e6 >= min_ms]
print(f"{len(top)} top-level ranges, {len(long)} of {min_ms} ms or more")
for i, s, d, t in long:
    kids = sorted(children[i], key=lambda x: -x[1])
    print(f"t={s / 1e9:8.3f}s {d / 1e6:7.1f} ms  {label(t)}")
    for ks, kd, kt in [k for k in kids if k[1] < d * 0.98][:4]:
        print(f"           {kd / 1e6:7.1f} ms    {label(kt)}")
