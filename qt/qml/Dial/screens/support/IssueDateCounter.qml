// One field of the bug report's issue date (BugReport.tsx's IssueDateCounter and IssueDateParts,
// bugReport.css): an 8 px label above the digits, ABC Diatype Mono Light 38 px with -0.02em letter-spacing,
// in a box padded 0 3 10 whose bottom holds the active field's 2 px yellow underline (opacity 150 ms ease).
//
// Editable fields roll their digits like react-animated-counter 1.9: one column of 9..0 per digit on a
// spring (stiffness 328, damping 22, mass 0.84; a retarget keeps half the velocity), and a changed digit
// pulses: 500 ms keyframes inherit -> #f5c444 -> inherit, cubic-bezier(0.4, 0, 0.6, 1). The digits are
// #E6E6E6, yellow in the active field (160 ms color transition); a padded field draws its leading zero
// beside the counter. A read-only field (the report setup summary) is the same box with plain text.
import QtQuick
import Dial

Item {
    id: field
    property string label: ""
    property int value: 0
    property bool pad: false
    property bool active: false
    property bool readOnly: false
    property string textValue: ""
    // The most digits the value can have (the year: 4).
    property int maxDigits: 2

    readonly property color activeColor: "#f5c444"
    readonly property color inactiveColor: "#E6E6E6"
    readonly property real fontSize: 38
    readonly property real letterSpacing: -0.02 * fontSize
    readonly property real digitWidth: zeroMetrics.advanceWidth("0") + letterSpacing
    readonly property string digits: String(Math.max(value, 0))
    readonly property bool showPad: pad && value < 10

    readonly property real fieldWidth: readOnly ? staticText.implicitWidth + 6
                                                : (showPad ? digitWidth : 0) + digits.length * digitWidth + 6
    width: Math.max(fieldWidth, labelText.implicitWidth)
    height: 60

    FontMetrics {
        id: zeroMetrics
        font.family: Theme.fontMono
        font.weight: Font.Light
        font.pixelSize: field.fontSize
    }
    // 8 px mono 400, 0.14em letter-spacing, upper case, #808080, line-height 1, 4 px under it.
    CssText {
        id: labelText
        anchors.horizontalCenter: parent.horizontalCenter
        text: field.label
        color: "#808080"
        font.family: Theme.fontMono
        font.pixelSize: 8
        font.letterSpacing: 1.12
        font.capitalization: Font.AllUppercase
        cssLineHeight: 8
    }

    Item {
        id: box
        y: 12
        width: field.fieldWidth
        height: 48
        anchors.horizontalCenter: parent.horizontalCenter

        CssText {
            id: staticText
            visible: field.readOnly
            x: 3
            text: field.textValue
            color: "white"
            font.family: Theme.fontMono
            font.weight: Font.Light
            font.pixelSize: field.fontSize
            font.letterSpacing: field.letterSpacing
            cssLineHeight: 38
        }

        // The leading zero of a padded field (a plain span: white, yellow when active, no transition).
        CssText {
            visible: !field.readOnly && field.showPad
            x: 3
            text: "0"
            color: field.active ? field.activeColor : "white"
            font.family: Theme.fontMono
            font.weight: Font.Light
            font.pixelSize: field.fontSize
            font.letterSpacing: field.letterSpacing
            cssLineHeight: 38
        }

        // The ticker: overflow hidden, 38 px tall; columns by place value, keyed from the units up like
        // the React list (so the units column survives 9 -> 10).
        Item {
            visible: !field.readOnly
            x: 3 + (field.showPad ? field.digitWidth : 0)
            width: field.digits.length * field.digitWidth
            height: 38
            clip: true
            Repeater {
                model: field.readOnly ? 0 : field.maxDigits
                DigitColumn {
                    visible: present
                    x: (field.digits.length - 1 - index) * field.digitWidth
                    digit: present ? Number(field.digits[field.digits.length - 1 - index]) : 0
                }
            }
        }

        // ::after: the active field's underline, left / right 3 px.
        Rectangle {
            x: 3
            y: 46
            width: box.width - 6
            height: 2
            color: field.activeColor
            opacity: field.active && !field.readOnly ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
        }
    }

    // The value before this change, for the pulse's direction (AnimatedCounter's delta): updated after
    // the change has reached the columns.
    property int _lastValue: 0
    Component.onCompleted: _lastValue = value
    onValueChanged: Qt.callLater(_syncLast)
    function _syncLast() { _lastValue = value }
    function delta() { return value > _lastValue ? "increase" : value < _lastValue ? "decrease" : "" }

    component DigitColumn: Item {
        id: column
        // index 0 is the units digit
        required property int index
        readonly property bool present: index < field.digits.length
        property int digit: 0
        width: field.digitWidth
        height: 38

        // ---- the spring (y measured as the column's translateY: fontSize * digit at rest)
        readonly property real k: 328
        readonly property real c: 22
        readonly property real m: 0.84
        readonly property real w0: Math.sqrt(k / m)
        readonly property real zeta: c / (2 * Math.sqrt(k * m))
        readonly property real wd: w0 * Math.sqrt(1 - zeta * zeta)
        property real target: digit * field.fontSize
        property real y0: target
        property real v0: 0
        property real t: 0
        property bool hydrated: false
        readonly property real decay: Math.exp(-zeta * w0 * t)
        readonly property real coefB: (v0 + zeta * w0 * y0) / wd
        readonly property real pos: target + decay * (y0 * Math.cos(wd * t) + coefB * Math.sin(wd * t))
        function velocity() {
            const A = y0, B = coefB
            return decay * ((-zeta * w0 * A + wd * B) * Math.cos(wd * t) + (-zeta * w0 * B - wd * A) * Math.sin(wd * t))
        }

        NumberAnimation {
            id: spring
            target: column
            property: "t"
            from: 0
            easing.type: Easing.Linear
            onFinished: {
                column.y0 = 0
                column.v0 = 0
                column.t = 0
                column.pulseClass = ""     // onSettled clears the animation class
            }
        }

        // A column that appears (9 -> 10) mounts at rest, as a new React column does.
        property bool wasPresent: false
        function snap() {
            spring.stop()
            target = digit * field.fontSize
            y0 = 0
            v0 = 0
            t = 0
            pulseClass = ""
        }
        onPresentChanged: {
            if (present && !wasPresent) { snap(); wasPresent = true }
            else if (!present) wasPresent = false
        }
        onDigitChanged: {
            if (!hydrated) return
            const nowPresent = index < field.digits.length
            if (!wasPresent || !nowPresent) {
                snap()
                wasPresent = nowPresent
                return
            }
            // Retarget from where the column is, with half its velocity.
            const current = spring.running ? pos : target
            const v = spring.running ? velocity() * 0.5 : 0
            const newTarget = digit * field.fontSize
            spring.stop()
            y0 = current - newTarget
            v0 = v
            t = 0
            target = newTarget
            const amp = Math.abs(y0) + Math.abs(v0) / wd
            const seconds = amp > 0.05 ? Math.log(amp / 0.05) / (zeta * w0) : 0
            spring.to = seconds
            spring.duration = Math.round(seconds * 1000)
            if (seconds > 0) spring.start()
            const delta = field.delta()
            if (delta !== pulseClass) {
                pulseClass = delta
                if (delta) pulse.restart()
            }
        }
        Component.onCompleted: {
            target = digit * field.fontSize
            y0 = 0
            wasPresent = present
            hydrated = true
        }

        // ---- color: static (with the 160 ms transition) or the pulse keyframes
        property string pulseClass: ""
        property real pulseProgress: 1
        readonly property color staticColor: field.active ? field.activeColor : field.inactiveColor
        property color shownStatic: staticColor
        Behavior on shownStatic { ColorAnimation { duration: 160; easing.type: Easing.Bezier; easing.bezierCurve: [0.4, 0, 0.6, 1, 1, 1] } }
        NumberAnimation {
            id: pulse
            target: column
            property: "pulseProgress"
            from: 0
            to: 1
            duration: 500
        }
        function ease(x) {
            // cubic-bezier(0.4, 0, 0.6, 1) per keyframe interval (Newton on x)
            let u = x
            for (let i = 0; i < 6; i++) {
                const bx = 3 * (1 - u) * (1 - u) * u * 0.4 + 3 * (1 - u) * u * u * 0.6 + u * u * u - x
                const dx = 3 * (1 - u) * (1 - u) * 0.4 + 6 * (1 - u) * u * (0.6 - 0.4) + 3 * u * u * (1 - 0.6)
                if (Math.abs(dx) < 1e-6) break
                u = Math.min(1, Math.max(0, u - bx / dx))
            }
            return 3 * (1 - u) * u * u + u * u * u
        }
        readonly property color digitColor: {
            if (!pulse.running) return shownStatic
            const p = pulseProgress
            const k = p < 0.5 ? ease(p / 0.5) : 1 - ease((p - 0.5) / 0.5)
            // `inherit`: the column's own color, #E6E6E6
            return Qt.rgba(field.inactiveColor.r + (field.activeColor.r - field.inactiveColor.r) * k,
                           field.inactiveColor.g + (field.activeColor.g - field.inactiveColor.g) * k,
                           field.inactiveColor.b + (field.activeColor.b - field.inactiveColor.b) * k, 1)
        }

        // The column of digits 9..0, one 38 px line each: bottom: 0 of the 38 px container (9 at the top),
        // moved down by translateY.
        CssText {
            y: 38 - 380 + column.pos
            width: field.digitWidth
            text: "9\n8\n7\n6\n5\n4\n3\n2\n1\n0"
            color: column.digitColor
            font.family: Theme.fontMono
            font.weight: Font.Light
            font.pixelSize: field.fontSize
            font.letterSpacing: field.letterSpacing
            cssLineHeight: 38
        }
    }
}
