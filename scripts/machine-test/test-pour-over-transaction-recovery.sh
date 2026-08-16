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
    'if test "${1:-}" = "set-hostname"; then' \
    '  printf "%s\n" "$2" > "$POUR_OVER_RECOVERY_ROOT/run/runtime-hostname"' \
    '  exit 0' \
    'fi' \
    'if test "${1:-}" = "--static"; then' \
    '  cat "$POUR_OVER_RECOVERY_ROOT/run/runtime-hostname"' \
    '  exit 0' \
    'fi' \
    'exit 0' > "$root/fake-bin/hostnamectl"
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
  chmod 755 "$root/fake-bin/hostnamectl" "$root/fake-bin/systemctl" "$root/fake-bin/curl" \
    "$root/fake-bin/journalctl" "$root/fake-bin/sleep"
}

prepare_stack() {
  root="$1"
  operation="$2"
  backup="$root/opt/meticulous-firmware/backups/full-stack-pre-pour-over-history-test"
  mkdir -p "$backup/live-meticulous-backend" "$backup/live-meticulous-venv" \
    "$root/opt/meticulous-backend" "$root/opt/meticulous-venv" \
    "$root/usr/bin" "$root/meticulous-user/config" "$root/meticulous-user/history" \
    "$root/etc" "$root/run"
  printf old-backend > "$backup/live-meticulous-backend/version"
  printf old-venv > "$backup/live-meticulous-venv/version"
  printf old-wrapper > "$backup/usr-bin-meticulous-backend"
  printf old-config > "$backup/usr-bin-met-config"
  printf old-dial > "$backup/meticulous-dial"
  printf old-history > "$backup/history.sqlite.pre-install"
  printf 'system:\n  machine_name: [spicy, Crema]\n' > "$backup/config.yml.pre-install"
  printf 'meticulousSpicyCrema-003312\n' > "$backup/etc-hostname.pre-install"
  printf 'meticulousSpicyCrema-003312\n' > "$backup/hostname-static.pre-install"
  printf new-backend > "$root/opt/meticulous-backend/version"
  printf new-venv > "$root/opt/meticulous-venv/version"
  printf new-wrapper > "$root/usr/bin/meticulous-backend"
  printf new-config > "$root/usr/bin/met-config"
  printf new-dial > "$root/usr/bin/meticulous-dial"
  printf current-history > "$root/meticulous-user/history/history.sqlite"
  printf 'system:\n  machine_name: [renowned, Body]\n' \
    > "$root/meticulous-user/config/config.yml"
  printf 'meticulousRenownedBody-003312\n' > "$root/etc/hostname"
  (
    cd "$backup"
    sha256sum usr-bin-meticulous-backend usr-bin-met-config meticulous-dial \
      history.sqlite.pre-install config.yml.pre-install etc-hostname.pre-install \
      hostname-static.pre-install > SHA256SUMS
  )
  printf '1\n%s\n%s\n' "$operation" \
    '/opt/meticulous-firmware/backups/full-stack-pre-pour-over-history-test' \
    > "$root/opt/meticulous-firmware/backups/.pour-over-transaction"
  printf active > "$root/run/meticulous-pour-over-transaction-active"
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
grep -q 'machine_name: \[spicy, Crema\]' \
  "$install_root/meticulous-user/config/config.yml"
test "$(cat "$install_root/etc/hostname")" = meticulousSpicyCrema-003312
test "$(cat "$install_root/run/runtime-hostname")" = meticulousSpicyCrema-003312
test ! -e "$install_root/opt/meticulous-firmware/backups/.pour-over-transaction"
test ! -e "$install_root/run/meticulous-pour-over-transaction-active"
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
grep -q 'machine_name: \[renowned, Body\]' \
  "$rollback_root/meticulous-user/config/config.yml"
test "$(cat "$rollback_root/etc/hostname")" = meticulousRenownedBody-003312
test ! -e "$rollback_root/run/runtime-hostname"
test ! -e "$rollback_root/opt/meticulous-firmware/backups/.pour-over-transaction"
test ! -e "$rollback_root/run/meticulous-pour-over-transaction-active"

boot_root="$TEST_ROOT/boot"
prepare_stack "$boot_root" install
# /run is volatile, so this in-progress marker is absent after a reboot.
rm -f "$boot_root/run/meticulous-pour-over-transaction-active"
printf '%s\n' '#!/bin/sh' 'exit 1' > "$boot_root/fake-bin/systemctl"
printf '%s\n' '#!/bin/sh' 'exit 1' > "$boot_root/fake-bin/curl"
chmod 755 "$boot_root/fake-bin/systemctl" "$boot_root/fake-bin/curl"
PATH="$boot_root/fake-bin:$PATH" POUR_OVER_RECOVERY_ROOT="$boot_root" \
  POUR_OVER_RECOVERY_VERIFY_SERVICES=0 "$RECOVERY_SCRIPT"
test "$(cat "$boot_root/opt/meticulous-backend/version")" = old-backend
test "$(cat "$boot_root/usr/bin/meticulous-dial")" = old-dial
grep -q 'machine_name: \[spicy, Crema\]' "$boot_root/meticulous-user/config/config.yml"
test "$(cat "$boot_root/etc/hostname")" = meticulousSpicyCrema-003312
test "$(cat "$boot_root/run/runtime-hostname")" = meticulousSpicyCrema-003312
test ! -e "$boot_root/opt/meticulous-firmware/backups/.pour-over-transaction"
test ! -e "$boot_root/run/meticulous-pour-over-transaction-active"

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
test -s "$failure_root/run/meticulous-pour-over-transaction-active"
grep -q 'machine_name: \[spicy, Crema\]' \
  "$failure_root/meticulous-user/config/config.yml"
test "$(cat "$failure_root/etc/hostname")" = meticulousSpicyCrema-003312

grep -q '^ConditionPathExists=!/run/meticulous-pour-over-transaction-active$' \
  "$SCRIPT_DIR/meticulous-pour-over-recovery.service"

echo "Pour Over transaction recovery fault-injection tests passed"
