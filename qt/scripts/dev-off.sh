#!/bin/bash
# Stops the development Qt Dial (deploy-dev.sh) and brings back the machine's configured Dial: the packaged
# Qt Dial when dial-switch says qt, otherwise Weston and the WebKit Dial.
#   qt/scripts/dev-off.sh [HOST]
set -euo pipefail
host="${1:-10.10.0.130}"
ssh -o BatchMode=yes "root@$host" "bash -s" <<'REMOTE'
systemctl stop dial-qt-dev.service 2>/dev/null
systemctl reset-failed dial-qt-dev.service 2>/dev/null
if [ -f /etc/systemd/system/meticulous-dial.service ]; then
    systemctl start meticulous-dial.service
    systemctl is-active meticulous-dial.service
else
    systemctl start weston.service
    sleep 3
    systemctl start meticulous-dial.service
    systemctl is-active weston.service meticulous-dial.service
fi
REMOTE
