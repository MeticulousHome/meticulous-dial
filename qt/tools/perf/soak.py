#!/usr/bin/env python3
"""A long run on the machine: plays the frame meter's scenarios in a loop and records, per run, the frame
rate, the hitches and the Dial's memory, to see whether it degrades over time (leaks, slower GC).

    python3 soak.py MINUTES OUT.jsonl [--scenarios browse,menu,routes,bubble]

Runs ON the machine next to flipsrun.py. Only scenarios that never act on the machine.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flipsrun  # noqa: E402


def rss_mb(pid):
    for line in open(f"/proc/{pid}/status"):
        if line.startswith("VmRSS:"):
            return int(line.split()[1]) / 1024
    return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("minutes", type=float)
    p.add_argument("out")
    p.add_argument("--scenarios", default="browse,menu,routes,bubble")
    p.add_argument("--port", type=int, default=9310)
    a = p.parse_args()
    end = time.monotonic() + a.minutes * 60
    scenarios = a.scenarios.split(",")
    n = 0
    with open(a.out, "a") as out:
        while time.monotonic() < end:
            scenario = scenarios[n % len(scenarios)]
            result = flipsrun.run(scenario, a.port, 63.533, n)
            pid = flipsrun.dial_pid()
            result["rss_mb"] = round(rss_mb(pid), 1) if pid else None
            result["t"] = round(time.time())
            out.write(json.dumps(result) + "\n")
            out.flush()
            n += 1


if __name__ == "__main__":
    main()
