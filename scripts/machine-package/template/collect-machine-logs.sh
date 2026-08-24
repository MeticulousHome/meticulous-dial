#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_OVERRIDE="${TARGET:-}"
TARGET="root@192.168.10.142"
SINCE="${SINCE:-30 minutes ago}"
OUTPUT_DIR="${1:-${SCRIPT_DIR}/machine-logs-$(date -u +%Y%m%dT%H%M%SZ)}"
CONTROL_PATH="/tmp/md-dial-logs-%C"
printf -v REMOTE_SINCE '%q' "${SINCE}"

if [ -s "${SCRIPT_DIR}/PACKAGE.conf" ]; then
  DEFAULT_TARGET="$(sed -n 's/^DEFAULT_TARGET=//p' "${SCRIPT_DIR}/PACKAGE.conf")"
  TARGET="${DEFAULT_TARGET:-${TARGET}}"
fi
TARGET="${TARGET_OVERRIDE:-${TARGET}}"

SSH_OPTIONS=(
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=accept-new
  -o ControlMaster=auto
  -o ControlPersist=120
  -o ControlPath="${CONTROL_PATH}"
)

close_connection() {
  ssh "${SSH_OPTIONS[@]}" -O exit "${TARGET}" >/dev/null 2>&1 || true
}
trap close_connection EXIT

mkdir -p "${OUTPUT_DIR}"
echo "Collecting Dial and backend logs from ${TARGET} since '${SINCE}'..."

ssh "${SSH_OPTIONS[@]}" "${TARGET}" \
  "journalctl -u meticulous-dial.service --since ${REMOTE_SINCE} --no-pager -o short-iso-precise" \
  > "${OUTPUT_DIR}/meticulous-dial.log"
ssh "${SSH_OPTIONS[@]}" "${TARGET}" \
  "journalctl -u meticulous-backend.service --since ${REMOTE_SINCE} --no-pager -o short-iso-precise" \
  > "${OUTPUT_DIR}/meticulous-backend.log"
ssh "${SSH_OPTIONS[@]}" "${TARGET}" \
  "journalctl -u meticulous-dial.service -u meticulous-backend.service --since ${REMOTE_SINCE} --no-pager -o short-iso-precise" \
  > "${OUTPUT_DIR}/combined.log"
ssh "${SSH_OPTIONS[@]}" "${TARGET}" \
  "systemctl show meticulous-dial.service meticulous-backend.service --property=Id,ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestamp" \
  > "${OUTPUT_DIR}/service-status.txt"

echo "Logs saved to ${OUTPUT_DIR}"
