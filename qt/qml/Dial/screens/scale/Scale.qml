// The scale overlay (src/components/Scale/Scale.tsx, scale.css), mounted once over everything by main.qml.
//   - single tare: opens the small scale at the bottom (a 360 x 245 #1b1b1b card, half of it on screen) and
//     tares, unless the scale was closed less than a minute ago ("hot": it only opens). Open, it tares.
//   - tare held 250 ms: opens the small scale and pulls it up 20 px for 0.7 s; at the end it grows to the
//     full screen (modal: main.qml disables the router and the bubble while `visibility` is "full").
//     Letting go during the pull springs it back.
//   - closes on a double tare, the context button, a press (small), click / double click / long press
//     (full, after the press's release), a shot starting, 10 s (small) or 20 min (full) without a weight
//     change over 2 g.
//   - on calibrateScale and the Free Pour screens it never opens; there a tare press tares.
// `visibility` ("closed" | "small" | "full") follows the state after the gesture that changed it has been
// delivered everywhere (React reports it from an effect after rendering): the press that dismisses the
// full scale never reaches the screen under it.
//
// The card's CSS transitions (scale.css: all 0.3 s ease) are one set of numbers animated together: the
// geometry from the small card (150 % wide, 250 px + 50 % padding, radius 52, #1b1b1b) to the full screen
// (#000), the scale (0.5 → 1), the vertical shift (17.5 % / 50 % / 75 % of the card's height) and the
// transform origin (bottom → middle). Opening and closing (react-transition-group, out-in) slide the card
// in from / out to translateY(50 %) (small) or translateY(75 %) scale(0.5) (full); a close that arrives
// while a closing slide runs lets it finish before the next opening.
import QtQuick
import Dial
import Dial.Native

