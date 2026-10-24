#!/bin/bash
# Profiles the Qt Dial on the machine with qmlprofiler while the frame meter plays a scenario, and lists
# the QML/JS work that took the longest. Runs ON the machine; needs the build with -DDIAL_QML_DEBUG=ON
# copied to $DIAL/bin/meticulous-dial-qt-qmldebug (never shipped).
#   bash qmlprofile.sh SCENARIO [REPS]
set -euo pipefail
DIAL=/meticulous-user/dial-qt
scenario="$1"
reps="${2:-2}"
systemctl stop dial-qt-dev.service 2>/dev/null || true
systemctl reset-failed dial-qt-dev.service 2>/dev/null || true
systemd-run --unit=dial-qt-dev --description="Qt Dial (QML profiling)" \
    -E DIAL_QT_PREFIX=$DIAL -E DIAL_TEST_PORT=9310 \
    bash -c "source <(sed -n '/^export/p' $DIAL/bin/meticulous-dial-qt-launch | sed 's#\$prefix#$DIAL#g'); \
             exec $DIAL/bin/meticulous-dial-qt-qmldebug -qmljsdebugger=port:3768 --qml-dir $DIAL/share/meticulous-dial-qt/qml" \
    </dev/null >/dev/null 2>&1
sleep 14
secs=$(( reps * 12 + 6 ))
( sleep "$secs"; echo q ) | /usr/lib/qt6/bin/qmlprofiler --attach 127.0.0.1 --port 3768 -o /tmp/dial.qtd >/tmp/qmlprofiler.log 2>&1 &
sleep 3
python3 $DIAL/flipsrun.py "$scenario" --reps "$reps" > /tmp/qmlprofile-run.jsonl
wait
python3 - <<'EOF'
import json, xml.etree.ElementTree as ET
runs = [json.loads(l) for l in open("/tmp/qmlprofile-run.jsonl")]
for r in runs:
    print("run", r["fps_motion"], r["hitches_ge3"], [(h["at_ms"], h["ms"]) for h in r["hitches"]])
root = ET.parse("/tmp/dial.qtd").getroot()
types = {}
for ev in root.iter("event"):
    idx = ev.get("index")
    d = {c.tag: (c.text or "") for c in ev}
    types[idx] = d
ranges = []
for r in root.iter("range"):
    dur = int(r.get("duration", 0))
    if dur > 8_000_000:
        t = types.get(r.get("eventIndex"), {})
        ranges.append((dur / 1e6, int(r.get("startTime")) / 1e9, t.get("rangeType", ""), t.get("details", "")[:90], t.get("filename", "").split("/")[-1], t.get("line", "")))
ranges.sort(reverse=True)
print(len(ranges), "ranges over 8 ms")
for dur, start, kind, details, f, line in ranges[:40]:
    print(f"{dur:7.1f} ms  t={start:8.3f}  {kind:16s} {f}:{line} {details}")
EOF
