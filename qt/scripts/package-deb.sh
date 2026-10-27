#!/bin/bash
# Builds the machine's package, build/meticulous-dial_<version>_arm64.deb:
#   qt/scripts/package-deb.sh            # builds arm64 first
# Installs /usr/bin/meticulous-dial-qt (+ -launch), /usr/share/meticulous-dial-qt (QML, assets, kms.json) and
# meticulous-dial.service, enabled. The version is package.json's (the release) + the commit count and hash.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/.." && pwd)"
bash "$here/scripts/build.sh" arm64 >/dev/null

release="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$repo/package.json")"
# A pre-release ("1.106.0-beta.3") sorts before its release in Debian as "1.106.0~beta.3".
version="${release/-/\~}+$(git -C "$repo" rev-list --count HEAD).g$(git -C "$repo" rev-parse --short HEAD)"
stage="$here/build/deb"
rm -rf "$stage"
mkdir -p "$stage/DEBIAN" "$stage/usr/bin" "$stage/usr/share/meticulous-dial-qt" "$stage/lib/systemd/system"

install -m 755 "$here/build/arm64/meticulous-dial-qt" "$stage/usr/bin/"
install -m 755 "$here/packaging/meticulous-dial-qt.sh" "$stage/usr/bin/meticulous-dial-qt-launch"
install -m 644 "$here/packaging/meticulous-dial.service" "$stage/lib/systemd/system/"
install -m 644 "$here/packaging/kms.json" "$stage/usr/share/meticulous-dial-qt/"
cp -r "$here/qml" "$stage/usr/share/meticulous-dial-qt/qml"
find "$stage/usr/share/meticulous-dial-qt/qml" -name "*.qmlc" -delete

# Dependencies: the binary's libraries and the QML modules the QML imports. sentry-native (src/sentry) is linked
# statically with its breakpad crash handler (in process: no handler binary to ship); its HTTP transport needs
# libcurl4. Its database lives in $XDG_CACHE_HOME/meticulous-dial-qt/sentry (the launcher: /meticulous-user/.cache).
qml_deps=$(python3 - "$here/qml" <<'EOF'
import os, re, sys
modules = {
    "QtQuick": "qml6-module-qtquick", "QtQuick.Window": "qml6-module-qtquick-window",
    "QtQuick.Shapes": "qml6-module-qtquick-shapes", "QtQuick.Layouts": "qml6-module-qtquick-layouts",
    "QtQuick.Particles": "qml6-module-qtquick-particles", "QtQuick.Controls": "qml6-module-qtquick-controls",
    "QtWebSockets": "qml6-module-qtwebsockets", "Qt.labs.lottieqt": "qml6-module-qt-labs-lottieqt",
    "Qt5Compat.GraphicalEffects": "qml6-module-qt5compat-graphicaleffects",
    "QtQml.WorkerScript": "qml6-module-qtqml-workerscript", "QtQml.Models": "qml6-module-qtqml-models",
    "Qt.labs.settings": "qml6-module-qt-labs-settings", "QtQml": "qml6-module-qtqml",
}
found = {"qml6-module-qtquick", "qml6-module-qtquick-window", "qml6-module-qtqml-workerscript"}
for root, _, files in os.walk(sys.argv[1]):
    for f in files:
        if f.endswith(".qml"):
            for m in re.findall(r"^import\s+([A-Za-z0-9_.]+)", open(os.path.join(root, f)).read(), re.M):
                if m in modules:
                    found.add(modules[m])
print(", ".join(sorted(found)))
EOF
)
cat > "$stage/DEBIAN/control" <<EOF
Package: meticulous-dial
Version: $version
Architecture: arm64
Maintainer: Meticulous <software@meticuloushome.com>
Section: misc
Priority: optional
Depends: libc6, libstdc++6, libqt6core6 (>= 6.4), libqt6gui6, libqt6network6, libqt6qml6, libqt6quick6, libqt6websockets6, libqt6svg6, qt6-qpa-plugins, librlottie0-1, libqrcodegencpp1, libssl3, libcurl4, ca-certificates, $qml_deps
Conflicts: meticulous-dial-qt
Replaces: meticulous-dial-qt
Description: Meticulous Dial
 The machine's round display, in Qt Quick, drawing straight on DRM/KMS (eglfs).
EOF
cat > "$stage/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = configure ]; then
    # Machines that ran the meticulous-dial-qt package have its copy of the unit in /etc (dial-switch):
    # the packaged unit is the one now.
    if grep -qs "Qt Quick" /etc/systemd/system/meticulous-dial.service; then
        rm -f /etc/systemd/system/meticulous-dial.service
    fi
    # The Dial is the DRM master: nothing else may hold the display.
    systemctl disable weston.service 2>/dev/null || true
    systemctl enable meticulous-dial.service || true
    # On a running machine (not while an image is built in a chroot): start the new version.
    if [ -d /run/systemd/system ]; then
        systemctl daemon-reload || true
        systemctl stop weston.service 2>/dev/null || true
        systemctl restart meticulous-dial.service || true
    fi
fi
EOF
cat > "$stage/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = remove ] && [ -d /run/systemd/system ]; then
    systemctl stop meticulous-dial.service || true
fi
EOF
cat > "$stage/DEBIAN/postrm" <<'EOF'
#!/bin/sh
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload || true
fi
EOF
chmod 755 "$stage/DEBIAN/postinst" "$stage/DEBIAN/prerm" "$stage/DEBIAN/postrm"

out="$here/build/meticulous-dial_${version}_arm64.deb"
docker run --rm -u "$(id -u):$(id -g)" -v "$repo:/repo" qt-dial-bookworm \
    fakeroot dpkg-deb --build -Zxz "/repo/qt/build/deb" "/repo/qt/build/$(basename "$out")" >/dev/null
echo "$out"
docker run --rm -v "$repo:/repo" qt-dial-bookworm dpkg-deb --info "/repo/qt/build/$(basename "$out")" | grep -E "Version|Depends|Installed-Size"
