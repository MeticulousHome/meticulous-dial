"""The end-to-end run as one HTML page, written when pytest finishes (conftest.py calls it):
qt/build/e2e-report/report.html (DIAL_E2E_REPORT=<dir> elsewhere, DIAL_E2E_REPORT=0 for none).

For each test: what it protects (its docstring), the outcome, the time, why it failed, its video (video.py,
recorded from the Xvfb screen while the test ran) and the screenshots the fixtures took (qt/build/e2e-artifacts,
both linked next to the page so the folder opens on its own). Grouped by file, in run order. Nothing but the
standard library.
"""

import html
import os
import shutil
import time
from pathlib import Path
from urllib.parse import quote

from dial import ARTIFACTS

_results: dict[str, dict] = {}
_started = time.time()

_ORDER = ["failed", "error", "xpassed", "passed", "xfailed", "skipped"]
_LABEL = {"passed": "passed", "failed": "failed", "error": "error", "skipped": "skipped",
          "xfailed": "expected failure", "xpassed": "unexpectedly passed"}


def report_dir() -> Path | None:
    value = os.environ.get("DIAL_E2E_REPORT", "")
    if value == "0":
        return None
    return Path(value) if value else ARTIFACTS.parent / "e2e-report"


def record(item, rep):
    """Called for each phase's report (setup, call, teardown)."""
    entry = _results.setdefault(item.nodeid, {
        "file": item.nodeid.split("::")[0], "name": item.name, "outcome": "passed", "duration": 0.0,
        "doc": (getattr(item, "function", None).__doc__ or "").strip() if getattr(item, "function", None) else "",
        "details": "", "reason": "", "video": None,
    })
    entry["duration"] += rep.duration
    xfail = hasattr(rep, "wasxfail")
    if rep.when == "call":
        if xfail:
            entry["outcome"] = "xfailed" if rep.skipped else "xpassed"
            entry["reason"] = rep.wasxfail
        elif rep.failed:
            entry["outcome"] = "failed"
        elif rep.skipped:
            entry["outcome"] = "skipped"
    elif rep.skipped:
        entry["outcome"] = "xfailed" if xfail else "skipped"
        entry["reason"] = rep.wasxfail if xfail else (rep.longrepr[2] if isinstance(rep.longrepr, tuple) else str(rep.longrepr))
    elif rep.failed:
        entry["outcome"] = "error"
    if rep.failed:
        entry["details"] += (f"--- {rep.when}\n" if rep.when != "call" else "") + rep.longreprtext + "\n"


def attach_video(item, path):
    """The test's video (conftest.py's screen fixture), shown with its result."""
    if path is None:
        return
    entry = _results.get(item.nodeid)
    if entry is None:
        entry = _results.setdefault(item.nodeid, {
            "file": item.nodeid.split("::")[0], "name": item.name, "outcome": "passed", "duration": 0.0,
            "doc": (item.function.__doc__ or "").strip() if getattr(item, "function", None) else "",
            "details": "", "reason": "", "video": None})
    entry["video"] = Path(path)


