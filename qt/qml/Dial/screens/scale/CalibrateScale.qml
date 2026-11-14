// Calibrate scale (src/components/Scale/CalibrateScale.tsx): "set zero" over the empty drip tray; a single
// tare ("set zero" done) puts the 500 g weight on the tray and offers "calibrate", greyed out unless the
// scale reads 470-530 g; a press then sends the socket "calibrate" event, shows "done" and goes home after
// 5 s. A double press goes home. On this screen the scale overlay stays closed and a tare press tares.
//
// The transitions run 0.5 s (ease) after a 0.8 s delay, as the styled components' transitions do. The
// weight's blurred shadow and the blurred veil over the tray's back are CSS / SVG filters, drawn into PNGs
// by the browser (icons/idle-scale-weight.png, idle-scale-overlay.png with a 40 px margin).
//
// Text: 'ABC Diatype' places its baseline with the hhea metrics (0.85 / 0.15 em, rounded to pixels) in the
// browser; Qt measures it with others, so each text is put on the browser's baseline.
import QtQuick
import Dial

Item {
    id: calibrate
    anchors.fill: parent

    property bool transitioning: false

    // 470 g - 530 g is the range allowed for calibration in acaia scales
    readonly property int lowerRangeAllowed: 470
    readonly property int upperRangeAllowed: 530

    readonly property real weight: Math.round(Stats.sensors.w)
    readonly property string formattedWeight: formatWeight(weight)
    property bool isTaring: false
    property bool isCalibrated: false

    readonly property bool notAllowCalibrate: weight <= 0 || weight < lowerRangeAllowed || weight > upperRangeAllowed

    function pad3(s) { return s.length >= 3 ? s : "000".slice(s.length) + s }
    function formatWeight(w) {
        if (w < 0) return "-" + pad3(Math.abs(w).toString())
        return pad3(w.toString())
    }

    Timer {
        interval: 5000
        running: calibrate.isCalibrated
        onTriggered: {
            Nav.closeBubble()
            Nav.setScreen("profileHome")
        }
    }

    GestureHandler {
        onSingleTare: calibrate.isTaring = true
        onDoubleClick: {
            Nav.closeBubble()
            Nav.setScreen("profileHome")
        }
        onPressDown: {
            if (calibrate.notAllowCalibrate) return
            Backend.emitEvent("calibrate", "")
            calibrate.isCalibrated = true
        }
    }

    // The browser's baseline for 'ABC Diatype' at `px`: ascent round(0.85 px), descent round(0.15 px).
    function diatypeAscent(px) { return Math.round(0.85 * px) }
    function diatypeLine(px) { return Math.round(0.85 * px) + Math.round(0.15 * px) }

    FontMetrics { id: title16; font.family: Theme.fontRegular; font.pixelSize: 16 }
    FontMetrics { id: label25; font.family: Theme.fontRegular; font.pixelSize: 25 }
    FontMetrics { id: grams38; font.family: Theme.fontThin; font.pixelSize: 38 }

    component Delayed: SequentialAnimation {
        PauseAnimation { duration: 800 }
        NumberAnimation { duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
    }

    // Title: the pill at the top, 16 px, letter-spacing 3.2 px, upper case, 80 % white.
    Rectangle {
        id: titlePill
        width: titleText.implicitWidth + 2 * 16 + 2
        height: 22.4 + 2
        x: (480 - width) / 2
        y: 60
        radius: Math.min(30, height / 2)
        color: "transparent"
        border.color: "#5d5d5d"
        border.width: 1
        Text {
            id: titleText
            x: 1 + 16
            // line-height 1.4: 22.4 px line box under the 1 px border
            y: 1 + (22.4 - calibrate.diatypeLine(16)) / 2 + calibrate.diatypeAscent(16) - title16.ascent
            text: "calibrate scale"
            color: Qt.rgba(1, 1, 1, 0.8)
            font.family: Theme.fontRegular
            font.pixelSize: 16
            font.letterSpacing: 3.2
            font.capitalization: Font.AllUppercase
        }
    }

    // VerticalWrapper: 60 % of the width (288 px) from x 96; the absolutely placed parts center in it.
    // DripTrayContainer (z-index -10: under the veil and the weight)
    Image {
        x: 96 + (288 - 277) / 2
        y: calibrate.isTaring ? 190 : 170
        width: 277
        height: 277 * 120 / 281
        sourceSize: Qt.size(277, 277 * 120 / 281)
        source: Theme.asset("icons/idle-scale-drip-tray.svg")
        smooth: true
        Behavior on y { Delayed {} }
    }
    // Overlay: 277 x 50 black veil (blur 10 px)
    Image {
        x: 96 + (288 - 277) / 2 - 40
        y: (calibrate.isTaring ? 165 : 140) - 40
        width: 357
        height: 130
        source: Theme.asset("icons/idle-scale-overlay.png")
        Behavior on y { Delayed {} }
    }
    // WeightContainer: 160 px wide (the 158 x 161 weight)
    Image {
        x: 96 + (288 - 160) / 2
        y: calibrate.isTaring ? 108 : 60
        width: 158
        height: 161
        source: Theme.asset("icons/idle-scale-weight.png")
        opacity: calibrate.isTaring ? 1 : 0
        visible: opacity > 0
        Behavior on y { Delayed {} }
        Behavior on opacity { Delayed {} }
    }

    // BottomStatus: 70 px from the bottom, a column (16 px gap) of the grams (47 px) and the label (25 px).
    Text {
        id: grams
        x: (480 - implicitWidth) / 2
        y: 322 + Math.round(grams38.ascent) - grams38.ascent
        text: calibrate.formattedWeight + "g"
        color: "#0866ff"
        font.family: Theme.fontThin
        font.pixelSize: 38
        font.letterSpacing: 7.6
    }

    // Label: 25 px, letter-spacing 5 px, upper case; each text centered, padding 4 px 8 px.
    component LabelText: Item {
        id: labelText
        property string text
        property bool show: false
        property bool bordered: false
        property color color: "white"
        readonly property real border: bordered ? 1 : 0
        width: label.implicitWidth + 16 + 2 * border
        height: 25 + 8 + 2 * border
        x: (480 - width) / 2
        y: 385
        opacity: show ? 1 : 0
        visible: opacity > 0
        Behavior on opacity { Delayed {} }
        Rectangle {
            visible: labelText.bordered
            anchors.fill: parent
            radius: 12
            color: "transparent"
            border.width: 1
            border.color: labelText.color
        }
        Text {
            id: label
            x: labelText.border + 8
            y: labelText.border + 4 + calibrate.diatypeAscent(25) - label25.ascent
            text: labelText.text
            color: labelText.color
            font.family: Theme.fontRegular
            font.pixelSize: 25
            font.letterSpacing: 5
            font.capitalization: Font.AllUppercase
        }
    }
    LabelText {
        text: "set zero"
        show: !calibrate.isTaring && !calibrate.isCalibrated
    }
    LabelText {
        text: "calibrate"
        show: calibrate.isTaring && !calibrate.isCalibrated
        bordered: true
        color: calibrate.notAllowCalibrate ? Qt.rgba(1, 1, 1, 0.3) : "white"
    }
    LabelText {
        text: "done"
        show: calibrate.isCalibrated
    }

    readonly property string dialProbe_calibrateState: isCalibrated ? "done" : isTaring ? "calibrate" : "set zero"
    readonly property bool dialProbe_calibrateAllowed: !notAllowCalibrate
}
