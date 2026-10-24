#!/usr/bin/env python3
"""The same journeys on the React Dial and on the Qt Dial, side by side: outcome, the screens shown, the
focused menu entries read (trace_plugin), the turns of each "Go to" / "Choose" step, and observations.

    python3 compare.py qt/build/integration-artifacts/<react run> qt/build/integration-artifacts/<qt run> [-v]

Without -v only the journeys that differ are detailed.
"""
import json
import sys
from pathlib import Path


def journey(path: Path):
    report = json.loads(path.read_text())
    screens, focus, steps = [], [], []
    current, turns = None, ""
    for e in report["timeline"]:
        kind, text = e["kind"], e["text"]
        if kind == "screen" and (not screens or screens[-1] != text):
            screens.append(text)
        elif kind == "focus" and text != "None":
            focus.append(text)
        elif kind == "you":
            if text.startswith(("Go to “", "Choose “")):
                if current:
                    steps.append(f"{current} {turns}".rstrip())
                current, turns = text, ""
            elif text.startswith("Turn the knob"):
                turns += "R" if "right" in text else "L"
            elif current:
                steps.append(f"{current} {turns}".rstrip())
                current, turns = None, ""
    if current:
        steps.append(f"{current} {turns}".rstrip())
    check = report.get("failed_check") or {}
    return {"outcome": report["outcome"], "screens": screens, "focus": focus, "steps": steps,
            "failed": f"{check.get('check', '')} -> {(check.get('got') or '').splitlines()[0] if check else ''}"}


def main(react: Path, qt: Path, verbose: bool):
    a = {p.stem: p for p in (react / "reports").glob("*.json")}
    b = {p.stem: p for p in (qt / "reports").glob("*.json")}
    for name in sorted(set(a) | set(b)):
        ra = journey(a[name]) if name in a else None
        rb = journey(b[name]) if name in b else None
        print(f"{(ra or {}).get('outcome', '-'):8s} {(rb or {}).get('outcome', '-'):8s} {name}")
        if not ra or not rb:
            continue
        for key in ("screens", "focus", "steps"):
            if ra[key] != rb[key] or verbose:
                print(f"    {key}: react {ra[key]}")
                print(f"    {' ' * len(key)}  qt    {rb[key]}")
        for side, r in (("react", ra), ("qt", rb)):
            if r["outcome"] in ("failed", "error"):
                print(f"    {side} failed: {r['failed']}")
    oa = json.loads((react / "observations.json").read_text()) if (react / "observations.json").exists() else {}
    ob = json.loads((qt / "observations.json").read_text()) if (qt / "observations.json").exists() else {}
    print("\nobservations")
    for key in sorted(set(oa) | set(ob)):
        print(f"  {key}\n    react {json.dumps(oa.get(key))[:160]}\n    qt    {json.dumps(ob.get(key))[:160]}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "-v"]
    main(Path(args[0]), Path(args[1]), "-v" in sys.argv)
