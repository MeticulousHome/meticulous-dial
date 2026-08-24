#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/PACKAGE.conf"
LAST_BACKUP_FILE="${SCRIPT_DIR}/.last-dial-build-backup"
REMOTE_BACKUP_ROOT="/opt/meticulous-firmware/backups"
CONTROL_PATH="/tmp/md-dial-install-%C"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

config_value() {
  sed -n "s/^$1=//p" "${CONFIG_FILE}"
}

test -s "${CONFIG_FILE}" || fail "Missing PACKAGE.conf"
test -s "${SCRIPT_DIR}/SHA256SUMS" || fail "Missing SHA256SUMS"

echo "Verifying every packaged file on this Mac..."
(
  cd "${SCRIPT_DIR}"
  shasum -a 256 -c SHA256SUMS
)

PACKAGE_NAME="$(config_value PACKAGE_NAME)"
BUILD_ID="$(config_value BUILD_ID)"
SOURCE_COMMIT="$(config_value SOURCE_COMMIT)"
ARTIFACT_RELATIVE="$(config_value ARTIFACT_RELATIVE)"
DEFAULT_TARGET="$(config_value DEFAULT_TARGET)"
PACKAGE_EXPECTED_SERIAL="$(config_value PACKAGE_EXPECTED_SERIAL)"
PACKAGE_EXPECTED_FIRMWARE="$(config_value PACKAGE_EXPECTED_FIRMWARE)"

