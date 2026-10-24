// The OS local time for the sleep clocks: startAnalogClock (every frame) or startDigitalClock (every
// 250 ms) of clockTime.js, with Native.localTime() read once a second and Native.monotonicMs() between
// reads. renderTime(ms since local midnight) fires on each frame or refresh once a sample exists.
import QtQuick
import Dial.Native
import "clockTime.js" as ClockTime

Item {
    id: clock
    width: 0
    height: 0
    visible: false

    // "frame": every frame (the analog clock); "refresh": every 250 ms (the digital clock)
    property string mode: "frame"
    property bool running: true

    signal renderTime(real milliseconds)

    property var _stop: null
    property var _frameCallback: null

    Timer {
        id: syncTimer
        property var callback: null
        repeat: false
        onTriggered: { const cb = callback; callback = null; if (cb) cb() }
    }
    Timer {
        id: refreshTimer
        property var callback: null
        interval: ClockTime.DIGITAL_REFRESH_MS
        repeat: false
        onTriggered: { const cb = callback; callback = null; if (cb) cb() }
    }
    FrameAnimation {
        id: frames
        running: clock.running && clock.mode === "frame"
        onTriggered: {
            const cb = clock._frameCallback
            clock._frameCallback = null
            if (cb) cb()
        }
    }

    function start() {
        stop()
        const refresh = mode === "refresh"
        _stop = ClockTime.startAnalogClock({
            renderTime: ms => clock.renderTime(ms),
            readTime: () => Native.localTime(),
            onError: error => console.error("Failed to read OS local time", error),
            now: () => Native.monotonicMs(),
            requestFrame: cb => {
                if (refresh) {
                    refreshTimer.callback = cb
                    refreshTimer.restart()
                } else {
                    clock._frameCallback = cb
                }
                return 1
            },
            cancelFrame: id => {
                refreshTimer.stop()
                refreshTimer.callback = null
                clock._frameCallback = null
            },
            setTimer: (cb, delay) => {
                syncTimer.callback = cb
                syncTimer.interval = delay
                syncTimer.restart()
                return 1
            },
            clearTimer: id => {
                syncTimer.stop()
                syncTimer.callback = null
            }
        })
    }
    function stop() {
        if (_stop) {
            const s = _stop
            _stop = null
            s()
        }
    }

    onRunningChanged: running ? start() : stop()
    Component.onCompleted: if (running) start()
    Component.onDestruction: stop()
}
