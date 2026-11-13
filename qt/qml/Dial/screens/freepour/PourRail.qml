// PourRail (FreePourScreen.tsx): the Free Pour's pours so far. The last four finished pours sit 52 px apart
// left of the center, the pour in progress (or an open dot while waiting) at the center; after the fifth
// pour the five are centered on the shorter "complete" line.
import QtQuick
import "Format.js" as Format

Item {
    id: rail
    property var pours: []
    property var activePour: null            // { number, startTimeMs } | null
    property bool waiting: false

    readonly property bool maxedOut: !activePour && pours.length >= 5
    readonly property var completed: maxedOut ? pours.slice(-5) : pours.slice(-4)
    readonly property bool showOpenCenter: waiting && pours.length < 5
    readonly property int centerNumber: activePour ? activePour.number : Math.min(pours.length + 1, 5)

    y: 192
    width: 480
    height: 48

    Rectangle {
        x: rail.maxedOut ? 128 : 42
        y: 7
        width: rail.maxedOut ? 480 - 256 : 480 - 42 - 232
        height: 2
        color: "#34403e"
    }
    Repeater {
        model: rail.completed.length
        RailPoint {
            required property int index
            offset: rail.maxedOut ? (index - Math.floor(rail.completed.length / 2)) * 52
                                  : -(rail.completed.length - index) * 52
            kind: "past"
            label: Format.formatBrewTime(rail.completed[index].startTimeMs)
        }
    }
    RailPoint {
        visible: !!rail.activePour
        kind: "active"
        label: rail.activePour ? Format.formatBrewTime(rail.activePour.startTimeMs) : ""
    }
    RailPoint {
        visible: rail.showOpenCenter
    }
}
