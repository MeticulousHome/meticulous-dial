#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
RECOVERY_SCRIPT="$SCRIPT_DIR/pour-over-transaction-recovery.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT HUP INT TERM

make_fake_commands() {
  root="$1"
  mkdir -p "$root/fake-bin"
  printf '%s\n' \
    '#!/bin/sh' \
    'if test "${1:-}" = "start" && test "${2:-}" = "meticulous-dial.service"; then' \
    '  mkdir -p "$POUR_OVER_RECOVERY_ROOT/run"' \
    '  printf ready > "$POUR_OVER_RECOVERY_ROOT/run/meticulous-dial-ready"' \
    '  printf ready > "$POUR_OVER_RECOVERY_ROOT/run/meticulous-dial-home-ready"' \
    'fi' \
    'exit 0' > "$root/fake-bin/systemctl"
  printf '%s\n' '#!/bin/sh' 'printf "{}\n"' > "$root/fake-bin/curl"
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$root/fake-bin/journalctl"
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$root/fake-bin/sleep"
  chmod 755 "$root/fake-bin/systemctl" "$root/fake-bin/curl" \
    "$root/fake-bin/journalctl" "$root/fake-bin/sleep"
}

prepare_stack() {
  root="$1"
  operation="$2"
  backup="$root/opt/meticulous-firmware/backups/full-stack-pre-pour-over-history-test"
  mkdir -p "$backup/live-meticulous-backend" "$backup/live-meticulous-venv" \
    "$root/opt/meticulous-backend" "$root/opt/meticulous-venv" \
    "$root/usr/bin" "$root/meticulous-user/history" "$root/run"
  printf old-backend > "$backup/live-meticulous-backend/version"
  printf old-venv > "$backup/live-meticulous-venv/version"
  printf old-wrapper > "$backup/usr-bin-meticulous-backend"
  printf old-config > "$backup/usr-bin-met-config"
  printf old-dial > "$backup/meticulous-dial"
  printf old-history > "$backup/history.sqlite.pre-install"
  printf new-backend > "$root/opt/meticulous-backend/version"
  printf new-venv > "$root/opt/meticulous-venv/version"
  printf new-wrapper > "$root/usr/bin/meticulous-backend"
  printf new-config > "$root/usr/bin/met-config"
  printf new-dial > "$root/usr/bin/meticulous-dial"
  printf current-history > "$root/meticulous-user/history/history.sqlite"
  (
    cd "$backup"
    sha256sum usr-bin-meticulous-backend usr-bin-met-config meticulous-dial \
      history.sqlite.pre-install > SHA256SUMS
  )
  printf '1\n%s\n%s\n' "$operation" \
    '/opt/meticulous-firmware/backups/full-stack-pre-pour-over-history-test' \
    > "$root/opt/meticulous-firmware/backups/.pour-over-transaction"
  make_fake_commands "$root"
}

install_root="$TEST_ROOT/install"
prepare_stack "$install_root" install
PATH="$install_root/fake-bin:$PATH" POUR_OVER_RECOVERY_ROOT="$install_root" \
  "$RECOVERY_SCRIPT"
test "$(cat "$install_root/opt/meticulous-backend/version")" = old-backend
test "$(cat "$install_root/opt/meticulous-venv/version")" = old-venv
test "$(cat "$install_root/usr/bin/meticulous-dial")" = old-dial
test "$(cat "$install_root/meticulous-user/history/history.sqlite")" = old-history
test ! -e "$install_root/opt/meticulous-firmware/backups/.pour-over-transaction"
find "$install_root/opt/meticulous-firmware/backups/full-stack-pre-pour-over-history-test" \
  -maxdepth 1 -name 'recovery-meticulous-backend-*' | grep -q .

rollback_root="$TEST_ROOT/rollback"
prepare_stack "$rollback_root" rollback
PATH="$rollback_root/fake-bin:$PATH" POUR_OVER_RECOVERY_ROOT="$rollback_root" \
  "$RECOVERY_SCRIPT"
test "$(cat "$rollback_root/opt/meticulous-backend/version")" = old-backend
test "$(cat "$rollback_root/opt/meticulous-venv/version")" = old-venv
test "$(cat "$rollback_root/usr/bin/meticulous-dial")" = old-dial
test "$(cat "$rollback_root/meticulous-user/history/history.sqlite")" = current-history
test ! -e "$rollback_root/opt/meticulous-firmware/backups/.pour-over-transaction"

boot_root="$TEST_ROOT/boot"
prepare_stack "$boot_root" install
printf '%s\n' '#!/bin/sh' 'exit 1' > "$boot_root/fake-bin/systemctl"
printf '%s\n' '#!/bin/sh' 'exit 1' > "$boot_root/fake-bin/curl"
chmod 755 "$boot_root/fake-bin/systemctl" "$boot_root/fake-bin/curl"
PATH="$boot_root/fake-bin:$PATH" POUR_OVER_RECOVERY_ROOT="$boot_root" \
  POUR_OVER_RECOVERY_VERIFY_SERVICES=0 "$RECOVERY_SCRIPT"
test "$(cat "$boot_root/opt/meticulous-backend/version")" = old-backend
test "$(cat "$boot_root/usr/bin/meticulous-dial")" = old-dial
test ! -e "$boot_root/opt/meticulous-firmware/backups/.pour-over-transaction"

failure_root="$TEST_ROOT/failure"
prepare_stack "$failure_root" install
printf '%s\n' '#!/bin/sh' 'exit 1' > "$failure_root/fake-bin/curl"
chmod 755 "$failure_root/fake-bin/curl"
if PATH="$failure_root/fake-bin:$PATH" POUR_OVER_RECOVERY_ROOT="$failure_root" \
  "$RECOVERY_SCRIPT" >/dev/null 2>&1; then
  echo "ERROR: Recovery unexpectedly succeeded without backend health" >&2
  exit 1
fi
test -s "$failure_root/opt/meticulous-firmware/backups/.pour-over-transaction"

echo "Pour Over transaction recovery fault-injection tests passed"
