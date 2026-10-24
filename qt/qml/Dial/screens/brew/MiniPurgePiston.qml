// MiniPurgePiston (src/components/MiniPurgePiston): the small piston on Brew complete while it purges. It
// follows the piston's position like the purge screen's (m_pos 0..74 mm over 60 frames, 200 ms linear to
// each reading); `show` brings it in 500 ms later with a 100 ms fade, and takes it away with a 250 ms fade
// (piston-fade-* transitions; hidden, it also sits 400 px lower).
import QtQuick
import Dial
import Dial.Native

Item {
    id: mini
    property bool show: false
    readonly property real maxPosition: 74
    readonly property real totalFrames: 60
    readonly property real position: Stats.sensorData.m_pos

    width: 41.06
    height: 90.25

    property bool showPiston: show
    onShowChanged: {
        if (show) delay.restart()
        else {
            delay.stop()
            showPiston = false
        }
    }
    Timer {
        id: delay
        interval: 500
        onTriggered: mini.showPiston = true
    }
    // useState(show): shown at once when mounted during the purge.
    Component.onCompleted: positionEffect()

    opacity: showPiston ? 1 : 0
    Behavior on opacity {
        NumberAnimation { duration: mini.showPiston ? 100 : 250; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
    }
    // piston-fade-exit-done / the initial piston-fade-enter: relative, top 400 px.
    property bool parked: !showPiston && opacity === 0
    transform: Translate { y: mini.parked ? 400 : 0 }

    property bool initialized: false
    property real pistonFrame: 0
    function positionEffect() {
        if (isNaN(position) || position < 0) return
        const current = Math.min(position, maxPosition) / maxPosition * totalFrames
        if (!initialized) {
            initialized = true
            pistonFrame = current
            return
        }
        pistonAnim.stop()
        pistonAnim.from = pistonFrame
        pistonAnim.to = Math.max(0, Math.min(current, totalFrames))
        pistonAnim.start()
    }
    onPositionChanged: positionEffect()
    NumberAnimation {
        id: pistonAnim
        target: mini
        property: "pistonFrame"
        duration: 200
    }
    onPistonFrameChanged: piston.gotoAndStop(pistonFrame)

    LottieItem {
        id: piston
        anchors.fill: parent
        source: Theme.asset("lottie/brew-mini-piston.json")
        loops: 1
        // LottieItem rewinds to the segment start right after loadedChanged: place it a moment later.
        onLoadedChanged: if (loaded) Qt.callLater(() => piston.gotoAndStop(mini.pistonFrame))
    }
}
