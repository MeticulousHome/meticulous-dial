#!/bin/bash
# Plants known bugs in a copy of the QML (qt/build/integration-plant/qml), to check that the journeys,
# through this overlay, catch them (meticulous-integration AGENTS.md: "Plant it"):
#   bash qt/tests/integration/plant.sh
#   RUN_ID=plant QT_DIAL_QML=/repo/qt/build/integration-plant/qml \
#     JOURNEYS="tests/test_dial_01_first_boot.py tests/test_dial_02_home.py" bash qt/tests/integration/run.sh
# Expected: the two title pill journeys and the device info journey fail, the rest pass.
#   pill    NavTitle never scrolls to the selected card's name (it keeps "Catalog")
#   device  Device Info shows every value with a trailing "!"
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
out="$repo/qt/build/integration-plant"
rm -rf "$out"
mkdir -p "$out"
cp -a "$repo/qt/qml" "$out/"
# The assets' links are relative to qt/qml/Dial/assets: point them from the copy's place.
ln -sfn ../../../../../../public "$out/qml/Dial/assets/public"
ln -sfn ../../../../../../src/assets "$out/qml/Dial/assets/src"
sed -i 's/readonly property bool scroll: (Profiles.localHoverState || Profiles.homeCardSelected) \&\& isHome/readonly property bool scroll: false/' \
    "$out/qml/Dial/components/NavTitle.qml"
sed -i 's/label: key + ": " + describe(info\[key\])/label: key + ": " + describe(info[key]) + "!"/' \
    "$out/qml/Dial/screens/settings/DeviceInfoScreen.qml"
grep -c "scroll: false" "$out/qml/Dial/components/NavTitle.qml"
grep -c '+ "!"' "$out/qml/Dial/screens/settings/DeviceInfoScreen.qml"
echo "planted in $out/qml"
