#!/bin/bash
# Stops the development Qt Dial (deploy-dev.sh) and brings back Weston and the WebKit Dial.
#   qt/scripts/dev-off.sh [HOST]
set -euo pipefail
host="${1:-10.10.0.130}"
ssh -o BatchMode=yes "root@$host" "bash -s" <<'EOF'
systemctl stop dial-qt-dev.service 2>/dev/null
systemctl reset-failed dial-qt-dev.service 2>/dev/null
systemctl start weston.service
sleep 3
systemctl start meticulous-dial.service
systemctl is-active weston.service meticulous-dial.service
EOF
