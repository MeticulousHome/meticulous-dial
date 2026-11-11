pragma Singleton
// The animation of the home's "Hold to start" ring. Which one: the user's choice (Advanced Settings), kept in
// the Dial's own storage, as it is a look of this display and not a setting of the machine. And, while a
// card is held, what the sparks follow: they are drawn over the screens (main.qml), not in the home, so the
// ones in the air when a profile starts fly on over the screen that comes in.
import QtQuick
import Dial.Native
import "HoldAnimations.js" as HoldAnimations

QtObject {
    readonly property string storageKey: "home.holdAnimation"
    // default | sparks | rainbow (HoldAnimations.js)
    property string style: HoldAnimations.normalize(Native.storageGet(storageKey, "default"))
    readonly property bool hasSparks: HoldAnimations.hasSparks(style)
    // The menu of the setting, and the short label Advanced Settings shows.
    readonly property var choices: HoldAnimations.HOLD_ANIMATIONS
    readonly property string shortLabel: HoldAnimations.shortLabel(style)
    function setStyle(key) {
        style = HoldAnimations.normalize(key)
        Native.storageSet(storageKey, style)
    }

    // Written by the home (ProfileHome.qml): whether sparks are born now, and the ring's fill.
    property bool burning: false
    property real sweep: 0
    property real fillSeconds: 1
    // Written by the sparks (main.qml): whether any are drawn and animated.
    property bool animating: false
}
