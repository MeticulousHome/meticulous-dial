// The barometer (src/components/Barometer): the screen of a running shot. A 300° ring of 22 steps (0..21)
// with the yellow needle on the pressure (0.2 s linear), the pressure in large, then time, flow, weight and
// gravimetric flow, and the stage's name. During a manual brew in the flow stage the whole ring reads flow
// (ml/s) and the second cell shows the pressure; a manual brew also shows its target, a tick on the ring in
// the control's colour that follows the machine's streamed setpoint (150 ms linear) with a comet trail
// behind it while the knob turns, and "Target x.x bar" under the value. It goes home once the machine is
// idle; a double click finishes the shot during a profile stage (the only screen allowed to), else aborts.
import QtQuick
import Dial
import "BrewLogic.js" as Logic
import "BarometerLogic.js" as Geo

Item {
    id: barometer
    anchors.fill: parent
    property bool transitioning: false

    // The socket "action" events this screen sent (a test probe).
    property var sentActions: []
    readonly property var dialProbe_sent: sentActions
    function send(name) {
        sentActions = sentActions.concat([name])
        Backend.action(name)
    }
    property real maxValue: 21

    // ---- manual brew (useManualBrew + useManualTarget)
    readonly property bool isManualBrew: ManualMode.isManualBrew
    readonly property string activeControl: ManualMode.activeControl
    readonly property var streamedTarget: ManualMode.streamedTarget
    property int tenths: 0
    property var trail: null
    property var history: []

    readonly property bool flowRing: isManualBrew && activeControl === "flow"
    readonly property real ringValue: flowRing ? Stats.sensors.f : Stats.sensors.p
    readonly property string ringUnit: flowRing ? "ml/s" : "bar"
    readonly property bool showTarget: isManualBrew && activeControl !== ""
    readonly property color targetColor: Constants.MANUAL_TARGET_COLORS[activeControl] || "white"

    // Test probes
    readonly property string dialProbe_ringValue: Logic.formatStatValue(ringValue, 1)
    readonly property real dialProbe_needleDeg: needleDeg
    readonly property int dialProbe_targetTenths: tenths
    readonly property bool dialProbe_targetShown: showTarget
    readonly property bool dialProbe_trail: trail !== null
    readonly property bool dialProbe_flowRing: flowRing

    // Seed on entering a manual brew or switching control, drop everything on leaving one.
    function seedEffect() {
        trailLoop.running = false
        history = []
        trail = null
        const target = streamedTarget === undefined || streamedTarget === null ? 0 : streamedTarget
        tenths = isManualBrew ? Geo.clampTenths(Geo.toTenths(target)) : 0
    }
    // Follow the streamed setpoint.
    function streamEffect() {
        if (!isManualBrew || typeof streamedTarget !== "number") return
        const next = Geo.clampTenths(Geo.toTenths(streamedTarget))
        if (next === tenths) return
        history = Geo.pushSample(history, next, Date.now())
        tenths = next
        trailLoop.running = true
    }
    onIsManualBrewChanged: { seedEffect(); streamEffect() }
    onActiveControlChanged: seedEffect()
    onStreamedTargetChanged: streamEffect()

    // requestAnimationFrame loop while there is a trail.
    FrameAnimation {
        id: trailLoop
        running: false
        onTriggered: {
            const next = Geo.computeTrail(barometer.history, Date.now())
            barometer.trail = next
            if (!next) running = false
        }
    }

    // ---- the screen's effects
    function idleEffect() {
        if (Stats.name === "idle" && !Stats.waitingForActionAlreadySent && !Notifications.hasNotifications) Nav.setScreen("profileHome")
    }
    function waitingEffect() {
        if (Stats.name !== "idle") Stats.setWaitingForAction(false)
    }
    Connections {
        target: Stats
        function onNameChanged() { barometer.idleEffect(); barometer.waitingEffect() }
        function onWaitingForActionAlreadySentChanged() { barometer.idleEffect() }
    }
    Component.onCompleted: {
        idleEffect()
        waitingEffect()
        seedEffect()
        streamEffect()
    }

    function brewDoubleClick() {
        const decision = Logic.decideDoubleClick({ name: Stats.name, extracting: Stats.extracting }, { allowFinish: true })
        console.log("doubleClick decision", JSON.stringify({ screen: Nav.screen, decision: decision, name: Stats.name, extracting: Stats.extracting }))
        if (decision) send(decision)
    }
    // The click that switches control and the long press that ends a manual shot are the machine's own.
    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onDoubleClick: barometer.brewDoubleClick()
    }

    // ---- .bar-needle__content: 290 px wide, 120 px down, centered
    readonly property int contentX: 95
    readonly property color cream: "#e0dcd0"
    readonly property color labelGray: "#808080"
    function capitalizeFirst(s) { return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s }

    Text {
        // .pressure: 14 px, 1.125 px spacing, #808080, capitalized, 10 px under
        x: barometer.contentX
        y: 120
        width: 290
        height: 14
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: barometer.flowRing ? "Flow" : "Pressure"
        color: barometer.labelGray
        font.family: Theme.fontRegular
        font.pixelSize: 14
        font.letterSpacing: 1.125
    }

    // .bar-needle__legend: the value (Mono 50 px) centered, its unit 8 px after it (the -48 px margin
    // keeps the value centered).
    Text {
        id: bigValue
        x: barometer.contentX + (290 - (implicitWidth - 1)) / 2
        y: 141
        height: 50
        verticalAlignment: Text.AlignVCenter
        text: Logic.formatStatValue(barometer.ringValue, 1)
        color: barometer.cream
        font.family: Theme.fontMono
        font.pixelSize: 50
        font.letterSpacing: -1.5
    }
    Text {
        x: bigValue.x + bigValue.implicitWidth + 8
        y: 144
        height: 11
        verticalAlignment: Text.AlignVCenter
        text: barometer.ringUnit
        color: barometer.labelGray
        font.family: Theme.fontRegular
        font.pixelSize: 11
        font.letterSpacing: 1.125
    }
    // .bar-target (manual brews)
    Text {
        visible: barometer.isManualBrew
        x: barometer.contentX
        y: 197
        width: 290
        height: 14
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "Target " + Geo.toBar(barometer.tenths).toFixed(1) + " " + barometer.ringUnit
        color: barometer.labelGray
        font.family: Theme.fontRegular
        font.pixelSize: 14
        font.letterSpacing: 1.125
    }

    // .columns-grid: two 120 px columns 50 px apart, rows 33 px apart; label 14 px, value Mono 33 px with
    // its unit 5 px after it (the -53 px margin keeps the value centered).
    readonly property int gridY: isManualBrew ? 217 : 205
    readonly property var cells: [
        { label: "Time", value: Logic.formatStatValue(Stats.profileTime, 1, 1000), unit: "sec" },
        { label: flowRing ? "Pressure" : "Flow", value: Logic.formatStatValue(flowRing ? Stats.sensors.p : Stats.sensors.f, 1), unit: flowRing ? "bar" : "ml/s" },
        { label: "Weight", value: Logic.formatStatValue(Stats.sensors.w, 1), unit: "gr" },
        { label: "Grav. Flow", value: Logic.formatStatValue(Stats.sensors.g, 1), unit: "g/s" }
    ]
    Repeater {
        model: 4
        delegate: Item {
            id: cell
            required property int index
            readonly property var cellData: barometer.cells[index]
            x: barometer.contentX + (index % 2) * 170
            y: barometer.gridY + Math.floor(index / 2) * 80
            width: 120
            height: 47
            Text {
                width: 120
                height: 14
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: barometer.capitalizeFirst(cell.cellData.label)
                color: barometer.labelGray
                font.family: Theme.fontRegular
                font.pixelSize: 14
                font.letterSpacing: 1.125
            }
            Text {
                id: cellValue
                x: (120 - (implicitWidth - 3)) / 2
                y: 14
                height: 33
                verticalAlignment: Text.AlignVCenter
                text: cell.cellData.value
                color: barometer.cream
                font.family: Theme.fontMono
                font.pixelSize: 33
                font.letterSpacing: -0.75
            }
            Text {
                x: cellValue.x + cellValue.implicitWidth + 5
                y: 16
                height: 11
                verticalAlignment: Text.AlignVCenter
                text: cell.cellData.unit
                color: "#4d4d4d"
                font.family: Theme.fontRegular
                font.pixelSize: 11
                font.letterSpacing: 1.125
            }
        }
    }

    // .bar-needle__status: the stage, first letter capitalized, 24 px, 20 px under the grid
    Text {
        x: barometer.contentX
        y: barometer.gridY + 127 + 20
        width: 290
        height: 24
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: barometer.capitalizeFirst(Stats.name)
        color: barometer.cream
        font.family: Theme.fontRegular
        font.pixelSize: 24
        font.letterSpacing: -0.5
    }

    // ---- Meter: the 478 px ring
    Image {
        width: Geo.ARC_SIZE
        height: Geo.ARC_SIZE
        sourceSize: Qt.size(Geo.ARC_SIZE, Geo.ARC_SIZE)
        source: Theme.asset("icons/brew-barometer-steps.svg")
    }

    // TargetTick: one frame rotated to the target (150 ms linear) holding the trail and the marker, the
    // painted 19 px of a 223 px bar from the ring's centre, 3 px thick.
    readonly property real targetAngle: Geo.valueToAngleRad(Geo.toBar(tenths), 0, maxValue)
    Item {
        visible: barometer.showTarget
        width: Geo.ARC_SIZE
        height: Geo.ARC_SIZE
        rotation: Geo.toDeg(barometer.targetAngle)
        Behavior on rotation {
            NumberAnimation { duration: 150 }
        }
        TrailArc {
            visible: barometer.trail !== null
            color: barometer.targetColor
            delta: barometer.trail ? barometer.targetAngle - Geo.valueToAngleRad(Geo.toBar(barometer.trail.fromTenths), 0, barometer.maxValue) : 0
        }
        Rectangle {
            x: Geo.ARC_RADIUS + Geo.TARGET_TICK_INNER_RADIUS
            y: Geo.ARC_RADIUS - 1.5
            width: Geo.TARGET_TICK_LENGTH
            height: 3
            color: barometer.targetColor
            antialiasing: true
        }
    }

    // The needle: 197 x 4 px from the centre, rotated by its left centre to the rounded angle, 0.2 s linear.
    // (An invalid angle leaves the CSS transform out: 0°.)
    readonly property real needleDeg: {
        const a = Math.round(Geo.toDeg(Geo.valueToAngleRad(ringValue, 0, maxValue)))
        return isNaN(a) ? 0 : a
    }
    Rectangle {
        x: Geo.ARC_RADIUS
        y: Geo.ARC_RADIUS
        width: Geo.NEEDLE_LENGTH
        height: 4
        color: Theme.brandYellow
        antialiasing: true
        transformOrigin: Item.Left
        rotation: barometer.needleDeg
        Behavior on rotation {
            NumberAnimation { duration: 200 }
        }
    }
}
