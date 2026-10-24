// Gauge (src/components/SettingNumerical/Gauge.tsx, gauge.css) as the manual setup uses it: the value in
// ABC Diatype Mono 140 px, right-aligned in 282 px after a 100 px (°C) or 88 px (g) margin, its leading
// zeros at 20 %, the unit after it; and the 460 px ring around the screen, #676767 with the value's share in
// #F5C444 from 6 o'clock clockwise. (The profile group's SettingNumerical has its own copy.)
import QtQuick
import Dial
import "../freepour" as FreePour

Item {
    id: gauge
    anchors.fill: parent
    property real value: 0
    property real maxValue: 100
    property int precision: 1
    property string unit: "celcius"            // celcius | gram

    readonly property var unitNames: ({ bar: "bar", celcius: "°C", gram: "g", sec: "s", ml: "ml/s", percentage: "%", min: "min", volume: "ml" })
    readonly property var levelMargins: ({ bar: 100, celcius: 100, gram: 88, sec: 100, ml: 70, volume: 70, percentage: 88, min: 100 })

    // formatValue (Gauge.tsx): one decimal, padded to 3 digits with zeros shown dimmed.
    function roundPrecision(v, p) {
        const multiplier = Math.pow(10, p || 0)
        return Math.round(v * multiplier) / multiplier
    }
    readonly property string valueOnly: {
        if (precision <= 0) return String(value)
        const s = String(roundPrecision(value, precision))
        return s.indexOf(".") >= 0 ? s : s + ".0"
    }
    readonly property string padded: valueOnly.padStart(3 + (precision > 0 ? 1 : 0), "0")
    readonly property int padLength: padded.length - (/^[0.]+$/.test(valueOnly) ? 0 : valueOnly.length)

    // The SVG (460 px, viewBox -1 -2 480 480) centered: the circle (r 237 at 237,234, turned 90° about
    // 237,237) lands at 240.96, 239.04 with r 227.1 and a 2.9 px stroke.
    readonly property real ringScale: 460 / 480
    readonly property real ringCx: 10 + (240 + 1) * ringScale
    readonly property real ringCy: 10 + (237 + 2) * ringScale
    readonly property real ringRadius: 237 * ringScale
    readonly property real ringWidth: 3 * ringScale

    Arc {
        x: gauge.ringCx - width / 2
        y: gauge.ringCy - height / 2
        radius: gauge.ringRadius
        lineWidth: gauge.ringWidth
        color: "#676767"
        sweep: 1
    }
    Arc {
        x: gauge.ringCx - width / 2
        y: gauge.ringCy - height / 2
        radius: gauge.ringRadius
        lineWidth: gauge.ringWidth
        color: Theme.brandYellow
        sweep: gauge.maxValue === 0 || gauge.value < 0 ? 0 : Math.min(gauge.value, gauge.maxValue) / gauge.maxValue
    }

    // .scale-content: 104 px tall, centered; .scale-level line-height 96 px. Text wider than the 282 px box
    // (three digits and the point are 288 px) cannot be right-aligned: it starts at the box's left edge and
    // overflows to the right, under the unit.
    Row {
        id: level
        readonly property real leftEdge: gauge.levelMargins[gauge.unit] || 100
        readonly property real rightEdge: leftEdge + 282
        x: width > 282 ? leftEdge : rightEdge - width
        y: (480 - 104) / 2
        FreePour.FpText {
            width: implicitWidth
            mono: true
            tabular: false
            lineHeightPx: 96
            font.pixelSize: 140
            color: "white"
            opacity: 0.2
            text: gauge.padded.substring(0, gauge.padLength)
        }
        FreePour.FpText {
            width: implicitWidth
            mono: true
            tabular: false
            lineHeightPx: 96
            font.pixelSize: 140
            color: "white"
            text: gauge.padded.substring(gauge.padLength)
        }
    }
    FreePour.FpText {
        x: level.rightEdge
        y: (480 - 104) / 2
        width: implicitWidth
        tabular: false
        lineHeightPx: 20
        horizontalAlignment: Text.AlignLeft
        font.pixelSize: 24
        color: "white"
        text: gauge.unitNames[gauge.unit] || ""
    }
}
