#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/PACKAGE.conf"
LAST_BACKUP_FILE="${SCRIPT_DIR}/.last-dial-build-backup"
REMOTE_BACKUP_ROOT="/opt/meticulous-firmware/backups"
CONTROL_PATH="/tmp/md-dial-rollback-%C"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

config_value() {
  sed -n "s/^$1=//p" "${CONFIG_FILE}"
}

test -s "${CONFIG_FILE}" || fail "Missing PACKAGE.conf"
test -s "${SCRIPT_DIR}/SHA256SUMS" || fail "Missing SHA256SUMS"
(
  cd "${SCRIPT_DIR}"
  shasum -a 256 -c SHA256SUMS
)

PACKAGE_NAME="$(config_value PACKAGE_NAME)"
BUILD_ID="$(config_value BUILD_ID)"
DEFAULT_TARGET="$(config_value DEFAULT_TARGET)"
PACKAGE_EXPECTED_SERIAL="$(config_value PACKAGE_EXPECTED_SERIAL)"
PACKAGE_EXPECTED_FIRMWARE="$(config_value PACKAGE_EXPECTED_FIRMWARE)"
case "${PACKAGE_NAME}" in *[!a-z0-9._-]*|'') fail "Invalid package name" ;; esac
case "${BUILD_ID}" in *[!a-z0-9._-]*|'') fail "Invalid build ID" ;; esac

TARGET="${TARGET:-${DEFAULT_TARGET}}"
EXPECTED_SERIAL="${EXPECTED_SERIAL:-${PACKAGE_EXPECTED_SERIAL}}"
EXPECTED_FIRMWARE="${EXPECTED_FIRMWARE:-${PACKAGE_EXPECTED_FIRMWARE}}"
LOCAL_BACKUP_ROOT="${LOCAL_BACKUP_ROOT:-/Users/royraanani/MeticulousBackups}"

test -s "${LAST_BACKUP_FILE}" || fail "No completed backup record was found for this package"
BACKUP_NAME="$(sed -n '1p' "${LAST_BACKUP_FILE}")"
REMOTE_BACKUP_DIR="$(sed -n '2p' "${LAST_BACKUP_FILE}")"
LOCAL_BACKUP_DIR="$(sed -n '3p' "${LAST_BACKUP_FILE}")"
PREVIOUS_DIAL_SHA256="$(sed -n '4p' "${LAST_BACKUP_FILE}")"
PACKAGE_DIAL_SHA256="$(sed -n '5p' "${LAST_BACKUP_FILE}")"
RECORDED_BUILD_ID="$(sed -n '6p' "${LAST_BACKUP_FILE}")"

case "${BACKUP_NAME}" in "dial-pre-${PACKAGE_NAME}-"*) ;; *) fail "Unexpected backup name" ;; esac
test "${REMOTE_BACKUP_DIR}" = "${REMOTE_BACKUP_ROOT}/${BACKUP_NAME}" || fail "Unexpected remote backup path"
test "${LOCAL_BACKUP_DIR}" = "${LOCAL_BACKUP_ROOT}/${BACKUP_NAME}" || fail "Unexpected local backup path"
test "${RECORDED_BUILD_ID}" = "${BUILD_ID}" || fail "Backup belongs to a different build"
case "${PREVIOUS_DIAL_SHA256}" in *[!0-9a-f]*|'') fail "Invalid previous-Dial checksum" ;; esac
case "${PACKAGE_DIAL_SHA256}" in *[!0-9a-f]*|'') fail "Invalid package-Dial checksum" ;; esac
test "${#PREVIOUS_DIAL_SHA256}" -eq 64 || fail "Previous-Dial checksum has an unexpected length"
test "${#PACKAGE_DIAL_SHA256}" -eq 64 || fail "Package-Dial checksum has an unexpected length"

echo "Verifying the saved Dial backup on this Mac..."
test -d "${LOCAL_BACKUP_DIR}" || fail "Local Dial backup is missing: ${LOCAL_BACKUP_DIR}"
(
  cd "${LOCAL_BACKUP_DIR}"
  shasum -a 256 -c SHA256SUMS
)
LOCAL_PREVIOUS_SHA="$(shasum -a 256 "${LOCAL_BACKUP_DIR}/meticulous-dial" | awk '{print $1}')"
test "${LOCAL_PREVIOUS_SHA}" = "${PREVIOUS_DIAL_SHA256}" || fail "Local previous-Dial checksum is incorrect"

SSH_OPTIONS=(
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=accept-new
  -o ControlMaster=auto
  -o ControlPersist=600
  -o ControlPath="${CONTROL_PATH}"
)

close_connection() {
  ssh "${SSH_OPTIONS[@]}" -O exit "${TARGET}" >/dev/null 2>&1 || true
}
trap close_connection EXIT

echo "Connecting to ${TARGET}. Enter the SSH root password when prompted."
if ! ssh "${SSH_OPTIONS[@]}" "${TARGET}" test -d "${REMOTE_BACKUP_DIR}"; then
  echo "Remote backup is missing; restoring the verified Mac copy first..."
  scp "${SSH_OPTIONS[@]}" -r "${LOCAL_BACKUP_DIR}" "${TARGET}:${REMOTE_BACKUP_ROOT}/"
fi

ssh "${SSH_OPTIONS[@]}" "${TARGET}" sh -s -- \
  "${EXPECTED_SERIAL}" \
  "${EXPECTED_FIRMWARE}" \
  "${REMOTE_BACKUP_DIR}" \
  "${PREVIOUS_DIAL_SHA256}" \
  "${PACKAGE_DIAL_SHA256}" <<'REMOTE_PREFLIGHT'