case "${PACKAGE_NAME}" in *[!a-z0-9._-]*|'') fail "Invalid package name" ;; esac
case "${BUILD_ID}" in *[!a-z0-9._-]*|'') fail "Invalid build ID" ;; esac
case "${SOURCE_COMMIT}" in *[!0-9a-f]*|'') fail "Invalid source commit" ;; esac
test "${#SOURCE_COMMIT}" -eq 40 || fail "Source commit must be a full SHA"
case "${ARTIFACT_RELATIVE}" in artifacts/*) ;; *) fail "Invalid artifact path" ;; esac
case "${ARTIFACT_RELATIVE}" in *..*) fail "Artifact path may not contain '..'" ;; esac
case "${DEFAULT_TARGET}" in *[!A-Za-z0-9._@:-]*|'') fail "Invalid default target" ;; esac
case "${PACKAGE_EXPECTED_SERIAL}" in *[!A-Za-z0-9._-]*|'') fail "Invalid expected serial" ;; esac
case "${PACKAGE_EXPECTED_FIRMWARE}" in *[!A-Za-z0-9._+-]*|'') fail "Invalid expected firmware" ;; esac

ARTIFACT="${SCRIPT_DIR}/${ARTIFACT_RELATIVE}"
TARGET="${TARGET:-${DEFAULT_TARGET}}"
EXPECTED_SERIAL="${EXPECTED_SERIAL:-${PACKAGE_EXPECTED_SERIAL}}"
EXPECTED_FIRMWARE="${EXPECTED_FIRMWARE:-${PACKAGE_EXPECTED_FIRMWARE}}"
LOCAL_BACKUP_ROOT="${LOCAL_BACKUP_ROOT:-/Users/royraanani/MeticulousBackups}"
REMOTE_STAGING="${REMOTE_BACKUP_ROOT}/custom-builds/${BUILD_ID}"

test -s "${ARTIFACT}" || fail "Missing Dial artifact: ${ARTIFACT}"
file "${ARTIFACT}" | grep -q "ELF 64-bit" || fail "Dial artifact is not an ELF executable"
file "${ARTIFACT}" | grep -q "ARM aarch64" || fail "Dial artifact is not ARM64"
NEW_DIAL_SHA256="$(shasum -a 256 "${ARTIFACT}" | awk '{print $1}')"

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
echo "Checking machine identity, firmware, idle state, services, settings, and free space..."

ssh "${SSH_OPTIONS[@]}" "${TARGET}" sh -s -- \
  "${EXPECTED_SERIAL}" \
  "${EXPECTED_FIRMWARE}" <<'REMOTE_PREFLIGHT'
set -eu

expected_serial="$1"
expected_firmware="$2"
machine_json="$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/machine)"

case "$machine_json" in *"\"serial\": \"$expected_serial\""*|*"\"serial\":\"$expected_serial\""*) ;; *) echo "ERROR: Wrong machine identity" >&2; exit 1 ;; esac
case "$machine_json" in *"\"firmware\": \"$expected_firmware\""*|*"\"firmware\":\"$expected_firmware\""*) ;; *) echo "ERROR: Firmware changed; expected $expected_firmware" >&2; exit 1 ;; esac

current_shot="$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/history/current | tr -d '[:space:]')"
test "$current_shot" = "null" || { echo "ERROR: The machine reports an active shot" >&2; exit 1; }
systemctl is-active --quiet meticulous-backend.service || { echo "ERROR: Backend service is not active" >&2; exit 1; }
systemctl is-active --quiet meticulous-dial.service || { echo "ERROR: Dial service is not active" >&2; exit 1; }
test -x /usr/bin/meticulous-dial || { echo "ERROR: Installed Dial binary is missing" >&2; exit 1; }
curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ >/dev/null

available_kib="$(df -Pk /opt | awk 'NR==2 {print $4}')"
test "$available_kib" -ge 131072 || { echo "ERROR: Less than 128 MiB is free on /opt" >&2; exit 1; }

echo "Remote preflight passed for serial $expected_serial on firmware $expected_firmware"
REMOTE_PREFLIGHT

PREVIOUS_DIAL_SHA256="$(ssh "${SSH_OPTIONS[@]}" "${TARGET}" sha256sum /usr/bin/meticulous-dial | awk '{print $1}')"
case "${PREVIOUS_DIAL_SHA256}" in *[!0-9a-f]*|'') fail "Could not determine the installed Dial checksum" ;; esac
test "${#PREVIOUS_DIAL_SHA256}" -eq 64 || fail "Installed Dial checksum has an unexpected length"

if [ "${1:-}" = "--preflight-only" ]; then
  echo
  echo "DIAL PACKAGE PREFLIGHT PASSED"
  echo "Build ID:       ${BUILD_ID}"
  echo "Source commit:  ${SOURCE_COMMIT}"
  echo "Installed Dial: ${PREVIOUS_DIAL_SHA256}"
  echo "Test Dial:      ${NEW_DIAL_SHA256}"
  echo "No files or machine data were changed."
  exit 0
fi
test "$#" -eq 0 || fail "Unknown option: $1"

BACKUP_NAME="dial-pre-${PACKAGE_NAME}-$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_ROOT}/${BACKUP_NAME}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_ROOT}/${BACKUP_NAME}"

echo "Creating and verifying a Dial-only backup on the machine..."
ssh "${SSH_OPTIONS[@]}" "${TARGET}" sh -s -- \
  "${REMOTE_BACKUP_DIR}" \
  "${PREVIOUS_DIAL_SHA256}" <<'REMOTE_BACKUP'
set -eu

backup_dir="$1"
expected_dial_sha="$2"
test ! -e "$backup_dir" || { echo "ERROR: Refusing to overwrite $backup_dir" >&2; exit 1; }
mkdir "$backup_dir"
chmod 700 "$backup_dir"
cp -p /usr/bin/meticulous-dial "$backup_dir/meticulous-dial"
systemctl cat meticulous-dial.service > "$backup_dir/meticulous-dial.service.txt"
curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/machine > "$backup_dir/machine-state-before.json"
curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ > "$backup_dir/settings-before.json"
systemctl show meticulous-backend.service meticulous-dial.service \
  --property=Id,ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestamp > "$backup_dir/services-before.txt"

cd "$backup_dir"
printf '%s  %s\n' "$expected_dial_sha" meticulous-dial | sha256sum -c -
sha256sum meticulous-dial meticulous-dial.service.txt machine-state-before.json \
  settings-before.json services-before.txt > SHA256SUMS
sha256sum -c SHA256SUMS
sync
echo "Remote Dial backup verified: $backup_dir"
REMOTE_BACKUP

echo "Copying the verified backup to this Mac before changing the Dial executable..."
mkdir -p "${LOCAL_BACKUP_ROOT}"
chmod 700 "${LOCAL_BACKUP_ROOT}"
scp "${SSH_OPTIONS[@]}" -r "${TARGET}:${REMOTE_BACKUP_DIR}" "${LOCAL_BACKUP_ROOT}/"
(
  cd "${LOCAL_BACKUP_DIR}"
  shasum -a 256 -c SHA256SUMS
)
chmod -R go-rwx "${LOCAL_BACKUP_DIR}"

printf '%s\n%s\n%s\n%s\n%s\n%s\n' \
  "${BACKUP_NAME}" \
  "${REMOTE_BACKUP_DIR}" \
  "${LOCAL_BACKUP_DIR}" \
  "${PREVIOUS_DIAL_SHA256}" \
  "${NEW_DIAL_SHA256}" \
  "${BUILD_ID}" > "${LAST_BACKUP_FILE}"
chmod 600 "${LAST_BACKUP_FILE}"

echo "Uploading and verifying the packaged Dial binary..."
ssh "${SSH_OPTIONS[@]}" "${TARGET}" mkdir -p "${REMOTE_STAGING}"
scp "${SSH_OPTIONS[@]}" "${ARTIFACT}" "${TARGET}:${REMOTE_STAGING}/${BUILD_ID}-aarch64"
ssh "${SSH_OPTIONS[@]}" "${TARGET}" sh -s -- \
  "${REMOTE_STAGING}/${BUILD_ID}-aarch64" \
  "${NEW_DIAL_SHA256}" <<'REMOTE_VERIFY_ARTIFACT'
set -eu
artifact="$1"
expected_sha="$2"
printf '%s  %s\n' "$expected_sha" "$artifact" | sha256sum -c -
chmod 700 "$artifact"
REMOTE_VERIFY_ARTIFACT

echo
echo "READY TO INSTALL DIAL BUILD"
echo "Machine:       serial ${EXPECTED_SERIAL} on firmware ${EXPECTED_FIRMWARE}"
echo "Build ID:      ${BUILD_ID}"
echo "Source commit: ${SOURCE_COMMIT}"
echo "Current Dial:  ${PREVIOUS_DIAL_SHA256}"
echo "Test Dial:     ${NEW_DIAL_SHA256}"
echo "Remote backup: ${REMOTE_BACKUP_DIR}"
echo "Mac backup:    ${LOCAL_BACKUP_DIR}"
echo "Scope:         replace only /usr/bin/meticulous-dial and restart only meticulous-dial.service"
echo
read -r -p "Type INSTALL_DIAL_BUILD ${EXPECTED_SERIAL} to begin: " CONFIRMATION
if [ "${CONFIRMATION}" != "INSTALL_DIAL_BUILD ${EXPECTED_SERIAL}" ]; then
  echo "Installation cancelled. Verified backups and the staged binary remain available."
  exit 0
fi

echo "Installing the Dial build and restarting only the Dial service..."
ssh "${SSH_OPTIONS[@]}" "${TARGET}" sh -s -- \
  "${REMOTE_BACKUP_DIR}" \
  "${REMOTE_STAGING}/${BUILD_ID}-aarch64" \
  "${EXPECTED_SERIAL}" \
  "${EXPECTED_FIRMWARE}" \
  "${PREVIOUS_DIAL_SHA256}" \
  "${NEW_DIAL_SHA256}" <<'REMOTE_INSTALL'
set -eu

backup_dir="$1"
new_dial="$2"
expected_serial="$3"
expected_firmware="$4"
old_sha="$5"
new_sha="$6"

restore_previous_dial() {
  code="$?"
  trap - EXIT HUP INT TERM
  set +e
  echo "Dial verification failed; restoring the verified previous Dial..." >&2
  systemctl stop meticulous-dial.service
  install -m 755 "$backup_dir/meticulous-dial" /usr/bin/meticulous-dial.restore
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
  if [ "$restored" = true ] && [ "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$old_sha" ]; then
    echo "Previous Dial restored and verified." >&2
  else
    echo "ERROR: Automatic Dial restoration could not be verified. Do not start a brew." >&2
    journalctl -u meticulous-dial.service -n 100 --no-pager >&2
  fi
  exit "$code"
}
trap restore_previous_dial EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$backup_dir"
sha256sum -c SHA256SUMS
test "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$old_sha" || { echo "ERROR: Installed Dial changed after preflight" >&2; exit 1; }
test "$(sha256sum "$new_dial" | awk '{print $1}')" = "$new_sha" || { echo "ERROR: Uploaded Dial checksum changed" >&2; exit 1; }
test "$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/history/current | tr -d '[:space:]')" = "null" || { echo "ERROR: The machine reports an active shot" >&2; exit 1; }
systemctl is-active --quiet meticulous-backend.service || { echo "ERROR: Backend service is not active" >&2; exit 1; }

machine_json="$(curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/machine)"
case "$machine_json" in *"\"serial\": \"$expected_serial\""*|*"\"serial\":\"$expected_serial\""*) ;; *) echo "ERROR: Wrong machine identity" >&2; exit 1 ;; esac
case "$machine_json" in *"\"firmware\": \"$expected_firmware\""*|*"\"firmware\":\"$expected_firmware\""*) ;; *) echo "ERROR: Firmware changed" >&2; exit 1 ;; esac

curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ > "$backup_dir/settings-before-dial-install.json"
rm -f /run/meticulous-dial-ready /run/meticulous-dial-home-ready
systemctl stop meticulous-dial.service
install -m 755 "$new_dial" /usr/bin/meticulous-dial.new
test "$(sha256sum /usr/bin/meticulous-dial.new | awk '{print $1}')" = "$new_sha"
mv -f /usr/bin/meticulous-dial.new /usr/bin/meticulous-dial
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
test "$(sha256sum /usr/bin/meticulous-dial | awk '{print $1}')" = "$new_sha"
systemctl is-active --quiet meticulous-backend.service
curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ > "$backup_dir/settings-after-dial-install.json"
cmp -s "$backup_dir/settings-before-dial-install.json" "$backup_dir/settings-after-dial-install.json" || { echo "ERROR: Machine settings changed during Dial installation" >&2; exit 1; }
printf '%s  %s\n' "$new_sha" /usr/bin/meticulous-dial > "$backup_dir/dial-build-installed-sha256.txt"
sync

trap - EXIT HUP INT TERM
echo "Dial build installed and verified"
REMOTE_INSTALL

echo
echo "DIAL BUILD INSTALLATION VERIFIED"
echo "Only the Dial binary was replaced. Firmware, backend, database, and machine settings were left unchanged."
echo "After testing, run ./collect-machine-logs.sh to save the latest Dial and backend logs."

