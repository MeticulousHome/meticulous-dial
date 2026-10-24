// The gauge of src/components/SettingNumerical/Gauge.tsx (gauge.css), as RetractionVolume uses it: the value
// in ABC Diatype Mono 140 px, zero-padded to three digits with the padding at 20 % opacity, right-aligned
// in a 282 px box, the unit at its top right, and the ring: a grey full circle and the yellow value arc
// from 6 o'clock clockwise (SVG 460 px with viewBox -1 -2 480 480: r 237 → 227.1 px, centre 241 / 239).
import QtQuick
import Dial

Item {
    id: gauge
    anchors.fill: parent

    property real value: 0
    property real minValue: 0
    property real maxValue: 100
    property int precision: 0
    property string unit: "volume"

    readonly property var unitNames: ({ bar: "bar", celcius: "°C", gram: "g", sec: "s", ml: "ml/s",
                                        percentage: "%", min: "min", volume: "ml" })
    // .scale-<class> .scale-level margin-left (and margin-right 4 px for the flow scale).
    readonly property var levelMargins: ({ bar: 100, celcius: 100, gram: 88, sec: 100, ml: 70, volume: 70,
                                           percentage: 88, min: 100 })
    readonly property bool flowScale: unit === "ml" || unit === "volume"

    // formatValue + padLength of Gauge.tsx (minDigits 3).
    function addRightComplement(s) {
        // src/utils addRightComplement: one decimal always shown ("7" -> "7.0").
        return s.indexOf(".") < 0 ? s + ".0" : s
    }
    function roundPrecision(v, p) { const k = Math.pow(10, p); return Math.round(v * k) / k }
    readonly property string valueOnly: precision > 0 ? addRightComplement(String(roundPrecision(value, precision))) : String(value)
    readonly property string padded: valueOnly.padStart(3 + (precision > 0 ? 1 : 0), "0")
    readonly property int padLength: padded.length - (/^[0.]+$/.test(valueOnly) ? 0 : valueOnly.length)

    // getDashArray: the arc covers value / max of the circle (negative values: |value| / |min| at the end).
    readonly property real arcFraction: {
        if (value >= 0) return maxValue === 0 ? 0 : Math.min(value, maxValue) / maxValue
        return Math.abs(Math.max(value, minValue | 0)) / Math.abs(minValue)
    }

    readonly property real ringScale: 460 / 480
    readonly property real ringRadius: 237 * ringScale
    readonly property real ringCenterX: 10 + (240 + 1) * ringScale
    readonly property real ringCenterY: 10 + (237 + 2) * ringScale

    Arc {
        x: gauge.ringCenterX - width / 2
        y: gauge.ringCenterY - height / 2
        radius: gauge.ringRadius
        lineWidth: 3 * gauge.ringScale
        color: "#676767"
        sweep: 1
    }
    Arc {
        x: gauge.ringCenterX - width / 2
        y: gauge.ringCenterY - height / 2
        radius: gauge.ringRadius
        lineWidth: 3 * gauge.ringScale
        color: Theme.brandYellow
        sweep: gauge.arcFraction
        // A negative value fills the end of the circle (dasharray "0 space marc").
        startAngle: gauge.value >= 0 ? 0 : 360 * (1 - gauge.arcFraction)
    }

    // .scale-content: 104 px tall, centred; .scale-level line-height 96 px puts the 140 px em box at -22.4.
    Item {
        id: content
        y: (gauge.height - 104) / 2
        width: gauge.width
        height: 104

        Text {
            id: level
            x: gauge.levelMargins[gauge.unit] || 0
            y: (96 - 140) / 2
            width: 282
            height: 140
            horizontalAlignment: Text.AlignRight
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.StyledText
            text: "<font color='#33ffffff'>" + gauge.padded.substring(0, gauge.padLength) + "</font>"
                  + gauge.padded.substring(gauge.padLength)
            color: "white"
            font.family: Theme.fontMono
            font.pixelSize: 140
        }
        Text {
            x: level.x + 282 + (gauge.flowScale ? 4 : 0)
            y: 0
            text: gauge.unitNames[gauge.unit] || ""
            color: "white"
            font.family: Theme.fontRegular
            font.pixelSize: 24
            lineHeight: 20
            lineHeightMode: Text.FixedHeight
        }
    }
}
