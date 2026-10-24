#!/bin/bash
# Builds the machine's package, build/meticulous-dial-qt_<version>_arm64.deb:
#   qt/scripts/package-deb.sh            # builds arm64 first
# Installs /usr/bin/meticulous-dial-qt (+ -launch, dial-switch), /usr/share/meticulous-dial-qt (QML, assets,
# kms.json) and meticulous-dial-qt.service. Installing it switches the display to the Qt Dial
# (dial-switch qt) unless DIAL_QT_NO_SWITCH=1; removing it switches back (dial-switch web).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/.." && pwd)"
bash "$here/scripts/build.sh" arm64 >/dev/null

version="0.1.0+$(git -C "$repo" rev-list --count HEAD).g$(git -C "$repo" rev-parse --short HEAD)"
stage="$here/build/deb"
rm -rf "$stage"
mkdir -p "$stage/DEBIAN" "$stage/usr/bin" "$stage/usr/share/meticulous-dial-qt" "$stage/lib/systemd/system"

install -m 755 "$here/build/arm64/meticulous-dial-qt" "$stage/usr/bin/"
install -m 755 "$here/packaging/meticulous-dial-qt.sh" "$stage/usr/bin/meticulous-dial-qt-launch"
install -m 755 "$here/packaging/dial-switch" "$stage/usr/bin/dial-switch"
install -m 644 "$here/packaging/meticulous-dial-qt.service" "$stage/lib/systemd/system/"
install -m 644 "$here/packaging/kms.json" "$stage/usr/share/meticulous-dial-qt/"
cp -rL "$here/qml" "$stage/usr/share/meticulous-dial-qt/qml"
# Only what the QML uses from the React tree's assets: the fonts' web CSS is not needed.
rm -rf "$stage/usr/share/meticulous-dial-qt/qml/Dial/assets/src/fonts/custom/css"
find "$stage/usr/share/meticulous-dial-qt/qml" -name "*.qmlc" -delete

# Dependencies: the binary's libraries and the QML modules the QML imports.
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
Package: meticulous-dial-qt
Version: $version
Architecture: arm64
Maintainer: Meticulous <software@meticuloushome.com>
Section: misc
Priority: optional
Depends: libc6, libstdc++6, libqt6core6 (>= 6.4), libqt6gui6, libqt6network6, libqt6qml6, libqt6quick6, libqt6websockets6, libqt6concurrent6, libqt6svg6, qt6-qpa-plugins, librlottie0-1, libqrcodegencpp1, libssl3, ca-certificates, $qml_deps
Description: Meticulous Dial (Qt Quick)
 The on-machine Dial rewritten in Qt Quick, running straight on DRM/KMS (eglfs) without Weston.
 dial-switch qt|web chooses between it and the WebKit Dial.
EOF
cat > "$stage/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = configure ]; then
    systemctl daemon-reload || true
    if [ -z "${DIAL_QT_NO_SWITCH:-}" ]; then
        /usr/bin/dial-switch qt || true
    else
        systemctl try-restart meticulous-dial-qt.service || true
    fi
fi
EOF
cat > "$stage/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = remove ]; then
    /usr/bin/dial-switch web || true
fi
EOF
cat > "$stage/DEBIAN/postrm" <<'EOF'
#!/bin/sh
systemctl daemon-reload || true
EOF
chmod 755 "$stage/DEBIAN/postinst" "$stage/DEBIAN/prerm" "$stage/DEBIAN/postrm"

out="$here/build/meticulous-dial-qt_${version}_arm64.deb"
docker run --rm -u "$(id -u):$(id -g)" -v "$repo:/repo" qt-dial-bookworm \
    fakeroot dpkg-deb --build -Zxz "/repo/qt/build/deb" "/repo/qt/build/$(basename "$out")" >/dev/null
echo "$out"
docker run --rm -v "$repo:/repo" qt-dial-bookworm dpkg-deb --info "/repo/qt/build/$(basename "$out")" | grep -E "Version|Depends|Installed-Size"
