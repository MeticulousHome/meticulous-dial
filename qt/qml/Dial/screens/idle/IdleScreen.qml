// The sleep screen (src/components/IdleScreen/IdleScreen.tsx): the clock the idle_screen setting picks
// (analog by default, digital, the MetCat clock, DVD, Barista Barista), slowly turned back and forth by
// half a degree over an hour against burn-in, at a third of the brightness. After 10 minutes the screen
// dims in a cycle: 55 s dark (brightness 0.03 under a 70 % black veil), 5 s at 0.33.
//
// Any gesture that resets the idle timer (Input: turns, press, context, single tare) or a machine event
// clears Idle.isIdle: the Dial goes back to the screen it slept on (the home if that one does not count as
// a previous screen) at full brightness, closing an unpinned bubble. As in React that happens after the
// gesture has been delivered (React re-renders after the gesture), so a context press that wakes the Dial
// leaves the bubble closed. A sleep forced from the idle screen setting (Idle.forceBubbleReopen) reopens
// the bubble it came from when this screen goes away.
import QtQuick
import Dial
import "clockTime.js" as ClockTime

Item {
    id: idleScreen
    anchors.fill: parent

    property bool transitioning: false

    // globalSettings?.idle_screen → the clock
    readonly property var idleSetting: BackendSettings.data ? BackendSettings.data.idle_screen : undefined
    readonly property string variant: idleSetting === "baristaBarista" ? "barista"
                                    : idleSetting === "metCat" ? "metcat"
                                    : idleSetting === "digital" ? "digital"
                                    : idleSetting === "dvd" ? "dvd"
                                    : "analog"

    // 10 minutes; then 55 s dark, 5 s brighter (the tests shorten them)
    property int screenTimeout: 10 * 60 * 1000
    property int darkMs: 55 * 1000
    property int brightMs: 5 * 1000
    property bool isScreenDim: false
    property bool cancelled: false

    // What the unmount cleanup of React sees: the values of the first render.
    property bool forceBubbleReopenAtMount: false
    property string previousComponentAtMount: ""
    property real mountedAt: 0

    // Every brightness this screen and its clock asked for, for the tests.
    property var brightnessLog: []
    function updateBrightness(brightness) {
        brightnessLog = brightnessLog.concat([brightness])
        Api.setBrightness({ brightness: brightness }).catch(e => console.error("Error setting brightness", e && e.message ? e.message : e))
    }

    Timer {
        id: dimTimer
        property var action: null
        repeat: false
        onTriggered: {
            const a = action
            action = null
            if (a) a()
        }
    }
    function schedule(ms, action) {
        dimTimer.action = action
        dimTimer.interval = ms
        dimTimer.restart()
    }

    function cycleScreenDim() {
        if (cancelled) return
        const prev = isScreenDim
        if (prev) {
            // Screen is dark, dim up for 5 seconds
            schedule(brightMs, () => {
                if (idleScreen.cancelled) return
                idleScreen.updateBrightness(0.03)
                idleScreen.cycleScreenDim()
            })
        } else {
            schedule(darkMs, () => {
                if (idleScreen.cancelled) return
                idleScreen.updateBrightness(0.33)
                idleScreen.cycleScreenDim()
            })
        }
        isScreenDim = !prev
    }

    // The [shouldGoToIdle] effect: leave once the idle timer is reset.
    function syncIdle() {
        if (Idle.isIdle || Nav.prev === "idle") return
        updateBrightness(1)
        if (Nav.bubbleVisible && !Nav.bubblePinned)
            Nav.setBubbleDisplay({ visible: false, component: Nav.bubblePreviousComponent })
        const prevRoute = Nav.prev ? Routes.route(Nav.prev) : null
        if (!Nav.prev || !prevRoute || prevRoute.ignoreAsPrevious) {
            Nav.setScreen("profileHome")
            return
        }
        Nav.setScreen(Nav.prev)
    }
    Connections {
        target: Idle
        function onIsIdleChanged() { Qt.callLater(idleScreen.syncIdle) }
    }

    // ShiftContainer: the pixel shift, turned around the middle of the clock's own height (its flow box).
    // The curve moves less than 0.003 px a second at the edge: it is sampled once a second instead of on
    // every frame, so a still clock is not redrawn 60 times a second.
    Item {
        id: shift
        width: 480
        height: content.item ? content.item.flowHeight : 0
        transformOrigin: Item.Center

        Loader {
            id: content
            width: 480
            height: 480
            onLoaded: if (item.brightnessRequested)
                          item.brightnessRequested.connect(b => idleScreen.brightnessLog = idleScreen.brightnessLog.concat([b]))
            sourceComponent: idleScreen.variant === "barista" ? baristaComponent
                           : idleScreen.variant === "metcat" ? metCatComponent
                           : idleScreen.variant === "digital" ? digitalComponent
                           : idleScreen.variant === "dvd" ? dvdComponent
                           : analogComponent
        }

        // FadeOverlay: over everything, 70 % black while dimmed, 1 s transition.
        Rectangle {
            width: 480
            height: 480
            z: 99999
            color: "black"
            opacity: idleScreen.isScreenDim ? 0.7 : 0
            visible: opacity > 0
            Behavior on opacity {
                NumberAnimation { duration: 1000; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
            }
        }
    }
    Timer {
        interval: 1000
        repeat: true
        running: true
        onTriggered: shift.rotation = ClockTime.pixelShift(Date.now() - idleScreen.mountedAt)
    }

    Component { id: analogComponent; AnalogClock {} }
    Component { id: digitalComponent; DigitalClock { useMetCat: false } }
    Component { id: metCatComponent; DigitalClock { useMetCat: true } }
    Component { id: dvdComponent; DVDIdleScreen {} }
    Component { id: baristaComponent; BaristaClock {} }

    Component.onCompleted: {
        mountedAt = Date.now()
        forceBubbleReopenAtMount = Idle.forceBubbleReopen
        previousComponentAtMount = Nav.bubblePreviousComponent
        // After the clock's own mount effects (the digital clock sets the brightness to 0 first).
        Qt.callLater(() => {
            if (idleScreen.cancelled) return
            idleScreen.updateBrightness(0.33)
            // Start a timer to completely disable the screen after a while
            idleScreen.schedule(idleScreen.screenTimeout, () => idleScreen.cycleScreenDim())
            idleScreen.syncIdle()
        })
    }
    Component.onDestruction: {
        cancelled = true
        dimTimer.stop()
        updateBrightness(1)
        if (forceBubbleReopenAtMount)
            Nav.setBubbleDisplay({ visible: true, component: previousComponentAtMount })
        Idle.setForceBubbleReopen(false)
    }

    // The clock shown (for the tests)
    readonly property Item clock: content.item
    readonly property string dialProbe_idleVariant: variant
    readonly property bool dialProbe_screenDim: isScreenDim
    readonly property var dialProbe_brightness: brightnessLog
}