Item {
    id: scale
    anchors.fill: parent

    // closed | small | full, for main.qml
    property string visibility: "closed"

    // scaleState: { status: closed_cold | closed_hot | open, size: small | full | "" }
    property string status: "closed_cold"
    property string size: ""

    readonly property var noScalePopUpScreens: ["calibrateScale", "freePour", "guidedPourOver", "freePourHistory"]
    readonly property int coolDownTimeMS: 1 * 60 * 1000
    readonly property int tareHoldThreshold: 250
    readonly property int largeScalePressThreshold: 700

    property bool encoderPressed: false
    property bool longEncoderPending: false
    property string currentAnimation: ""          // pull | springMini | ""
    property real lastSignificantWeight: 0
    property var emittedActions: []              // for the tests

    // ---- the state
    function setScaleState(newStatus, newSize) {
        status = newStatus
        size = newSize
        scaleStateChanged()
    }
    signal scaleStateChanged()

    function closeScale() {
        longEncoderPending = false
        // avoid setting the state to closed_hot if called from closed_*
        if (status === "open") {
            coolScaleTimer.restart()
            setScaleState("closed_hot", "")
            motion.pullY = 0
        }
    }
    function openScale(newSize) {
        longEncoderPending = false
        coolScaleTimer.stop()
        setScaleState("open", newSize)
    }
    function tare() {
        emittedActions = emittedActions.concat([["action", "tare"]])
        Backend.action("tare")
    }

    function publishVisibility() {
        visibility = status === "open" ? size : "closed"
    }

    // The [scaleState] effect: publish the visibility, restart the hide timer, watch the weight.
    onScaleStateChanged: {
        Qt.callLater(publishVisibility)
        hideTimer.interval = size === "small" ? 10000 : 2 * 60 * 10000
        hideTimer.restart()
        lastSignificantWeight = Stats.sensors.w
        syncCard()
    }
    Connections {
        target: Stats
        function onSensorsChanged() {
            const weight = Stats.sensors.w
            if (Math.abs(weight - scale.lastSignificantWeight) > 2) {
                scale.lastSignificantWeight = weight
                hideTimer.restart()
            }
        }
        function onExtractingChanged() {
            if (Stats.extracting && scale.status === "open") scale.closeScale()
        }
    }

    Timer {
        id: coolScaleTimer
        interval: scale.coolDownTimeMS
        onTriggered: scale.setScaleState("closed_cold", scale.size)
    }
    Timer {
        id: hideTimer
        interval: 10000
        onTriggered: scale.closeScale()
    }
    Timer {
        id: tareHoldThresholdTimer
        interval: scale.tareHoldThreshold
        // The scale state when the tare went down (the React closure).
        property string heldStatus: ""
        property string heldSize: ""
        onTriggered: {
            if (heldStatus !== "open") scale.openScale("small")
            if (heldStatus !== "open" || heldSize === "small") scale.startAnimation("pull")
        }
    }

    // ---- gestures
    GestureHandler {
        enabled: !(Stats.extracting || Nav.bubbleInterceptsGesture || scale.noScalePopUpScreens.indexOf(Nav.screen) >= 0)
        onPressDown: {
            scale.encoderPressed = true
            // A fresh press must not complete a long press whose release was lost.
            scale.longEncoderPending = false
            if (scale.size !== "full") scale.closeScale()
        }
        onPressUp: {
            scale.encoderPressed = false
            if (scale.longEncoderPending) scale.closeScale()
        }
        onClick: if (scale.size === "full") scale.closeScale()
        onDoubleClick: if (scale.size === "full") scale.closeScale()
        onLongEncoder: {
            if (scale.size !== "full") return
            // Unlike click/doubleClick, longEncoder can precede the raw release.
            // Keep the modal boundary until both have arrived, in either order.
            if (scale.encoderPressed) scale.longEncoderPending = true
            else scale.closeScale()
        }
        onTareDown: {
            hideTimer.stop()
            tareHoldThresholdTimer.heldStatus = scale.status
            tareHoldThresholdTimer.heldSize = scale.size
            tareHoldThresholdTimer.restart()
        }
        onTareUp: {
            tareHoldThresholdTimer.stop()
            // if we cancel the pull
            if (scale.currentAnimation === "pull") scale.startAnimation("springMini")
        }
        onSingleTare: {
            switch (scale.status) {
            case "closed_cold":
                scale.openScale("small")
                scale.tare()
                break
            case "open":
                scale.tare()
                break
            case "closed_hot":
                console.log("from from hot, opening mini scale")
                scale.openScale("small")
                break
            }
        }
        onDoubleTare: scale.closeScale()
        onContext: scale.closeScale()
    }
    // On the screens without the overlay a tare press tares right away.
    GestureHandler {
        enabled: !(Stats.extracting || Nav.bubbleInterceptsGesture || scale.noScalePopUpScreens.indexOf(Nav.screen) < 0)
        onTareDown: scale.tare()
    }

    // ---- the pull (motion.div y): 0 → -20 px in 0.7 s (easeIn), or a spring back to 0
    function bezierEaseIn(x) {
        // cubic-bezier(0.42, 0, 1, 1)
        if (x <= 0) return 0
        if (x >= 1) return 1
        const x1 = 0.42, x2 = 1, y1 = 0, y2 = 1
        const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
        const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
        let t = x
        for (let i = 0; i < 8; i++) {
            const fx = ((ax * t + bx) * t + cx) * t - x
            const d = (3 * ax * t + 2 * bx) * t + cx
            if (Math.abs(fx) < 1e-7 || Math.abs(d) < 1e-6) break
            t -= fx / d
        }
        t = Math.min(1, Math.max(0, t))
        return ((ay * t + by) * t + cy) * t
    }
    function pullVelocity() {
        // px / s of the running pull, for the spring's initial velocity (framer-motion keeps it)
        if (!pullAnimation.running) return 0
        const x = (Native.monotonicMs() - pullAnimation.startedAt) / scale.largeScalePressThreshold
        const d = 0.01
        return -20 * (bezierEaseIn(x + d) - bezierEaseIn(x - d)) / (2 * d) / (scale.largeScalePressThreshold / 1000)
    }
    function startAnimation(animation) {
        const velocity = pullVelocity()
        pullAnimation.stop()
        springAnimation.stop()
        console.log("animation: " + animation + " has started")
        currentAnimation = animation
        if (animation === "pull") {
            pullAnimation.from = motion.pullY
            pullAnimation.startedAt = Native.monotonicMs()
            pullAnimation.start()
        } else if (animation === "springMini") {
            springAnimation.u0 = motion.pullY
            springAnimation.v0 = velocity
            springAnimation.start()
        }
    }
    function handleAnimationComplete() {
        console.log("animation: " + currentAnimation + " has ended")
        motion.pullY = 0
        if (currentAnimation === "pull") {
            openScale("full")
            currentAnimation = ""
        }
    }
    NumberAnimation {
        id: pullAnimation
        property real startedAt: 0
        target: motion
        property: "pullY"
        to: -20
        duration: scale.largeScalePressThreshold
        easing.type: Easing.Bezier
        easing.bezierCurve: Motion.EASE_IN
        onFinished: scale.handleAnimationComplete()
    }
    // { type: 'spring', stiffness: 320, damping: 15 } from the current y and velocity to 0
    NumberAnimation {
        id: springAnimation
        property real u0: 0
        property real v0: 0
        readonly property real w0: Math.sqrt(320)
        readonly property real zeta: 15 / (2 * Math.sqrt(320))
        readonly property real wd: w0 * Math.sqrt(1 - zeta * zeta)
        readonly property real b: (v0 + zeta * w0 * u0) / wd
        readonly property real amplitude: Math.sqrt(u0 * u0 + b * b)
        // at rest: within 0.5 px and slower than 2 px/s (framer-motion's restDelta / restSpeed)
        readonly property real settle: amplitude <= 0.5 ? 0
            : Math.max(Math.log(amplitude / 0.5), Math.log(amplitude * w0 / 2)) / (zeta * w0)
        target: springAnimation
        property: "t"
        property real t: 0
        from: 0
        to: settle
        duration: Math.max(1, settle * 1000)
        onTChanged: if (running) motion.pullY = Math.exp(-zeta * w0 * t) * (u0 * Math.cos(wd * t) + b * Math.sin(wd * t))
        onFinished: scale.handleAnimationComplete()
    }

    // ---- the card
    // shown: mounted (open, or sliding out); shownSize: its class (it keeps the old one while sliding out).
    property bool shown: false
    property string shownSize: "small"
    property bool exiting: false
    property bool pendingEnter: false
    // geomE: 0 small card, 1 full screen; scaleS; tyFrac (of the card's height); originFrac (of its height)
    property real geomE: 0
    property real scaleS: 0.5
    property real tyFrac: 0.5
    property real originFrac: 1

    function cardTo(target, finish) {
        cardAnimation.stop()
        geomAnim.to = target.geomE
        scaleAnim.to = target.scaleS
        tyAnim.to = target.tyFrac
        originAnim.to = target.originFrac
        cardAnimation.doneCallback = finish || null
        cardAnimation.start()
    }
    readonly property var smallRest: ({ geomE: 0, scaleS: 0.5, tyFrac: 0.175, originFrac: 1 })
    readonly property var smallOut: ({ geomE: 0, scaleS: 0.5, tyFrac: 0.5, originFrac: 1 })
    readonly property var fullRest: ({ geomE: 1, scaleS: 1, tyFrac: 0, originFrac: 0.5 })
    readonly property var fullOut: ({ geomE: 1, scaleS: 0.5, tyFrac: 0.75, originFrac: 0.5 })

    function enter(newSize) {
        if (exiting) {
            pendingEnter = true
            return
        }
        const from = newSize === "full" ? fullOut : smallOut
        cardAnimation.stop()
        geomE = from.geomE
        scaleS = from.scaleS
        tyFrac = from.tyFrac
        originFrac = from.originFrac
        shownSize = newSize
        shown = true
        cardTo(newSize === "full" ? fullRest : smallRest)
    }
    function exit() {
        exiting = true
        cardTo(shownSize === "full" ? fullOut : smallOut, () => {
            scale.exiting = false
            scale.shown = false
            if (scale.pendingEnter) {
                scale.pendingEnter = false
                if (scale.status === "open") scale.enter(scale.size)
            }
        })
    }
    // The card follows the state: SwitchTransition on open / closed, CSS transition on the size class.
    function syncCard() {
        if (status === "open") {
            if (!shown || exiting) {
                enter(size)
            } else if (size !== shownSize) {
                shownSize = size
                cardTo(size === "full" ? fullRest : smallRest)
            }
        } else if (shown && !exiting) {
            pendingEnter = false
            exit()
        } else {
            pendingEnter = false
        }
    }

    ParallelAnimation {
        id: cardAnimation
        property var doneCallback: null
        NumberAnimation { id: geomAnim; target: scale; property: "geomE"; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        NumberAnimation { id: scaleAnim; target: scale; property: "scaleS"; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        NumberAnimation { id: tyAnim; target: scale; property: "tyFrac"; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        NumberAnimation { id: originAnim; target: scale; property: "originFrac"; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        onFinished: {
            const done = doneCallback
            doneCallback = null
            if (done) done()
        }
    }

    // ---- what is drawn
    // Weight: state.stats.sensors.w || 0 (so a missing scale reads 0 and "Scale not connected" never shows,
    // as in React).
    readonly property real weight: Stats.sensors.w || 0
    readonly property bool scaleConnected: !isNaN(weight)
    readonly property string formatted: scaleConnected ? weight.toFixed(1) : ""
    readonly property string padded: formatted.length >= 5 ? formatted : "00000".slice(formatted.length) + formatted

    Item {
        id: motion
        property real pullY: 0
        width: 480
        height: 480
        y: pullY

        // .scale-container: left margin -25 % → 0, width 150 % → 100 %, height 250 px → 100 %,
        // padding-bottom 50 % → 0 (of the 480 px canvas)
        Rectangle {
            id: card
            readonly property real e: scale.geomE
            readonly property real contentHeight: 250 + 230 * e
            visible: scale.shown
            x: -120 * (1 - e)
            width: 720 - 240 * e
            height: contentHeight + 240 * (1 - e)
            radius: 52 * (1 - e)
            color: Qt.rgba(27 / 255 * (1 - e), 27 / 255 * (1 - e), 27 / 255 * (1 - e), 1)
            transform: [
                Scale {
                    origin.x: card.width / 2
                    origin.y: card.height * scale.originFrac
                    xScale: scale.scaleS
                    yScale: scale.scaleS
                },
                Translate { y: card.height * scale.tyFrac }
            ]

            // .main-layout-content: the weight in the middle of the content box
            Item {
                width: card.width
                height: card.contentHeight

                // .scale-weight: ABC Diatype Mono 110 px, line-height 1, #e7e7e7, letter-spacing -2 %;
                // the zero padding to five characters at 10 % opacity, "g" (50 px) 60 px down at its right.
                Row {
                    id: weightRow
                    visible: scale.scaleConnected
                    x: (parent.width - width) / 2
                    y: (parent.height - 110) / 2
                    Text {
                        text: scale.padded.slice(0, scale.padded.length - scale.formatted.length)
                        color: "#e7e7e7"
                        opacity: 0.1
                        font.family: Theme.fontMono
                        font.pixelSize: 110
                        font.letterSpacing: -2.2
                    }
                    Text {
                        text: scale.formatted
                        color: "#e7e7e7"
                        font.family: Theme.fontMono
                        font.pixelSize: 110
                        font.letterSpacing: -2.2
                    }
                }
                Text {
                    visible: scale.scaleConnected
                    x: weightRow.x + weightRow.width
                    y: weightRow.y + 60
                    text: "g"
                    color: "#e7e7e7"
                    font.family: Theme.fontMono
                    font.pixelSize: 50
                    font.letterSpacing: -1
                }
                Text {
                    visible: !scale.scaleConnected
                    anchors.centerIn: parent
                    text: "Scale not connected"
                    color: "#f44336"
                    font.family: Theme.fontMono
                    font.pixelSize: 30
                }
            }
        }
    }

    // For the tests: the state, read through the test port's eval.
    function scaleProbe() {
        return {
            status: status, size: size, visibility: visibility, shown: shown, shownSize: shownSize,
            settled: !cardAnimation.running && !pullAnimation.running && !springAnimation.running,
            scale: scaleS, tyFrac: tyFrac, geomE: geomE, pullY: motion.pullY, actions: emittedActions,
            currentAnimation: currentAnimation, text: padded + "g"
        }
    }
}
