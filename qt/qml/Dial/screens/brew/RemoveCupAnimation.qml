// RemoveCupAnimation (src/components/BrewCompleteScreen/RemoveCupAnimation.tsx): a 130 x 150 px box, the
// drip tray (lines stroked with a green radial gradient) at its bottom and, 25 px above it, the cup and an
// arrow rising and fading: 4 s ease-out per keyframe interval, forever. The cup: opacity 0 -> 1 (30 %),
// 1 until 70 %, -> 0; translateY 0 until 10 %, then -> -50 px. The arrow the same to -80 px.
import QtQuick
import Dial

Item {
    id: removeCup
    width: 130
    height: 150

    Image {
        y: removeCup.height - 101
        width: 130
        height: 101
        sourceSize: Qt.size(130, 101)
        source: Theme.asset("icons/brew-drip-tray.svg")
    }

    component Rising: Image {
        id: rising
        property real rise: 50
        property real lift: 0
        y: removeCup.height - 25 - 137 + lift
        width: 126
        height: 137
        sourceSize: Qt.size(126, 137)
        opacity: 0
        ParallelAnimation {
            running: removeCup.visible
            loops: Animation.Infinite
            onRunningChanged: if (!running) { rising.lift = 0; rising.opacity = 0 }
            SequentialAnimation {
                PropertyAction { target: rising; property: "lift"; value: 0 }
                PauseAnimation { duration: 400 }
                NumberAnimation { target: rising; property: "lift"; from: 0; to: -rising.rise; duration: 3600; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
            }
            SequentialAnimation {
                NumberAnimation { target: rising; property: "opacity"; from: 0; to: 1; duration: 1200; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                PauseAnimation { duration: 1600 }
                NumberAnimation { target: rising; property: "opacity"; from: 1; to: 0; duration: 1200; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
            }
        }
    }

    Rising {
        source: Theme.asset("icons/brew-cup.svg")
        rise: 50
    }
    Rising {
        source: Theme.asset("icons/brew-cup-arrow.svg")
        rise: 80
    }
}
