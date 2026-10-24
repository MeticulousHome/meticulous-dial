#!/usr/bin/env python3
"""The same journeys on the React Dial and on the Qt Dial, side by side: outcome, the routes seen, the
focused menu entries read and the controls of each step (traces/, trace_plugin.py), and observations.

    python3 compare.py qt/build/integration-artifacts/<react run> qt/build/integration-artifacts/<qt run> [-v]

Without -v only what differs is printed. Focused entries are compared without case (the React fixture
reads the label as rendered, after CSS text-transform; the Qt one the label as written).
"""
import json
import re
import sys
from pathlib import Path

# The journeys name their profiles with random hex suffixes ("Espresso 7ee34f"), and the machine's name and
# hostname are random: compare without them.
_RANDOM = re.compile(r"\b(?=[0-9a-f]*\d)[0-9a-f]{3,12}\b|(name: )meticulous\w+|(hostname: )\w+", re.I)


def _plain(value):
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, str):
        return _RANDOM.sub(lambda m: (m.group(1) or m.group(2) or "") + "*", value)
    return value


def load(run: Path, name: str):
    report_path = run / "reports" / f"{name}.json"
    trace_path = run / "traces" / f"{name}.json"
    if not report_path.exists():
        return None
    report = json.loads(report_path.read_text())
    check = report.get("failed_check") or {}
    out = {"outcome": report["outcome"],
           "failed": f"{check.get('check', '')} -> {(check.get('got') or '').splitlines()[0] if check else ''}",
           "routes": [], "focus": [], "steps": [], "cards": []}
    if not trace_path.exists():
        return out
    step = None
    for kind, value in json.loads(trace_path.read_text()):
        value = _plain(value)
        if kind == "card" and value and (not out["cards"] or out["cards"][-1] != value):
            out["cards"].append(value)
        elif kind == "route" and value and (not out["routes"] or out["routes"][-1] != value):
            out["routes"].append(value)
        elif kind == "focus" and value is not None:
            label = str(value).casefold()
            if not out["focus"] or out["focus"][-1] != label:
                out["focus"].append(label)
        elif kind == "step":
            step = [value]
            out["steps"].append(step)
        elif kind == "control":
            if step is None:
                step = ["(start)"]
                out["steps"].append(step)
            step.append(value)
    out["steps"] = [" ".join(s) for s in out["steps"]]
    return out


def main(react: Path, qt: Path, verbose: bool):
    names = sorted({p.stem for p in (react / "reports").glob("*.json")} | {p.stem for p in (qt / "reports").glob("*.json")})
    for name in names:
        a, b = load(react, name), load(qt, name)
        print(f"{(a or {}).get('outcome', '-'):8s} {(b or {}).get('outcome', '-'):8s} {name}")
        if not a or not b:
            continue
        for key in ("routes", "focus", "cards", "steps"):
            if a[key] != b[key] or verbose:
                print(f"    {key}: react {a[key]}")
                print(f"    {' ' * len(key)}  qt    {b[key]}")
        for side, r in (("react", a), ("qt", b)):
            if r["outcome"] in ("failed", "error"):
                print(f"    {side} failed: {r['failed']}")
    oa = json.loads((react / "observations.json").read_text()) if (react / "observations.json").exists() else {}
    ob = json.loads((qt / "observations.json").read_text()) if (qt / "observations.json").exists() else {}
    print("\nobservations")
    for key in sorted(set(oa) | set(ob)):
        if oa.get(key) != ob.get(key) or verbose:
            print(f"  {key}\n    react {json.dumps(oa.get(key))[:200]}\n    qt    {json.dumps(ob.get(key))[:200]}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "-v"]
    main(Path(args[0]), Path(args[1]), "-v" in sys.argv)
