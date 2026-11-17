#!/usr/bin/env python3
"""Do the Dial's hitches line up with the JavaScript garbage collector? Runs ON the machine after the Dial
was started with QT_LOGGING_RULES="qt.qml.gc.statistics=true": plays a scenario N times with the frame
meter, then reads the journal (monotonic timestamps) and lists each hitch with the GC runs around it.

    python3 gc_correlate.py UNIT SCENARIO [N]
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flipsrun  # noqa: E402

unit, scenario = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 5
runs = [flipsrun.run(scenario, 9310, 63.533, i) for i in range(n)]
journal = subprocess.run(["journalctl", "-u", unit, "--since", "-10min", "--no-pager", "-o", "short-monotonic"],
                         capture_output=True, text=True).stdout.splitlines()
gc_lines = []
for line in journal:
    m = re.match(r"\[\s*([0-9.]+)\]", line)
    if m and ("GC" in line or "Marked" in line or "Freed" in line or "mark" in line.lower() or "sweep" in line.lower()):
        gc_lines.append((float(m.group(1)), line.split(": ", 1)[-1][:160]))
print(f"{len(gc_lines)} GC log lines")
for r in runs:
    print(json.dumps({k: r[k] for k in ("scenario", "rep", "fps_motion", "hitches_ge3", "worst_ms")}))
    for h in r["hitches"]:
        at = r["t0_mono"] + h["at_ms"] / 1000
        near = [f"{t - at:+.3f}s {text}" for t, text in gc_lines if -0.3 < t - at < 0.3]
        print(f"  hitch {h['ms']} ms at {at:.3f}: " + (" | ".join(near[:6]) if near else "no GC nearby"))
