// SetupReadiness (FreePourScreen.tsx) / .free-pour-readiness: the 360 px state box under a setup weight,
// one line per " · " part of the message, Mono 13 px bold on yellow (waiting), green (ready), grey (busy)
// or red (error). Height: 9 + 8 px padding around the lines (1.35 line height, 2 px apart), at least 38.
import QtQuick

Item {
    id: readiness
    property bool ready: false
    property string status: "idle"            // SetupStatus
    property string waitingMessage: ""
    property string readyMessage: "WEIGHT STABLE · PRESS DIAL TO RECORD"

    readonly property string kind: status === "tare-timeout" ? "error"
                                 : status === "saving" || status === "taring" ? "busy"
                                 : ready ? "ready" : "waiting"
    readonly property string message: status === "saving" ? "KEEP SCALE STILL"
                                    : status === "taring" ? "WAITING FOR ZERO"
                                    : status === "tare-timeout" ? "TARE NOT CONFIRMED"
                                    : ready ? readyMessage : waitingMessage
    readonly property var lines: message.split(" · ")
    readonly property real lineHeight: 13 * 1.35

    x: 60
    width: 360
    height: Math.max(38, 9 + 8 + lines.length * lineHeight + (lines.length - 1) * 2)

    Rectangle {
        anchors.fill: parent
        radius: 8
        antialiasing: true
        color: readiness.kind === "error" ? "#efb2a4"
             : readiness.kind === "busy" ? "#d8d3c7"
             : readiness.kind === "ready" ? "#a9deb2" : "#f5dc91"
    }
    Repeater {
        model: readiness.lines.length
        FpText {
            required property int index
            x: 13
            y: 9 + index * (readiness.lineHeight + 2)
            width: readiness.width - 26
            lineHeightPx: readiness.lineHeight
            mono: true
            cssWeight: 700
            font.pixelSize: 13
            letterSpacingPx: 1.15
            color: "#17201d"
            text: readiness.lines[index] || ""
        }
    }
}
