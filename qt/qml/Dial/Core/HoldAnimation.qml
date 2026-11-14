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
    // default | sparks | rainbow | heat | steam | pressure | espresso (HoldAnimations.js)
    property string style: HoldAnimations.normalize(Native.storageGet(storageKey, "default"))
    readonly property var spec: HoldAnimations.spec(style)
    readonly property bool hasSparks: spec.particles !== ""
    readonly property string particles: spec.particles
    readonly property bool waves: spec.waves
    readonly property string startEffect: spec.start
    readonly property real ringWidth: spec.ring.width
    readonly property color ringColor: spec.ring.color
    readonly property string ringScheme: spec.ring.scheme
    readonly property real ringGlow: spec.ring.glow
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
    // The ring is full and the profile starts: HoldStartWave plays the style's start effect.
    signal fired()
    function fire() { fired() }
}
