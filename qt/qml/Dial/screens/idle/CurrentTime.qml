// useCurrentTime (src/hooks/useCurrentTime.ts): the OS local time (Native.localTime()) read now and 1 s
// after each read, as zero-padded strings, "--" ("----" for the year) until the first read.
//   import "../idle"
//   CurrentTime { id: now }   // now.hours, now.minutes, now.day, now.month, now.year
import QtQuick
import Dial.Native
import "clockTime.js" as ClockTime

Item {
    id: current
    width: 0
    height: 0
    visible: false

    property var sample: null
    readonly property string hours: sample ? ClockTime.pad2(sample.hour) : "--"
    readonly property string minutes: sample ? ClockTime.pad2(sample.minute) : "--"
    readonly property string day: sample ? ClockTime.pad2(sample.day) : "--"
    readonly property string month: sample ? ClockTime.pad2(sample.month) : "--"
    readonly property string year: sample ? String(sample.year) : "----"

    property var _stop: null

    Timer {
        id: syncTimer
        property var callback: null
        repeat: false
        onTriggered: { const cb = callback; callback = null; if (cb) cb() }
    }

    Component.onCompleted: {
        _stop = ClockTime.subscribeLocalTime({
            onTime: s => current.sample = s,
            readTime: () => Native.localTime(),
            onError: error => console.error("Failed to read OS local time", error),
            now: () => Native.monotonicMs(),
            setTimer: (cb, delay) => { syncTimer.callback = cb; syncTimer.interval = delay; syncTimer.restart(); return 1 },
            clearTimer: id => { syncTimer.stop(); syncTimer.callback = null }
        })
    }
    Component.onDestruction: if (_stop) _stop()
}
