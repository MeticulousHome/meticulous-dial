#!/bin/bash
# Runs meticulous-backend in its emulation mode (BACKEND=emulation, api/emulation.py) in Docker, for
# running the Qt Dial and its tests off the machine:
#   qt/scripts/dev-backend.sh start [BACKEND_DIR]   # default ~/backend-beta; listens on 127.0.0.1:$PORT
#   qt/scripts/dev-backend.sh stop | logs | status
# DIAL_BACKEND_NAME (container, default qt-dial-backend), PORT (default 18080), STATE (default ~/.cache/qt-dial-backend: config, profiles, history; wiped by
# `reset`), IMAGE (an image with the backend's dependencies in /opt/venv, e.g. meticulous-backend-e2e-baseline).
set -euo pipefail
cmd="${1:-start}"
backend="$(realpath "${2:-$HOME/backend-beta}")"
port="${PORT:-18080}"
state="${STATE:-$HOME/.cache/qt-dial-backend}"
image="${IMAGE:-meticulous-backend-e2e-baseline:latest}"
name="${DIAL_BACKEND_NAME:-qt-dial-backend}"

case "$cmd" in
start)
    docker rm -f "$name" >/dev/null 2>&1 || true
    mkdir -p "$state"/{config,logs,profiles,history/debug,history/energy,sounds,images/profile-images,db-migrations,alarms,reports,host-bin}
    # The host commands the machine image provides, as recording stubs (meticulous-backend
    # tests/boot/boot_harness.py HOST_COMMANDS): the emulated backend still calls them.
    for c in nmcli pactl i2cget timedatectl chpasswd systemctl hostnamectl reboot mount umount partprobe rauc-hawkbit-updater; do
        cat > "$state/host-bin/$c" <<STUB
#!/bin/sh
echo "$c \$*" >> /state/host-commands.log
case "$c \$1" in
    "i2cget -f") echo 0x21 ;;
    "timedatectl status") echo "                Time zone: Etc/UTC (UTC, +0000)" ;;
    "timedatectl list-timezones") printf "Etc/UTC
America/Mexico_City
Europe/Berlin
" ;;
esac
exit 0
STUB
        chmod +x "$state/host-bin/$c"
    done
    # Its built-in real services (Sentry, shot sharing, the time zone lookup) resolve to a dead address.
    . "$(dirname "$0")/real-services.sh"
    docker run -d --name "$name" --restart unless-stopped --network host "${no_real_services[@]}" \
        -v "$backend:/app" -v "$state:/state" -w /app -e SHOT_DATA_SHARING_SUPABASE_URL=http://127.0.0.1:9 \
        -e BACKEND=emulation -e CONFIG_PATH=/state/config -e LOG_PATH=/state/logs -e PROFILE_PATH=/state/profiles \
        -e HISTORY_PATH=/state/history -e DEBUG_HISTORY_PATH=/state/history/debug \
        -e MOTOR_ENERGY_PATH=/state/history/energy -e UPDATE_PATH=/tmp/firmware -e PORT="$port" \
        -e ZEROCONF_PORT="$port" -e DEBUG=y -e USER_SOUNDS=/state/sounds -e DEFAULT_IMAGES=/app/images/default \
        -e IMAGES_PATH=/state/images/profile-images -e TIMEZONE_JSON_FILE_PATH=/app/UI_timezones.json \
        -e USER_DB_MIGRATION_DIR=/state/db-migrations -e ALARMS_PATH=/state/alarms -e REPORTS_DIR=/state/reports \
        "$image" bash -c 'mkdir -p /run/dbus; dbus-daemon --system --fork; export PATH=/state/host-bin:/opt/venv/bin:$PATH; exec python3 back.py' >/dev/null
    for _ in $(seq 60); do
        curl -fsS "http://127.0.0.1:$port/api/v1/settings/" >/dev/null 2>&1 && { echo "backend on http://127.0.0.1:$port"; exit 0; }
        sleep 1
    done
    docker logs --tail 40 "$name"
    exit 1
    ;;
stop) docker rm -f "$name" ;;
logs) docker logs --tail "${3:-80}" "$name" ;;
reset) docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$state" ;;
status) docker ps --filter "name=$name" ;;
*) echo "usage: $0 start|stop|logs|reset|status [BACKEND_DIR]" >&2; exit 2 ;;
esac
