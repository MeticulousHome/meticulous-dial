#!/bin/bash
# Stops the development Qt Dial (deploy-dev.sh) and starts the machine's installed Dial again.
#   qt/scripts/dev-off.sh [HOST]
set -euo pipefail
host="${1:-10.10.0.130}"
ssh -o BatchMode=yes "root@$host" "bash -s" <<'REMOTE'
systemctl stop dial-qt-dev.service 2>/dev/null
systemctl reset-failed dial-qt-dev.service 2>/dev/null
systemctl start meticulous-dial.service
systemctl is-active meticulous-dial.service
REMOTE
