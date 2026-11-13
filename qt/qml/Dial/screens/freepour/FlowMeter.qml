// FlowMeter (FreePourScreen.tsx) / .free-pour-flow-meter: "FLOW · N g/s", ten 14 px segments filling with
// the live flow (0-10 g/s, data blue), a white tick at the profile's target flow, and the 0-10+ axis.
import QtQuick
import Dial
import "Format.js" as Format
import "Css.js" as Css

Item {
    id: meter
    property real flow: 0
    property var target: undefined           // g/s, or undefined without a profile target

    readonly property real displayedFlow: Format.clamp(flow, 0, 10)
    readonly property string flowLabel: flow > 10 ? "10+" : Math.round(displayedFlow).toString()
    readonly property bool hasTarget: target !== undefined && target !== null
    readonly property real displayedTarget: hasTarget ? Format.clamp(target, 0, 10) : 0

    // title line + 10 + 14 segments + 7 + 12 axis
    readonly property real titleHeight: 15 * Css.DIATYPE_NORMAL
    readonly property real segmentsY: titleHeight + 10
    readonly property real segmentWidth: (298 - 9 * 5) / 10

    width: 298
    height: segmentsY + 14 + 7 + 12

    Row {
        anchors.horizontalCenter: parent.horizontalCenter
        FpText {
            width: implicitWidth
            cssWeight: 650
            font.pixelSize: 15
            letterSpacingPx: 2.2
            color: "#8d9694"
            text: "FLOW · "
        }
        FpText {
            width: implicitWidth
            cssWeight: 650
            font.pixelSize: 15
            letterSpacingPx: 2.2
            text: meter.flowLabel + " g/s"
        }
    }

    Repeater {
        model: 10
        Rectangle {
            required property int index
            x: index * (meter.segmentWidth + 5)
            y: meter.segmentsY
            width: meter.segmentWidth
            height: 14
            radius: 7
            antialiasing: true
            color: "#25312f"
            Rectangle {
                readonly property real fill: Format.clamp(meter.displayedFlow - parent.index, 0, 1) * parent.width
                visible: fill > 0
                width: fill
                height: 14
                radius: Math.min(7, fill / 2)
                antialiasing: true
                color: Theme.dataBlueLight
            }
        }
    }
    Rectangle {
        visible: meter.hasTarget
        z: 5
        x: meter.displayedTarget * 29.8 - 1
        y: meter.segmentsY - 7
        width: 3
        height: 28
        radius: 2
        antialiasing: true
        color: "#e7e3da"
    }

    // .free-pour-flow-axis: justify-content: space-between.
    TextMetrics { id: digit; font.family: Theme.fontMono; font.pixelSize: 12; text: "0" }
    TextMetrics { id: tenPlus; font.family: Theme.fontMono; font.pixelSize: 12; text: "10+" }
    Row {
        y: meter.segmentsY + 14 + 7
        spacing: (298 - 10 * digit.advanceWidth - tenPlus.advanceWidth) / 10
        Repeater {
            model: 11
            FpText {
                required property int index
                width: implicitWidth
                mono: true
                font.pixelSize: 12
                color: "#8d9694"
                text: index === 10 ? "10+" : String(index)
            }
        }
    }
}
