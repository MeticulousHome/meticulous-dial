// MiniPurgePiston (src/components/MiniPurgePiston): the small piston on Brew complete while it purges. It
// follows the piston's position like the purge screen's (m_pos 0..74 mm, SmoothPiston); `show` brings it
// in 500 ms later with a 100 ms fade, and takes it away with a 250 ms fade (piston-fade-* transitions;
// hidden, it also sits 400 px lower).
import QtQuick
import Dial

Item {
    id: mini
    property bool show: false
    readonly property real maxPosition: 74
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
    opacity: showPiston ? 1 : 0
    Behavior on opacity {
        NumberAnimation { duration: mini.showPiston ? 100 : 250; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
    }
    // piston-fade-exit-done / the initial piston-fade-enter: relative, top 400 px.
    property bool parked: !showPiston && opacity === 0
    transform: Translate { y: mini.parked ? 400 : 0 }

    // lottie/brew-mini-piston.json baked: the body (static) and the plunger, which slides 77.56 px from
    // frame 0 to 60.
    SmoothPiston {
        anchors.fill: parent
        position: mini.position
        maxPosition: mini.maxPosition
        travel: 77.56
        layers: [
            { source: Theme.asset("images/brew-mini-piston-body.png"), moves: false },
            { source: Theme.asset("images/brew-mini-piston-plunger.png"), moves: true }
        ]
    }
}