set -eu
expected_serial="$1"
expected_firmware="$2"
backup_dir="$3"
previous_sha="$4"
package_sha="$5"

cd "$backup_dir"
sha256sum -c SHA256SUMS
test "$(sha256sum meticulous-dial | awk '{print $1}')" = "$previous_sha"
machine_json="$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/machine)"
case "$machine_json" in *"\"serial\": \"$expected_serial\""*|*"\"serial\":\"$expected_serial\""*) ;; *) echo "ERROR: Wrong machine identity" >&2; exit 1 ;; esac
case "$machine_json" in *"\"firmware\": \"$expected_firmware\""*|*"\"firmware\":\"$expected_firmware\""*) ;; *) echo "ERROR: Firmware changed" >&2; exit 1 ;; esac
test "$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/history/current | tr -d '[:space:]')" = "null" || { echo "ERROR: The machine reports an active shot" >&2; exit 1; }
systemctl is-active --quiet meticulous-backend.service
systemctl is-active --quiet meticulous-dial.service
test "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$package_sha" || { echo "ERROR: Installed Dial is not this package build" >&2; exit 1; }
REMOTE_PREFLIGHT

echo
echo "READY TO ROLLBACK DIAL BUILD"
echo "This restores only the exact Dial binary saved immediately before ${BUILD_ID}."
read -r -p "Type ROLLBACK_DIAL_BUILD ${EXPECTED_SERIAL} to begin: " CONFIRMATION
if [ "${CONFIRMATION}" != "ROLLBACK_DIAL_BUILD ${EXPECTED_SERIAL}" ]; then
  echo "Rollback cancelled."
  exit 0
fi

ssh "${SSH_OPTIONS[@]}" "${TARGET}" sh -s -- \
  "${REMOTE_BACKUP_DIR}" \
  "${PREVIOUS_DIAL_SHA256}" \
  "${PACKAGE_DIAL_SHA256}" <<'REMOTE_ROLLBACK'
set -eu
backup_dir="$1"
previous_sha="$2"
package_sha="$3"

restore_package_dial() {
  code="$?"
  trap - EXIT HUP INT TERM
  set +e
  echo "Rollback verification failed; restoring the package Dial..." >&2
  systemctl stop meticulous-dial.service
  install -m 755 "$backup_dir/dial-before-package-rollback" /usr/bin/meticulous-dial.restore
  mv -f /usr/bin/meticulous-dial.restore /usr/bin/meticulous-dial
  rm -f /run/meticulous-dial-ready /run/meticulous-dial-home-ready
  systemctl start meticulous-dial.service
  restored=false
  attempt=1
  while [ "$attempt" -le 90 ]; do
    if systemctl is-active --quiet meticulous-dial.service && test -s /run/meticulous-dial-ready; then
      restored=true
      break
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  if [ "$restored" = true ] && [ "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$package_sha" ]; then
    echo "Package Dial restored and verified." >&2
  else
    echo "ERROR: Automatic restoration of the package Dial could not be verified. Do not start a brew." >&2
    journalctl -u meticulous-dial.service -n 100 --no-pager >&2
  fi
  exit "$code"
}

cd "$backup_dir"
sha256sum -c SHA256SUMS
test "$(sha256sum meticulous-dial | awk '{print $1}')" = "$previous_sha"
test "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$package_sha"
test "$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/history/current | tr -d '[:space:]')" = "null"
curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ > "$backup_dir/settings-before-package-rollback.json"
cp -p /usr/bin/meticulous-dial "$backup_dir/dial-before-package-rollback"
test "$(sha256sum "$backup_dir/dial-before-package-rollback" | awk '{print $1}')" = "$package_sha"

trap restore_package_dial EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

rm -f /run/meticulous-dial-ready /run/meticulous-dial-home-ready
systemctl stop meticulous-dial.service
install -m 755 "$backup_dir/meticulous-dial" /usr/bin/meticulous-dial.previous
test "$(sha256sum /usr/bin/meticulous-dial.previous | awk '{print $1}')" = "$previous_sha"
mv -f /usr/bin/meticulous-dial.previous /usr/bin/meticulous-dial
sync
systemctl start meticulous-dial.service

dial_ready=false
attempt=1
while [ "$attempt" -le 90 ]; do
  if systemctl is-active --quiet meticulous-dial.service && test -s /run/meticulous-dial-ready; then
    dial_ready=true
    break
  fi
  sleep 1
  attempt=$((attempt + 1))
done

test "$dial_ready" = true || { journalctl -u meticulous-dial.service -n 100 --no-pager >&2; exit 1; }
test "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$previous_sha"
systemctl is-active --quiet meticulous-backend.service
curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ > "$backup_dir/settings-after-package-rollback.json"
cmp -s "$backup_dir/settings-before-package-rollback.json" "$backup_dir/settings-after-package-rollback.json" || { echo "ERROR: Settings changed during rollback" >&2; exit 1; }

trap - EXIT HUP INT TERM
echo "Previous Dial restored and verified"
REMOTE_ROLLBACK

echo
echo "DIAL BUILD ROLLBACK VERIFIED"
echo "Only the saved Dial binary was restored, and only meticulous-dial.service was restarted."
echo "Firmware, backend, database, and machine settings were left unchanged."

