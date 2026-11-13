// The numerical setting's gauge (src/components/SettingNumerical/Gauge.tsx, gauge.css): the value in 140 px
// mono digits padded with dim (20 %) zeros to three digits, right-aligned in a 282 px box, its unit 24 px at
// the box's top right; around it a grey ring and the yellow arc of value / maxValue from 6 o'clock clockwise
// (a negative value: of value / minValue, ending at 6 o'clock).
import QtQuick
import Dial

Item {
    id: gauge
    anchors.fill: parent

    property real value: 0
    property var minValue: undefined
    property real maxValue: 0
    property int precision: 0
    property string unit: "gram"

    readonly property var unitNameMap: ({ bar: "bar", celcius: "°C", gram: "g", sec: "s", ml: "ml/s", percentage: "%", min: "min", volume: "ml" })
    // .scale-<unit> .scale-level margins
    readonly property var unitClassName: ({ bar: "scale-pressure", celcius: "scale-temp", gram: "scale-weight-limit", sec: "scale-time",
                                            ml: "scale-flow", volume: "scale-flow", percentage: "scale-percentile", min: "scale-time" })
    readonly property var marginLeftMap: ({ "scale-pressure": 100, "scale-temp": 100, "scale-weight-limit": 88, "scale-percentile": 88,
                                            "scale-time": 100, "scale-flow": 70 })
    readonly property string scaleClass: unitClassName[unit] || ""
    readonly property real levelLeft: marginLeftMap[scaleClass] || 0
    readonly property real levelRight: scaleClass === "scale-flow" ? 4 : 0

    readonly property int minDigits: 3
    function roundPrecision(v, p) {
        const multiplier = Math.pow(10, p || 0)
        return Math.round(v * multiplier) / multiplier
    }
    function addRightComplement(v) { return v.indexOf(".") >= 0 ? v : v + ".0" }
    function formatValue(v, p) {
        const fractional = p > 0
        const valueOnly = fractional ? addRightComplement(roundPrecision(v, p).toString()) : v.toString()
        let padded = valueOnly
        const width = minDigits + (fractional ? 1 : 0)
        while (padded.length < width) padded = "0" + padded
        return { valueOnly: valueOnly, padded: padded }
    }
    readonly property var formatted: formatValue(value, precision)
    readonly property int padLength: formatted.padded.length - (/^[0.]+$/.test(formatted.valueOnly) ? 0 : formatted.valueOnly.length)
    readonly property string dimPart: formatted.padded.substring(0, padLength)
    readonly property string brightPart: formatted.padded.substring(padLength)

    // getDashArray as an arc: { start (degrees from 6 o'clock), sweep (0..1) }
    readonly property var arc: {
        if (value >= 0) {
            if (maxValue === 0) return { start: 0, sweep: 0 }
            return { start: 0, sweep: Math.min(value, maxValue) / maxValue }
        }
        const p = Math.abs(Math.max(value, minValue | 0)) / Math.abs(minValue)
        // Without a minimum p is NaN: the React dash array is then invalid and the stroke solid.
        if (isNaN(p)) return { start: 0, sweep: 1 }
        return { start: 360 * (1 - p), sweep: p }
    }

    // .scale-content: 104 px tall, centred; the level's line box 96 px (Chromium's mono metrics: ascent
    // 108 px, descent 32 px at 140 px), the unit's 20 px (ABC Diatype at 24 px: 20 + 4).
    readonly property real contentTop: (height - 104) / 2
    Row {
        x: gauge.levelLeft + 282 - width
        y: gauge.contentTop + (96 - 140) / 2 + Math.round(0.773 * 140) - dimText.baselineOffset
        Text {
            id: dimText
            text: gauge.dimPart
            opacity: 0.2
            color: "white"
            textFormat: Text.PlainText
            font.family: Theme.fontMono
            font.pixelSize: 140
        }
        Text {
            text: gauge.brightPart
            color: "white"
            textFormat: Text.PlainText
            font.family: Theme.fontMono
            font.pixelSize: 140
        }
    }
    Text {
        x: gauge.levelLeft + 282 + gauge.levelRight
        y: gauge.contentTop + (20 - 24) / 2 + Math.round(0.85 * 24) - baselineOffset
        text: gauge.unitNameMap[gauge.unit] || ""
        color: "white"
        textFormat: Text.PlainText
        font.family: Theme.fontRegular
        font.pixelSize: 24
    }

    // svg 460 x 460 (viewBox -1 -2 480 480) centred; the circles' centre (237, 234) turned 90° about
    // (237, 237): (240, 237) in the viewBox; r 237, stroke 3.
    readonly property real svgScale: 460 / 480
    readonly property real ringX: (width - 460) / 2 + (240 + 1) * svgScale
    readonly property real ringY: (height - 460) / 2 + (237 + 2) * svgScale
    Arc {
        x: gauge.ringX - width / 2
        y: gauge.ringY - height / 2
        radius: 237 * gauge.svgScale
        lineWidth: 3 * gauge.svgScale
        color: "#676767"
        sweep: gauge.maxValue === 0 ? 0 : 1
    }
    Arc {
        x: gauge.ringX - width / 2
        y: gauge.ringY - height / 2
        radius: 237 * gauge.svgScale
        lineWidth: 3 * gauge.svgScale
        color: Theme.brandYellow
        startAngle: gauge.arc.start
        sweep: gauge.arc.sweep
    }
}
