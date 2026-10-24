// AnimatedCounter of react-animated-counter 1.9 (as TimeConfig and DateConfig use it: no decimals): one
// column of the digits 9..0 per digit of the value, right-aligned in at least minWidth (the ticker view is
// a row-reverse flex box), each column springing to its digit (stiffness 328, damping 22, mass 0.84,
// integrated per frame like useSpringColumnTransform, half the velocity kept on a retarget). A column whose
// digit changes pulses its digits to incrementColor / decrementColor and back in 500 ms
// (cubic-bezier(0.4, 0, 0.6, 1)), once until its spring settles. `forcedColor` is the .activeClock rule
// (`.activeClock span { color }`), which the pulse overrides while it runs, as a CSS animation does.
import QtQuick
import Dial

Item {
    id: counter
    property int value: 0
    property real fontSize: 110
    property color color: "black"
    property color incrementColor: "#32cd32"
    property color decrementColor: "#fe6862"
    property color forcedColor: "transparent"
    property bool forced: false
    property real minWidth: 0
    property int maxDigits: 4

    // formatForDisplay: the digits, units first.
    readonly property var digits: String(Math.max(value, 0).toFixed(0)).split("").reverse()
    property int previousValue: value
    property string delta: ""
    onValueChanged: {
        delta = value > previousValue ? "increase" : value < previousValue ? "decrease" : ""
        previousValue = value
    }

    FontMetrics {
        id: metrics
        font.family: Theme.fontMono
        font.weight: Font.Light
        font.pixelSize: counter.fontSize
    }
    // A digit's advance with the -0.02em letter spacing.
    readonly property real columnWidth: metrics.advanceWidth("0") - 0.02 * fontSize

    implicitWidth: Math.max(minWidth, digits.length * columnWidth)
    implicitHeight: fontSize
    clip: true

    property color digitColor: forced ? forcedColor : color
    Behavior on digitColor { ColorAnimation { duration: 160; easing.type: Easing.Bezier; easing.bezierCurve: [0.4, 0, 0.6, 1, 1, 1] } }

    Repeater {
        model: counter.maxDigits
        delegate: Item {
            id: column
            required property int index
            readonly property bool present: index < counter.digits.length
            readonly property int digit: present ? parseInt(counter.digits[index], 10) : 0
            visible: present
            x: counter.width - (index + 1) * counter.columnWidth
            width: counter.columnWidth
            height: counter.fontSize

            // useSpringColumnTransform: pos is translateY of the 10-digit column (fontSize x digit at rest).
            property real pos: digit * counter.fontSize
            property real velocity: 0
            property real target: digit * counter.fontSize
            property bool pulsing: false     // the "increase" / "decrease" class is on
            property real pulse: 0           // 0..1 of the 500 ms keyframes
            property color pulseColor: counter.incrementColor

            onPresentChanged: {
                // A column that appears mounts at its digit, without animating.
                spring.stop()
                pos = target
                velocity = 0
            }
            onDigitChanged: {
                if (!present) return
                target = digit * counter.fontSize
                velocity *= 0.5
                spring.start()
                if (!pulsing && counter.delta !== "") {
                    pulsing = true
                    pulseColor = counter.delta === "increase" ? counter.incrementColor : counter.decrementColor
                    pulseAnimation.restart()
                }
            }

            FrameAnimation {
                id: spring
                onTriggered: {
                    let dt = Math.min(frameTime > 0 ? frameTime : 1 / 60, 1 / 30)
                    const steps = Math.min(6, Math.max(1, Math.ceil(dt * 90)))
                    const sub = dt / steps
                    let x = column.pos
                    let v = column.velocity
                    for (let s = 0; s < steps; s++) {
                        const a = (328 * (column.target - x) - 22 * v) / 0.84
                        v += a * sub
                        x += v * sub
                    }
                    if (Math.abs(column.target - x) < 0.08 && Math.abs(v) < 0.08) {
                        column.pos = column.target
                        column.velocity = 0
                        column.pulsing = false   // onSettled clears the animation class
                        stop()
                        return
                    }
                    column.pos = x
                    column.velocity = v
                }
            }
            NumberAnimation {
                id: pulseAnimation
                target: column
                property: "pulse"
                from: 0
                to: 1
                duration: 500
                easing.type: Easing.Bezier
                easing.bezierCurve: [0.4, 0, 0.6, 1, 1, 1]
            }
            // @keyframes pulseIncrement: inherit (the counter's colour) → the pulse colour at 50 % → inherit.
            readonly property bool pulseRunning: pulsing && pulseAnimation.running
            readonly property color shownColor: {
                if (!pulseRunning) return counter.digitColor
                const k = pulse < 0.5 ? pulse * 2 : (1 - pulse) * 2
                return Qt.rgba(counter.color.r + (pulseColor.r - counter.color.r) * k,
                               counter.color.g + (pulseColor.g - counter.color.g) * k,
                               counter.color.b + (pulseColor.b - counter.color.b) * k, 1)
            }

            Column {
                y: column.pos - 9 * counter.fontSize
                Repeater {
                    model: 10
                    delegate: Text {
                        required property int index
                        width: counter.columnWidth
                        height: counter.fontSize
                        text: String(9 - index)
                        color: column.shownColor
                        font.family: Theme.fontMono
                        font.weight: Font.Light
                        font.pixelSize: counter.fontSize
                        font.letterSpacing: -0.02 * counter.fontSize
                        lineHeight: counter.fontSize
                        lineHeightMode: Text.FixedHeight
                        verticalAlignment: Text.AlignVCenter
                    }
                }
            }
        }
    }
}
