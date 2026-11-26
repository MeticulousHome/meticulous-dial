#!/bin/sh
# Starts the Dial straight on DRM/KMS (eglfs_kms, no Weston): it must be the DRM master, so nothing else may
# hold the display. Installed as /usr/bin/meticulous-dial-qt-launch; meticulous-dial.service runs it.
# Environment overrides: DIAL_QT_PREFIX (default /usr), DIAL_API_URL, DIAL_ROTATION, DIAL_TEST_PORT,
# DIAL_BOOT_THEME_FILE.
prefix="${DIAL_QT_PREFIX:-/usr}"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-eglfs}"
export QT_QPA_EGLFS_INTEGRATION="${QT_QPA_EGLFS_INTEGRATION:-eglfs_kms}"
export QT_QPA_EGLFS_KMS_CONFIG="${QT_QPA_EGLFS_KMS_CONFIG:-$prefix/share/meticulous-dial-qt/kms.json}"
export QT_QPA_EGLFS_KMS_ATOMIC=1
export QT_QPA_EGLFS_HIDECURSOR=1
export QT_QPA_FONTDIR="${QT_QPA_FONTDIR:-/usr/share/fonts}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/0}"
mkdir -p "$XDG_RUNTIME_DIR" 2>/dev/null
# The real support ticket service, Sentry and Community: on for the machine; tests set it to 0.
export DIAL_EXTERNAL_SERVICES="${DIAL_EXTERNAL_SERVICES:-1}"
# The theme the boot splash shows (psplash --theme-file): the Dial keeps it equal to its own. On the root file
# system, which psplash can read before /meticulous-user is mounted; an update carries it over to the new slot
# (meticulous-machine rauc-config/rootfs_hooks.sh).
export DIAL_BOOT_THEME_FILE="${DIAL_BOOT_THEME_FILE:-/var/lib/meticulous-dial/boot-theme}"
mkdir -p "$(dirname "$DIAL_BOOT_THEME_FILE")" 2>/dev/null
# The Qt Quick disk cache of the compiled QML lives with the user data.
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/meticulous-user/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-/meticulous-user/.local/share}"
exec "$prefix/bin/meticulous-dial-qt" --qml-dir "$prefix/share/meticulous-dial-qt/qml" "$@"