def _link(source: Path, target: Path):
    """`source` at `target`: a hard link (same disk, no copy) or a copy."""
    target.parent.mkdir(parents=True, exist_ok=True)
    target.unlink(missing_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def _video(entry, out: Path) -> str | None:
    source = entry.get("video")
    if not source or not Path(source).exists():
        return None
    _link(Path(source), out / "videos" / Path(source).name)
    return "videos/" + quote(Path(source).name)


def _shots(name: str, out: Path) -> list[str]:
    found = []
    if not ARTIFACTS.is_dir():
        return found
    for path in sorted(ARTIFACTS.glob(f"{name}-*.png")):
        if path.stat().st_mtime < _started:
            continue
        _link(path, out / "screens" / path.name)
        found.append("screens/" + quote(path.name))
    return found


def write(exitstatus: int):
    out = report_dir()
    if out is None or not _results:
        return None
    out.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(out / "screens", ignore_errors=True)
    shutil.rmtree(out / "videos", ignore_errors=True)
    totals = {k: 0 for k in _ORDER}
    for entry in _results.values():
        totals[entry["outcome"]] += 1
    files: dict[str, list[dict]] = {}
    for entry in _results.values():
        files.setdefault(entry["file"], []).append(entry)

    def row(entry):
        shots = _shots(entry["name"], out)
        clip = _video(entry, out)
        parts = [f'<details class="test {entry["outcome"]}"{" open" if entry["outcome"] in ("failed", "error") else ""}>',
                 f'<summary><span class="badge">{_LABEL[entry["outcome"]]}</span>'
                 f'<span class="name">{html.escape(entry["name"])}</span>'
                 f'<span class="time">{entry["duration"]:.1f} s</span></summary>']
        if entry["doc"]:
            parts.append(f'<p class="doc">{html.escape(entry["doc"])}</p>')
        if entry["reason"]:
            parts.append(f'<p class="reason">{html.escape(str(entry["reason"]))}</p>')
        if entry["details"]:
            parts.append(f'<pre>{html.escape(entry["details"][-6000:])}</pre>')
        if clip or shots:
            media = []
            if clip:
                media.append(f'<video controls muted playsinline preload="metadata" src="{html.escape(clip)}"></video>')
            parts.append('<div class="shots">' + "".join(media) + "".join(
                f'<a href="{html.escape(s)}"><img src="{html.escape(s)}" alt="{html.escape(s)}" loading="lazy"></a>'
                for s in shots) + "</div>")
        parts.append("</details>")
        return "".join(parts)

    sections = []
    for name, entries in files.items():
        counts = {k: sum(1 for e in entries if e["outcome"] == k) for k in _ORDER}
        summary = ", ".join(f"{v} {_LABEL[k]}" for k, v in counts.items() if v)
        sections.append(f'<section><h2>{html.escape(name)}</h2><p class="counts">{summary}</p>'
                        + "".join(row(e) for e in entries) + "</section>")
    stamp = time.strftime("%Y-%m-%d %H:%M %Z", time.localtime(_started))
    took = time.time() - _started
    headline = ", ".join(f'<b class="{k}">{v} {_LABEL[k]}</b>' for k, v in totals.items() if v)
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qt Dial end-to-end</title>
<style>
:root {{ --bg:#fafaf7; --fg:#1d1d1b; --muted:#6b6b66; --card:#fff; --line:#e3e1da;
        --pass:#2f7d32; --fail:#b3261e; --skip:#8a6d00; --xfail:#5b5bb0; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#141413; --fg:#ecebe6; --muted:#a3a29b; --card:#1e1e1c;
        --line:#33332f; --pass:#7bc67e; --fail:#f2817a; --skip:#e0c45c; --xfail:#a4a4f0; }} }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; margin:0; padding:24px 16px; }}
main {{ max-width:980px; margin:0 auto; }}
h1 {{ font-size:22px; margin:0 0 4px; }} h2 {{ font-size:16px; margin:28px 0 4px; font-family:ui-monospace, monospace; }}
.meta, .counts {{ color:var(--muted); margin:0 0 8px; }}
.headline b {{ margin-right:12px; }} .passed {{ color:var(--pass); }} .failed, .error {{ color:var(--fail); }}
.skipped {{ color:var(--skip); }} .xfailed, .xpassed {{ color:var(--xfail); }}
details.test {{ background:var(--card); border:1px solid var(--line); border-radius:8px; margin:6px 0; padding:8px 12px; color:var(--fg); }}
summary {{ cursor:pointer; display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }}
.badge {{ font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; min-width:120px; }}
details.passed .badge {{ color:var(--pass); }} details.failed .badge, details.error .badge {{ color:var(--fail); }}
details.skipped .badge {{ color:var(--skip); }} details.xfailed .badge, details.xpassed .badge {{ color:var(--xfail); }}
.name {{ font-family:ui-monospace, monospace; font-size:13px; flex:1; overflow-wrap:anywhere; }}
.time {{ color:var(--muted); font-size:13px; }}
.doc, .reason {{ white-space:pre-wrap; margin:8px 0; }} .reason {{ color:var(--muted); }}
pre {{ background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:8px; overflow:auto; font-size:12px; max-height:360px; }}
.shots {{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }} .shots img {{ width:180px; height:180px; border-radius:50%; background:#000; }}
.shots video {{ width:min(360px, 100%); aspect-ratio:1; border-radius:50%; background:#000; }}
</style></head><body><main>
<h1>Qt Dial end-to-end</h1>
<p class="meta">{stamp} · {took / 60:.1f} min · pytest exit status {exitstatus} · the Qt Dial against meticulous-backend in
emulation mode, real services blocked (docs/qt-migration/TESTING.md)</p>
<p class="headline">{headline}</p>
{"".join(sections)}
</main></body></html>
"""
    (out / "report.html").write_text(page, encoding="utf-8")
    return out / "report.html"
