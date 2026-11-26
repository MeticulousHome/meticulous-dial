// .free-pour-rail-point: a 16 px dot (3 px #687370 ring on #050908) with its start time under it, centered
// on the rail plus `offset`. kind: default | past (filled grey) | active / due (white with a 7 px halo) |
// cue (free-pour-cue-flash: white for 0.5 s, plain for 0.5 s, five times, then plain).
import QtQuick
import Dial

Item {
    id: point
    property real offset: 0
    property string kind: "default"
    property string label: ""

    property bool cueBright: false
    readonly property bool bright: kind === "active" || kind === "due" || (kind === "cue" && cueBright)

    x: 232 + offset
    width: 16
    height: 48

    Rectangle {
        visible: point.bright
        x: -7
        y: -7
        width: 30
        height: 30
        radius: 15
        antialiasing: true
        color: Theme.alpha(Theme.pourText, 0.12)
    }
    Rectangle {
        width: 16
        height: 16
        radius: 8
        antialiasing: true
        color: point.bright ? Theme.pourText : point.kind === "past" ? Theme.pourRing : Theme.pourHollow
        border.width: 3
        border.color: point.bright ? Theme.pourText : Theme.pourRing
    }
    FpText {
        visible: point.label.length > 0
        x: 8 - width / 2
        y: 16 + 9
        width: implicitWidth
        mono: true
        font.pixelSize: 12
        color: Theme.pourMuted
        text: point.label
    }

    SequentialAnimation {
        id: flash
        loops: 5
        PropertyAction { target: point; property: "cueBright"; value: true }
        PauseAnimation { duration: 500 }
        PropertyAction { target: point; property: "cueBright"; value: false }
        PauseAnimation { duration: 500 }
    }
    function syncCue() {
        if (kind === "cue") {
            if (!flash.running) flash.restart()
        } else {
            flash.stop()
            cueBright = false
        }
    }
    onKindChanged: syncCue()
    Component.onCompleted: syncCue()
}
