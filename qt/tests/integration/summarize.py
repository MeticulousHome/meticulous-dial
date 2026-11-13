#!/usr/bin/env python3
"""One line per journey of a run: outcome, the failing check (as the test writes it, where, what it
gave) and the screenshots. Writes <artifacts>/results.md and prints it.

    python3 summarize.py qt/build/integration-artifacts/<run>
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def main(artifacts: Path):
    reports = {}
    for path in sorted((artifacts / "reports").glob("*.json")):
        report = json.loads(path.read_text())
        reports[report["test"].split("::")[-1]] = report
    rows = []
    junit = artifacts / "junit.xml"
    cases = ET.parse(junit).getroot().iter("testcase") if junit.exists() else []
    for case in cases:
        name = case.get("name")
        file = (case.get("classname") or "").split(".")[-1] + ".py"
        outcome = "passed"
        message = ""
        for child in case:
            if child.tag in ("failure", "error"):
                outcome = "failed" if child.tag == "failure" else "error"
                message = (child.get("message") or "").strip()
            elif child.tag == "skipped":
                outcome = "xfailed" if child.get("type") == "pytest.xfail" else "skipped"
                message = (child.get("message") or "").strip()
        report = reports.get(name, {})
        if report.get("outcome") in ("xfailed", "xpassed"):
            outcome = report["outcome"]
        check = report.get("failed_check") or {}
        if check:
            message = f"`{check['check']}` ({check['where']}): {check['got'].splitlines()[0][:300]}"
        shots = [s for s in report.get("screens", [])]
        rows.append((file, name, outcome, message.replace("|", "\\|").replace("\n", " ")[:400], shots,
                     float(case.get("time") or 0)))
    lines = ["| journey file | test | outcome | failing step | screenshots | s |", "|---|---|---|---|---|---|"]
    for file, name, outcome, message, shots, seconds in rows:
        lines.append(f"| {file} | {name} | {outcome} | {message} | {'<br>'.join(shots)} | {seconds:.0f} |")
    counts = {}
    for row in rows:
        counts[row[2]] = counts.get(row[2], 0) + 1
    lines.append("")
    lines.append(", ".join(f"{n} {k}" for k, n in sorted(counts.items())))
    text = "\n".join(lines) + "\n"
    (artifacts / "results.md").write_text(text)
    print(text)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
