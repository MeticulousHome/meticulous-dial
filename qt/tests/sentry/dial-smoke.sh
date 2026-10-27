#!/bin/bash
# The real Dial binary with Sentry, against a local fake Sentry that also answers /api/v1/machine
# (fake_sentry.py), in the bookworm image with no network at all (--network none): main.cpp starts Sentry from
# the environment, a QML console.error from the test port arrives as an event with the tags Device.qml sets
# from the device info, a still Dial (settings) stays near 0 % CPU, a 6 s GUI stall during an animation is
# reported as "Dial UI sustained slowdown" (the whole slowdown chain), a stop exits 0; and
# without DIAL_EXTERNAL_SERVICES / a local DIAL_SENTRY_DSN nothing is initialised and nothing is written.
#   qt/tests/sentry/dial-smoke.sh [build dir]     # an amd64 build with Sentry, default qt/build/amd64
set -euo pipefail
here="$(cd "$(dirname "$0")/../.." && pwd)"
repo="$(cd "$here/.." && pwd)"

if [ "${1:-}" != --inner ]; then
    build="$(cd "${1:-$here/build/amd64}" && pwd)"
    exec docker run --rm --network none -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$repo:/repo" -w /repo/qt \
        qt-dial-bookworm bash /repo/qt/tests/sentry/dial-smoke.sh --inner "/repo/${build#"$repo"/}"
fi

bin="$2/meticulous-dial-qt"
port=18765
dsn="http://0123456789abcdef0123456789abcdef@127.0.0.1:$port/8"
out=/tmp/fake-sentry
python3 /repo/qt/tests/sentry/fake_sentry.py --port "$port" --out "$out" --machine &
Xvfb :77 -screen 0 480x480x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
sleep 1
export DISPLAY=:77 QT_QPA_PLATFORM=xcb LIBGL_ALWAYS_SOFTWARE=1 QSG_RENDER_LOOP=basic
ctl() { python3 /repo/qt/tests/e2e/dialctl.py --port 9399 "$@"; }
evaljs() { ctl eval "$1" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("value"))'; }
fail() { echo "FAIL: $*"; echo "---- dial log"; tail -40 "$log"; exit 1; }
start_dial() {   # log file, then VAR=value...
    log="$1"; shift
    env -u DIAL_EXTERNAL_SERVICES -u DIAL_SENTRY_DSN "$@" "$bin" --qml-dir /repo/qt/qml --storage /tmp/storage.json \
        --api "http://127.0.0.1:$port" --test-port 9399 --screen "${SCREEN:-settings}" >"$log" 2>&1 &
    pid=$!
    for _ in $(seq 60); do ctl state >/dev/null 2>&1 && return 0; sleep 0.5; done
    fail "the Dial did not open its test port"
}
cpu_ticks() { awk '{print $14 + $15}' "/proc/$pid/stat"; }
stop_dial() {
    kill -TERM "$pid"
    local code=0
    wait "$pid" || code=$?
    [ "$code" = 0 ] || fail "the Dial exited with $code on SIGTERM"
}
envelopes() { [ -f "$out/envelopes.jsonl" ] && wc -l <"$out/envelopes.jsonl" || echo 0; }

echo "== Sentry on (local DIAL_SENTRY_DSN)"
start_dial /tmp/dial-on.log DIAL_SENTRY_DSN="$dsn" DIAL_SENTRY_DATABASE=/tmp/sentry-db
grep -q "sentry: on, reporting to 127.0.0.1 (DIAL_SENTRY_DSN)" /tmp/dial-on.log || fail "no 'sentry: on' line"
[ "$(evaljs 'Sentry.enabled + "," + SlowdownMonitor.running')" = "true,true" ] || fail "Sentry / SlowdownMonitor not running"
for _ in $(seq 40); do
    [ "$(evaljs 'Device.info ? String(Device.info.serial) : ""')" = SMOKE-0001 ] && break
    sleep 0.5
done
[ "$(evaljs 'Device.info ? String(Device.info.serial) : ""')" = SMOKE-0001 ] || fail "no device info"
evaljs 'console.warn("smoke: a warning first"); console.error("smoke: an error from Smoke Test Kitchen, password=hunter2"); "ok"' >/dev/null
# A still Dial: no frames, so no frame monitor timer either.
sleep 3
t0=$(cpu_ticks); sleep 10; t1=$(cpu_ticks)
cpu=$(python3 -c "import os; print(round(($t1 - $t0) * 100 / os.sysconf('SC_CLK_TCK') / 10, 1))")
echo "CPU of a still Dial with Sentry and the slowdown monitor on: ${cpu} % of one core (10 s, Xvfb + llvmpipe)"
stop_dial
python3 - "$out/envelopes.jsonl" <<'EOF'
import json, sys
records = [json.loads(l) for l in open(sys.argv[1])]
events = [i["event"] for r in records for i in r["items"] if i["header"].get("type") == "event"]
def message(e):
    m = e.get("message")
    return m.get("formatted", "") if isinstance(m, dict) else (m or "")
mine = [e for e in events if message(e).startswith("smoke: an error")]
assert len(mine) == 1, [message(e) for e in events]
e = mine[0]
assert message(e) == "smoke: an error from [machine], password=[Filtered]", message(e)
tags = e.get("tags", {})
want = {"serial": "SMOKE-0001", "build-version": "2026.10.24-smoke", "build-channel": "smoke",
        "dial-version": "0.1.0", "dial-runtime": "qt", "log-source": "qml"}
for k, v in want.items():
    assert tags.get(k) == v, (k, tags.get(k))
assert e["release"] == "meticulous-dial-qt@0.1.0", e["release"]
dist = e.get("dist", "(none: built outside a git checkout)")
assert "user" not in e
crumbs = e.get("breadcrumbs") or []
crumbs = crumbs.get("values", []) if isinstance(crumbs, dict) else crumbs
assert any(c.get("message") == "smoke: a warning first" for c in crumbs), crumbs
raw = open(sys.argv[1]).read()
for secret in ("hunter2", "Smoke Test Kitchen", "smoke-kitchen"):
    assert secret not in raw, secret
print(f"ok: {len(events)} event(s) received, the smoke error with tags {sorted(want)}, release {e['release']}, dist {dist}")
print("   other events (the fake backend answers 404 to the rest):", sorted({message(x)[:60] for x in events if x is not e})[:6])
EOF

echo "== The slowdown monitor: a 6 s GUI stall while the Dial animates (the ready screen), after the 30 s warm-up"
before=$(envelopes)
SCREEN=ready start_dial /tmp/dial-slow.log DIAL_SENTRY_DSN="$dsn" DIAL_SENTRY_DATABASE=/tmp/sentry-db-slow \
    DIAL_PERFORMANCE_DEBUG=1
[ "$(evaljs 'Nav.screen')" = ready ] || fail "not on the ready screen"
sleep 34
evaljs 'var t0 = Date.now(); while (Date.now() - t0 < 6000) {} "stalled"' >/dev/null
sleep 8
stop_dial
grep -q "Dial performance sample" /tmp/dial-slow.log || fail "no performance sample logged (no frame window closed)"
grep "Dial performance sample" /tmp/dial-slow.log | head -3 | sed 's/^/   /' | cut -c1-200
python3 - "$out/envelopes.jsonl" "$before" <<'EOF'
import json, sys
records = [json.loads(l) for l in open(sys.argv[1])][int(sys.argv[2]):]
events = [i["event"] for r in records for i in r["items"] if i["header"].get("type") == "event"]
def message(e):
    m = e.get("message")
    return m.get("formatted", "") if isinstance(m, dict) else (m or "")
slow = [e for e in events if message(e) == "Dial UI sustained slowdown"]
assert len(slow) == 1, [message(e) for e in events]
e = slow[0]
tags, ctx = e["tags"], e["contexts"]
assert e["level"] == "warning" and e["fingerprint"] == ["dial-ui-sustained-slowdown"], (e["level"], e.get("fingerprint"))
assert tags["slowdown-report-kind"] == "immediate", tags
assert tags["performance-detector-version"] == "4" and tags["screen"] == "ready" and tags["is-extracting"] == "false", tags
assert tags["machine-serial"] == "SMOKE-0001" and tags["serial"] == "SMOKE-0001", tags
perf = ctx["dial_performance"]
assert perf["max_frame_gap_ms"] >= 5000 and perf["max_timer_heartbeat_delay_ms"] >= 1000, perf
assert "memory_current_mb" in ctx.get("dial_resources", {}), ctx.get("dial_resources")
print("ok: 'Dial UI sustained slowdown' (immediate):", json.dumps(perf))
print("   dial_resources:", json.dumps(ctx["dial_resources"]))
EOF

echo "== Sentry off (no DIAL_EXTERNAL_SERVICES, no DIAL_SENTRY_DSN)"
before=$(envelopes)
start_dial /tmp/dial-off.log XDG_CACHE_HOME=/tmp/cache-off
grep -q "sentry: off (external services are off)" /tmp/dial-off.log || fail "no 'sentry: off' line"
[ "$(evaljs 'Sentry.enabled + "," + SlowdownMonitor.running')" = "false,false" ] || fail "Sentry on without the switch"
evaljs 'console.error("smoke: an error while Sentry is off"); "ok"' >/dev/null
sleep 2
stop_dial
[ "$(envelopes)" = "$before" ] || fail "something was sent with Sentry off"
[ ! -e /tmp/cache-off/meticulous-dial-qt/sentry ] || fail "a Sentry database was created with Sentry off"
grep -q "smoke: an error while Sentry is off" /tmp/dial-off.log || fail "the journal output changed"
echo "ok: off, nothing initialised, nothing sent, nothing written"
echo PASS
