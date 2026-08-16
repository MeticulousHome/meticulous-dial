#!/bin/sh

set -eu

RECOVERY_ROOT="${POUR_OVER_RECOVERY_ROOT:-}"
MARKER_PATH="$RECOVERY_ROOT/opt/meticulous-firmware/backups/.pour-over-transaction"

test -s "$MARKER_PATH" || exit 0

marker_version="$(sed -n '1p' "$MARKER_PATH")"
operation="$(sed -n '2p' "$MARKER_PATH")"
backup_dir="$(sed -n '3p' "$MARKER_PATH")"

test "$marker_version" = "1" || {
  echo "ERROR: Unsupported Pour Over recovery marker" >&2
  exit 1
}
case "$operation" in
  install|rollback) ;;
  *) echo "ERROR: Invalid Pour Over recovery operation" >&2; exit 1 ;;
esac
case "$backup_dir" in
  /opt/meticulous-firmware/backups/full-stack-pre-pour-over-history-*) ;;
  *) echo "ERROR: Invalid Pour Over recovery backup path" >&2; exit 1 ;;
esac
backup_fs_dir="$RECOVERY_ROOT$backup_dir"

test -d "$backup_fs_dir"
cd "$backup_fs_dir"
sha256sum -c SHA256SUMS

stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"

archive_current_directory() {
  current_path="$1"
  archive_label="$2"
  if test -e "$current_path"; then
    mv "$current_path" "$backup_fs_dir/recovery-$archive_label-$stamp"
  fi
}

restore_saved_directory() {
  saved_name="$1"
  target_path="$2"
  archive_label="$3"
  if test -d "$backup_fs_dir/$saved_name"; then
    archive_current_directory "$target_path" "$archive_label"
    mv "$backup_fs_dir/$saved_name" "$target_path"
  else
    test -d "$target_path"
  fi
}

echo "Recovering interrupted Pour Over $operation transaction..." >&2
systemctl stop meticulous-dial.service meticulous-backend.service || true

restore_saved_directory live-meticulous-backend "$RECOVERY_ROOT/opt/meticulous-backend" meticulous-backend
restore_saved_directory live-meticulous-venv "$RECOVERY_ROOT/opt/meticulous-venv" meticulous-venv
cp -p "$backup_fs_dir/usr-bin-meticulous-backend" "$RECOVERY_ROOT/usr/bin/meticulous-backend"
cp -p "$backup_fs_dir/usr-bin-met-config" "$RECOVERY_ROOT/usr/bin/met-config"
cp -p "$backup_fs_dir/meticulous-dial" "$RECOVERY_ROOT/usr/bin/meticulous-dial"

if test "$operation" = "install"; then
  test -s "$backup_fs_dir/history.sqlite.pre-install"
  failed_history="$backup_fs_dir/recovery-history-$stamp"
  mkdir "$failed_history"
  for database_file in history.sqlite history.sqlite-wal history.sqlite-shm; do
    if test -e "$RECOVERY_ROOT/meticulous-user/history/$database_file"; then
      mv "$RECOVERY_ROOT/meticulous-user/history/$database_file" "$failed_history/$database_file"
    fi
  done
  cp -p "$backup_fs_dir/history.sqlite.pre-install" "$RECOVERY_ROOT/meticulous-user/history/history.sqlite"
fi

systemctl start meticulous-backend.service
backend_ready=false
attempt=1
while test "$attempt" -le 90; do
  if curl -fsS --max-time 5 http://127.0.0.1:8080/api/v1/settings/ >/dev/null 2>&1; then
    backend_ready=true
    break
  fi
  sleep 1
  attempt=$((attempt + 1))
done
test "$backend_ready" = true || {
  journalctl -u meticulous-backend.service -n 150 --no-pager >&2
  exit 1
}

rm -f "$RECOVERY_ROOT/run/meticulous-dial-ready" "$RECOVERY_ROOT/run/meticulous-dial-home-ready"
systemctl start meticulous-dial.service
dial_ready=false
attempt=1
while test "$attempt" -le 90; do
  if systemctl is-active --quiet meticulous-dial.service && test -s "$RECOVERY_ROOT/run/meticulous-dial-ready"; then
    dial_ready=true
    break
  fi
  sleep 1
  attempt=$((attempt + 1))
done
test "$dial_ready" = true || {
  journalctl -u meticulous-dial.service -n 150 --no-pager >&2
  exit 1
}

systemctl is-active --quiet meticulous-backend.service
rm -f "$MARKER_PATH"
sync
echo "Interrupted Pour Over $operation transaction recovered." >&2
