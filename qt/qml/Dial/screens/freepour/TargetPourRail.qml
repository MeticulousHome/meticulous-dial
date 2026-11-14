// TargetPourRail (FreePourScreen.tsx): the profile's pours (at most five) 58 px apart around the center on
// the 224 px line, each with its target start time; past ones filled, the current one white while pouring
// or flashing / white as its start approaches (cue: idle | countdown | due).
import QtQuick
import "Format.js" as Format

Item {
    id: rail
    property var targets: []
    property int currentPour: 1
    property bool pouring: false
    property string cue: "idle"

    readonly property var visibleTargets: targets.slice(0, 5)
    readonly property real middle: (visibleTargets.length - 1) / 2

    y: 192
    width: 480
    height: 48

    Rectangle { x: 128; y: 7; width: 480 - 256; height: 2; color: "#34403e" }
    Repeater {
        model: rail.visibleTargets.length
        RailPoint {
            required property int index
            readonly property var target: rail.visibleTargets[index]
            readonly property bool past: target.number < rail.currentPour
            readonly property bool active: target.number === rail.currentPour
            offset: (index - rail.middle) * 58
            kind: past ? "past"
                : active && rail.pouring ? "active"
                : active && rail.cue === "countdown" ? "cue"
                : active && rail.cue === "due" ? "due" : "default"
            label: Format.formatBrewTime(target.startTimeMs)
        }
    }
}
