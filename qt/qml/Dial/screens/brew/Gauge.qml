// Gauge (src/components/SettingNumerical/Gauge.tsx, gauge.css), as HeatTimeoutAfterShot uses it: the value in
// ABC Diatype Mono 140 px (96 px line), right-aligned in a 282 px box after the unit class's margin, its
// leading zeros at 20 % opacity, the unit (24 px, 20 px line) after it; around it a grey ring and the
// yellow arc of value / maxValue from 6 o'clock clockwise (the SVG circle r 237, stroke 3, in a 460 px
// svg with viewBox -1 -2 480 480, rotated 90° about (237, 237)).
// (A copy for the brew group: the profile group ports the same component for SettingNumerical.)
import QtQuick
import Dial
import "BrewLogic.js" as Logic

Item {
    id: gauge
    anchors.fill: parent
    property real value: 0
    property real minValue: 0
    property real maxValue: 10
    property int precision: 0
    property string unit: "min"

    readonly property var unitNames: ({ bar: "bar", celcius: "°C", gram: "g", sec: "s", ml: "ml/s", percentage: "%", min: "min", volume: "ml" })
    // .scale-* margins of the value box
    readonly property var unitMargins: ({ bar: 100, celcius: 100, gram: 88, percentage: 88, sec: 100, min: 100, ml: 70, volume: 70 })
    readonly property var parts: Logic.gaugeParts(value, precision)

    // ---- the rings: 460 / 480 of the viewBox, its centre at (240, 237) once rotated
    readonly property real k: 460 / 480
    readonly property real cx: 10 + (240 + 1) * k
    readonly property real cy: 10 + (237 + 2) * k
    Arc {
        x: gauge.cx - width / 2
        y: gauge.cy - height / 2
        radius: 237 * gauge.k
        lineWidth: 3 * gauge.k
        color: "#676767"
        sweep: 1
    }
    Arc {
        x: gauge.cx - width / 2
        y: gauge.cy - height / 2
        radius: 237 * gauge.k
        lineWidth: 3 * gauge.k
        color: Theme.brandYellow
        // getDashArray: a negative value fills from the end (minValue); 0 draws nothing.
        sweep: gauge.value >= 0 ? (gauge.maxValue === 0 ? 0 : Math.min(gauge.value, gauge.maxValue) / gauge.maxValue)
                               : Math.abs(Math.max(gauge.value, gauge.minValue | 0)) / Math.abs(gauge.minValue)
        startAngle: gauge.value >= 0 ? 0 : 360 * (1 - sweep)
    }

    // ---- .scale-content: 104 px tall, vertically centered
    Item {
        y: (480 - 104) / 2
        width: 480
        height: 104
        Row {
            id: level
            x: (gauge.unitMargins[gauge.unit] || 100) + 282 - width
            height: 96
            Text {
                height: 96
                verticalAlignment: Text.AlignVCenter
                text: gauge.parts.dim
                opacity: 0.2
                color: "white"
                font.family: Theme.fontMono
                font.pixelSize: 140
            }
            Text {
                height: 96
                verticalAlignment: Text.AlignVCenter
                text: gauge.parts.bright
                color: "white"
                font.family: Theme.fontMono
                font.pixelSize: 140
            }
        }
        Text {
            x: (gauge.unitMargins[gauge.unit] || 100) + 282
            height: 20
            verticalAlignment: Text.AlignVCenter
            text: gauge.unitNames[gauge.unit] || gauge.unit
            color: "white"
            font.family: Theme.fontRegular
            font.pixelSize: 24
        }
    }
}
