#!/bin/bash
# Development deploy of the Qt Dial to a test machine, without packaging:
#   qt/scripts/deploy-dev.sh [HOST] [--qml-only] [--no-start]
# copies build/arm64/meticulous-dial-qt and the QML tree to /meticulous-user/dial-qt (a prefix: bin/, share/)
# and runs it as the transient unit dial-qt-dev (the installed Dial stopped; nothing is enabled at boot, so a
# reboot brings the installed Dial back). qt/scripts/dev-off.sh HOST stops it and restarts the installed Dial.
# The test port listens on the machine's 127.0.0.1:9310 (ssh -L 9310:127.0.0.1:9310 root@HOST).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
host="${1:-10.10.0.130}"
shift || true
qml_only=0
start=1
for a in "$@"; do
    case "$a" in
    --qml-only) qml_only=1 ;;
    --no-start) start=0 ;;
    esac
done
dest=/meticulous-user/dial-qt

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/bin" "$stage/share/meticulous-dial-qt"
cp -rL "$here/qml" "$stage/share/meticulous-dial-qt/qml"
# Only the assets the QML uses: fonts, public images, our own icons and animations.
cp "$here/packaging/kms.json" "$stage/share/meticulous-dial-qt/"
cp "$here/packaging/meticulous-dial-qt.sh" "$stage/bin/meticulous-dial-qt-launch"
[ "$qml_only" = 1 ] || cp "$here/build/arm64/meticulous-dial-qt" "$stage/bin/"

ssh -o BatchMode=yes "root@$host" "mkdir -p $dest && rm -rf $dest/share/meticulous-dial-qt/qml"
tar -C "$stage" -czf - . | ssh -o BatchMode=yes "root@$host" "tar -xzf - -C $dest && chmod +x $dest/bin/*"
echo "deployed to $host:$dest"

[ "$start" = 1 ] || exit 0
ssh -o BatchMode=yes "root@$host" "bash -s" <<'EOF'
set -e
systemctl stop meticulous-dial.service weston.service qtproto.service 2>/dev/null || true
systemctl stop dial-qt-dev.service 2>/dev/null || true
systemctl reset-failed dial-qt-dev.service 2>/dev/null || true
systemd-run --unit=dial-qt-dev --description="Qt Dial (development)" -p Restart=on-failure \
    -E DIAL_QT_PREFIX=/meticulous-user/dial-qt -E DIAL_TEST_PORT=9310 -E DIAL_EXTERNAL_SERVICES=0 \
    /meticulous-user/dial-qt/bin/meticulous-dial-qt-launch </dev/null >/dev/null 2>&1
sleep 3
systemctl is-active dial-qt-dev.service
journalctl -u dial-qt-dev --since "-10s" --no-pager -o cat | tail -20
EOF
