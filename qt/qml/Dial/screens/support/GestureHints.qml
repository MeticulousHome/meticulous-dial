// The gesture hints grid (.bug-report-gesture-hints / .report-contact-hints): three columns 1fr auto 1fr
// with 10 px between them, the input right-aligned, a round dot, the action left-aligned; 14 px upper case
// with 0.08em letter-spacing. hints: [{ input, action }].
import QtQuick
import Dial

Item {
    id: grid
    property var hints: []
    property color inputColor: "#e0dcd0"
    property color dotColor: "#5e5e5e"
    property real dotSize: 3
    property real rowGap: 7

    readonly property real rowHeight: 14
    property real columnWidth: 0
    width: 2 * columnWidth + dotSize + 20
    height: hints.length ? hints.length * rowHeight + (hints.length - 1) * rowGap : 0

    function measure() {
        let w = 0
        for (let i = 0; i < inputs.count; i++) {
            if (inputs.itemAt(i)) w = Math.max(w, inputs.itemAt(i).implicitWidth)
            if (actions.itemAt(i)) w = Math.max(w, actions.itemAt(i).implicitWidth)
        }
        columnWidth = w
    }

    Repeater {
        id: inputs
        model: grid.hints.length
        CssText {
            required property int index
            x: grid.columnWidth - implicitWidth
            y: index * (grid.rowHeight + grid.rowGap)
            text: grid.hints[index].input
            color: grid.inputColor
            font.pixelSize: 14
            font.letterSpacing: 1.12
            font.capitalization: Font.AllUppercase
            onImplicitWidthChanged: Qt.callLater(grid.measure)
        }
    }
    Repeater {
        model: grid.hints.length
        Rectangle {
            required property int index
            x: grid.columnWidth + 10
            y: index * (grid.rowHeight + grid.rowGap) + (grid.rowHeight - grid.dotSize) / 2
            width: grid.dotSize
            height: grid.dotSize
            radius: grid.dotSize / 2
            color: grid.dotColor
        }
    }
    Repeater {
        id: actions
        model: grid.hints.length
        CssText {
            required property int index
            x: grid.columnWidth + 20 + grid.dotSize
            y: index * (grid.rowHeight + grid.rowGap)
            text: grid.hints[index].action
            color: "#808080"
            font.pixelSize: 14
            font.letterSpacing: 1.12
            font.capitalization: Font.AllUppercase
            onImplicitWidthChanged: Qt.callLater(grid.measure)
        }
    }
    Component.onCompleted: measure()
    onHintsChanged: Qt.callLater(measure)
}
