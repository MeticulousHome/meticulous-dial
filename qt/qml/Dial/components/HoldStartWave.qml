// What the full "Hold to start" ring does when the profile starts (Core/HoldAnimation.qml's startEffect),
// drawn over the screens as the sparks are: the home's route is gone 90 ms after the start, which would cut
// it short. "glow": the ring glows white and fades (heat), on the edge of the display, off the next screen's
// content. An Animator: it runs on the render thread while the QML thread builds the next screen, and
// nothing is drawn once it is done.
import QtQuick
import Dial

Item {
    id: start

    // Test probe: the effect that ran last.
    property string played: ""
    readonly property string dialProbe_startEffect: played

    Arc {
        id: wave
        anchors.centerIn: parent
        radius: 233
        lineWidth: 4
        glow: 14
        color: "white"
        sweep: 1
        opacity: 0
        visible: opacity > 0
    }

    Connections {
        target: HoldAnimation
        function onFired() {
            const effect = HoldAnimation.startEffect
            if (!effect) return
            start.played = effect
            glowOut.stop()
            // An Animator writes its property when it ends, not while it runs: visible needs the start value.
            wave.opacity = 1
            glowOut.start()
        }
    }

    OpacityAnimator { id: glowOut; target: wave; from: 1; to: 0; duration: 600; easing.type: Easing.OutQuad }
}
