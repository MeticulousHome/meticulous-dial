#!/bin/sh

set -eu

test "$#" -eq 2 || {
  echo "usage: $0 INSTALL_SCRIPT ROLLBACK_SCRIPT" >&2
  exit 2
}

install_script="$1"
rollback_script="$2"

test -s "$install_script"
test -s "$rollback_script"
bash -n "$install_script" "$rollback_script"

assert_durable_commit() {
  script="$1"
  awk '
    {
      if ($0 ~ /^rm -f "\$transaction_marker" "\$transaction_active"$/) {
        if (previous != "sync") {
          print "transaction state is not flushed before marker removal" > "/dev/stderr"
          exit 1
        }
        if ((getline following) <= 0 || following != "sync") {
          print "marker removal is not flushed" > "/dev/stderr"
          exit 1
        }
        commits += 1
      }
      previous = $0
    }
    END {
      if (commits != 1) {
        print "expected exactly one durable transaction commit" > "/dev/stderr"
        exit 1
      }
    }
  ' "$script"
}

assert_durable_commit "$install_script"
assert_durable_commit "$rollback_script"

assert_watchdog_precedes_marker() {
  script="$1"
  awk '
    /systemd-run --quiet --unit="\$watchdog_unit" --on-active=15min/ {
      if (!watchdog) watchdog = NR
    }
    /printf .*\\n(install|rollback)\\n.*marker_temporary/ {
      if (!marker) marker = NR
    }
    END {
      if (!watchdog || !marker || watchdog >= marker) {
        print "watchdog must be armed before transaction marker creation" > "/dev/stderr"
        exit 1
      }
    }
  ' "$script"
}

assert_watchdog_precedes_marker "$install_script"
assert_watchdog_precedes_marker "$rollback_script"

grep -q '^EXPECTED_SERIAL="003312"$' "$install_script"
grep -q '^EXPECTED_FIRMWARE="0.2.24-378-gf04972b"$' "$install_script"
grep -q '^EXPECTED_MACHINE_NAME="MeticulousSpicyCrema"$' "$install_script"
grep -q '^EXPECTED_HOSTNAME="meticulousSpicyCrema-003312"$' "$install_script"
grep -q '^EXPECTED_SERIAL="003312"$' "$rollback_script"

grep -q 'identity_ready="/run/meticulous-backend-identity-ready"' "$install_script"
grep -q 'if test -s "$identity_ready"' "$install_script"
grep -q "^PYTHON_FINAL_IDENTITY_CHECK$" "$install_script"
grep -q "^PYTHON_FINAL_MACHINE_CHECK$" "$install_script"

grep -q 'systemd-run --quiet --unit="$watchdog_unit" --on-active=15min' \
  "$install_script"
grep -q 'systemd-run --quiet --unit="$watchdog_unit" --on-active=15min' \
  "$rollback_script"
grep -q -- '--on-unit-active=1min' "$install_script"
grep -q -- '--on-unit-active=1min' "$rollback_script"
grep -q 'kill -0 "$owner"' "$install_script"
grep -q 'kill -0 "$owner"' "$rollback_script"
grep -q '^printf '\''%s\\n'\'' "\$\$" > "\$transaction_active"$' "$install_script"
grep -q '^printf '\''%s\\n'\'' "\$\$" > "\$transaction_active"$' "$rollback_script"

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT HUP INT TERM
marker="$test_root/transaction"
active="$test_root/active"
recovered="$test_root/recovered"
printf marker > "$marker"
printf active > "$active"
printf '%s\n' '#!/bin/sh' 'printf recovered > "$WATCHDOG_RECOVERED"' \
  > "$test_root/recover"
chmod 755 "$test_root/recover"
WATCHDOG_RECOVERED="$recovered" /bin/sh -c \
  'marker="$1"; active="$2"; recovery="$3"; if test -s "$marker"; then owner="$(sed -n "1p" "$active" 2>/dev/null || true)"; case "$owner" in ""|*[!0-9]*) ;; *) kill -0 "$owner" 2>/dev/null && exit 0 ;; esac; rm -f "$active"; exec "$recovery"; fi' \
  sh "$marker" "$active" "$test_root/recover"
test ! -e "$active"
test "$(cat "$recovered")" = recovered

printf '%s\n' "$$" > "$active"
WATCHDOG_RECOVERED="$recovered" /bin/sh -c \
  'marker="$1"; active="$2"; recovery="$3"; if test -s "$marker"; then owner="$(sed -n "1p" "$active" 2>/dev/null || true)"; case "$owner" in ""|*[!0-9]*) ;; *) kill -0 "$owner" 2>/dev/null && exit 0 ;; esac; rm -f "$active"; exec "$recovery"; fi' \
  sh "$marker" "$active" "$test_root/recover"
test -s "$active"

echo "Pour Over package hardening checks passed"
