#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/template"

usage() {
  cat <<'USAGE'
Usage: make-dial-package.sh \
  --artifact PATH \
  --output-dir PATH \
  --name SAFE_NAME \
  --expected-firmware VERSION \
  [--test-plan PATH] \
  [--source-commit FULL_SHA] \
  [--expected-serial SERIAL] \
  [--target USER@HOST]

Creates a guarded, self-contained ARM64 Meticulous Dial test package.
The output directory must not already exist.
USAGE
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

ARTIFACT=""
OUTPUT_DIR=""
PACKAGE_NAME=""
EXPECTED_FIRMWARE_VALUE=""
TEST_PLAN=""
SOURCE_COMMIT_VALUE=""
EXPECTED_SERIAL_VALUE="003312"
DEFAULT_TARGET_VALUE="root@192.168.10.142"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --artifact) ARTIFACT="${2:-}"; shift 2 ;;
    --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
    --name) PACKAGE_NAME="${2:-}"; shift 2 ;;
    --expected-firmware) EXPECTED_FIRMWARE_VALUE="${2:-}"; shift 2 ;;
    --test-plan) TEST_PLAN="${2:-}"; shift 2 ;;
    --source-commit) SOURCE_COMMIT_VALUE="${2:-}"; shift 2 ;;
    --expected-serial) EXPECTED_SERIAL_VALUE="${2:-}"; shift 2 ;;
    --target) DEFAULT_TARGET_VALUE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

test -n "${ARTIFACT}" || fail "--artifact is required"
test -n "${OUTPUT_DIR}" || fail "--output-dir is required"
test -n "${PACKAGE_NAME}" || fail "--name is required"
test -n "${EXPECTED_FIRMWARE_VALUE}" || fail "--expected-firmware is required"
test -s "${ARTIFACT}" || fail "ARM64 Dial artifact is missing or empty: ${ARTIFACT}"
test ! -e "${OUTPUT_DIR}" || fail "Output path already exists: ${OUTPUT_DIR}"
if [ -n "${TEST_PLAN}" ]; then
  test -s "${TEST_PLAN}" || fail "Test plan is missing or empty: ${TEST_PLAN}"
fi

case "${PACKAGE_NAME}" in
  *[!a-z0-9._-]*|'') fail "--name may contain only lowercase letters, digits, dot, underscore, and hyphen" ;;
esac
case "${EXPECTED_SERIAL_VALUE}" in
  *[!A-Za-z0-9._-]*|'') fail "Invalid --expected-serial" ;;
esac
case "${EXPECTED_FIRMWARE_VALUE}" in
  *[!A-Za-z0-9._+-]*|'') fail "Invalid --expected-firmware" ;;
esac
case "${DEFAULT_TARGET_VALUE}" in
  *[!A-Za-z0-9._@:-]*|'') fail "Invalid --target" ;;
esac

if [ -z "${SOURCE_COMMIT_VALUE}" ]; then
  SOURCE_COMMIT_VALUE="$(git -C "${SCRIPT_DIR}" rev-parse HEAD)"
fi
case "${SOURCE_COMMIT_VALUE}" in
  *[!0-9a-f]*|'') fail "--source-commit must be a full lowercase Git SHA" ;;
esac
test "${#SOURCE_COMMIT_VALUE}" -eq 40 || fail "--source-commit must be 40 characters"

file "${ARTIFACT}" | grep -q "ELF 64-bit" || fail "Artifact is not an ELF executable"
file "${ARTIFACT}" | grep -q "ARM aarch64" || fail "Artifact is not ARM64"

BUILD_ID="${PACKAGE_NAME}-$(printf '%s' "${SOURCE_COMMIT_VALUE}" | cut -c1-7)"
ARTIFACT_RELATIVE="artifacts/meticulous-dial-${BUILD_ID}-aarch64"

mkdir -p "${OUTPUT_DIR}/artifacts"
cp -p "${ARTIFACT}" "${OUTPUT_DIR}/${ARTIFACT_RELATIVE}"
cp -p "${TEMPLATE_DIR}/install-dial-build.sh" "${OUTPUT_DIR}/install-dial-build.sh"
cp -p "${TEMPLATE_DIR}/rollback-dial-build.sh" "${OUTPUT_DIR}/rollback-dial-build.sh"
cp -p "${TEMPLATE_DIR}/collect-machine-logs.sh" "${OUTPUT_DIR}/collect-machine-logs.sh"
cp -p "${TEMPLATE_DIR}/README.md" "${OUTPUT_DIR}/README.md"
if [ -n "${TEST_PLAN}" ]; then
  cp -p "${TEST_PLAN}" "${OUTPUT_DIR}/TEST-PLAN.md"
fi
chmod 755 "${OUTPUT_DIR}/install-dial-build.sh" \
  "${OUTPUT_DIR}/rollback-dial-build.sh" \
  "${OUTPUT_DIR}/collect-machine-logs.sh" \
  "${OUTPUT_DIR}/${ARTIFACT_RELATIVE}"

{
  printf 'PACKAGE_NAME=%s\n' "${PACKAGE_NAME}"
  printf 'BUILD_ID=%s\n' "${BUILD_ID}"
  printf 'SOURCE_COMMIT=%s\n' "${SOURCE_COMMIT_VALUE}"
  printf 'ARTIFACT_RELATIVE=%s\n' "${ARTIFACT_RELATIVE}"
  printf 'DEFAULT_TARGET=%s\n' "${DEFAULT_TARGET_VALUE}"
  printf 'PACKAGE_EXPECTED_SERIAL=%s\n' "${EXPECTED_SERIAL_VALUE}"
  printf 'PACKAGE_EXPECTED_FIRMWARE=%s\n' "${EXPECTED_FIRMWARE_VALUE}"
} > "${OUTPUT_DIR}/PACKAGE.conf"

ARTIFACT_SHA256="$(shasum -a 256 "${OUTPUT_DIR}/${ARTIFACT_RELATIVE}" | awk '{print $1}')"
{
  printf '# Build manifest\n\n'
  printf -- '- Package: `%s`\n' "${PACKAGE_NAME}"
  printf -- '- Build ID: `%s`\n' "${BUILD_ID}"
  printf -- '- Source commit: `%s`\n' "${SOURCE_COMMIT_VALUE}"
  printf -- '- Artifact: `%s`\n' "${ARTIFACT_RELATIVE}"
  printf -- '- Artifact SHA-256: `%s`\n' "${ARTIFACT_SHA256}"
  printf -- '- Architecture: `ELF 64-bit ARM aarch64`\n'
  printf -- '- Safety scope: Dial executable and Dial service only\n'
  printf -- '- Backend/database migration: none\n'
} > "${OUTPUT_DIR}/BUILD-MANIFEST.md"

(
  cd "${OUTPUT_DIR}"
  find . -type f ! -name SHA256SUMS -print | LC_ALL=C sort | xargs shasum -a 256 > SHA256SUMS
  shasum -a 256 -c SHA256SUMS
)

echo
echo "DIAL PACKAGE CREATED"
echo "Path:          ${OUTPUT_DIR}"
echo "Build ID:      ${BUILD_ID}"
echo "Source commit: ${SOURCE_COMMIT_VALUE}"
echo "Artifact SHA:  ${ARTIFACT_SHA256}"
echo "Next safe step: cd '${OUTPUT_DIR}' and run ./install-dial-build.sh --preflight-only"
