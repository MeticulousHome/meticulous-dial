// AnimatedCounter of react-animated-counter 1.9 (no decimals), as the heating temperature uses it: one
// column of the digits 9..0 per digit, `fontSize` apart, clipped to one digit and moved by a spring
// (stiffness 328, damping 22, mass 0.84, stepped per frame like useSpringColumnTransform; a new target
// halves the velocity). Columns are kept by position from the right, so 99 -> 100 rolls the two last
// digits and the new one appears in place. The increment/decrement colour pulse is the text colour here
// (the heating screen passes the same colour), so it is not drawn.
import QtQuick
import Dial

Item {
    id: counter
    property real value: 0
    property real fontSize: 60
    property string fontFamily: Theme.fontMono
    property int fontWeight: Font.Light
    property real letterSpacing: -0.02 * fontSize
    property color color: "#e7e7e7"

    // formatForDisplay(Math.abs(value), false): the digits, units last.
    readonly property string digits: Math.max(Math.abs(value), 0).toFixed(0)
    readonly property bool negative: value < 0
    readonly property real columnWidth: zero.advanceWidth + letterSpacing
    readonly property int maxColumns: 6

    implicitWidth: digits.length * columnWidth + (negative ? minus.implicitWidth + fontSize / 5 : 0)
    implicitHeight: fontSize
    width: implicitWidth
    height: implicitHeight
    clip: true

    TextMetrics {
        id: zero
        text: "0"
        font.family: counter.fontFamily
        font.weight: counter.fontWeight
        font.pixelSize: counter.fontSize
    }

    Text {
        id: minus
        visible: counter.negative
        height: counter.fontSize
        verticalAlignment: Text.AlignVCenter
        text: "-"
        color: counter.color
        font.family: counter.fontFamily
        font.weight: counter.fontWeight
        font.pixelSize: counter.fontSize
        font.letterSpacing: counter.letterSpacing
    }

    Repeater {
        model: counter.maxColumns
        delegate: Item {
            id: column
            required property int index      // 0: units
            readonly property bool shown: index < counter.digits.length
            readonly property int digit: shown ? Number(counter.digits[counter.digits.length - 1 - index]) : 0
            readonly property real target: counter.fontSize * digit
            property real pos: target
            property real vel: 0
            property bool fresh: true

            visible: shown
            x: (counter.negative ? minus.implicitWidth + counter.fontSize / 5 : 0) + (counter.digits.length - 1 - index) * counter.columnWidth
            width: counter.columnWidth
            height: counter.fontSize

            // A column that appears starts at its digit (React mounts it there).
            onShownChanged: if (shown) { pos = target; vel = 0 }
            onTargetChanged: {
                if (!shown) { pos = target; return }
                vel *= 0.5
                spring.first = true
            }

            Column {
                // .ticker-column: 10 digits tall, its bottom on the box's bottom, moved down by pos.
                y: counter.fontSize - 10 * counter.fontSize + column.pos
                Repeater {
                    model: 10
                    delegate: Text {
                        required property int index
                        width: column.width
                        height: counter.fontSize
                        verticalAlignment: Text.AlignVCenter
                        text: String(9 - index)
                        color: counter.color
                        font.family: counter.fontFamily
                        font.weight: counter.fontWeight
                        font.pixelSize: counter.fontSize
                        font.letterSpacing: counter.letterSpacing
                    }
                }
            }

            FrameAnimation {
                id: spring
                property bool first: true
                running: column.shown && column.visible && (Math.abs(column.target - column.pos) >= 0.08 || Math.abs(column.vel) >= 0.08)
                onRunningChanged: first = true
                onTriggered: {
                    let dt = first ? 1 / 60 : frameTime
                    first = false
                    dt = Math.min(dt, 1 / 30)
                    let x = column.pos, v = column.vel
                    const steps = Math.min(6, Math.max(1, Math.ceil(dt * 90)))
                    const subDt = dt / steps
                    for (let s = 0; s < steps; s++) {
                        const a = (328 * (column.target - x) - 22 * v) / 0.84
                        v += a * subDt
                        x += v * subDt
                    }
                    if (Math.abs(column.target - x) < 0.08 && Math.abs(v) < 0.08) {
                        x = column.target
                        v = 0
                    }
                    column.vel = v
                    column.pos = x
                }
            }
        }
    }
}
