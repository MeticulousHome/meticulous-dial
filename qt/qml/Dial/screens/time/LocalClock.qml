// useCurrentTime (src/hooks/useCurrentTime.ts, utils/localTime.ts): the OS local time (Native.localTime(),
// the get_os_local_time command), read at once and every second after; zero-padded fields, "--" before the
// first sample. A failed read keeps the last sample (logged once).
import QtQuick
import Dial
import Dial.Native

Item {
    id: clock
    width: 0
    height: 0
    visible: false

    property var sample: null
    property bool reportedError: false

    readonly property string hours: sample ? String(sample.hour).padStart(2, "0") : "--"
    readonly property string minutes: sample ? String(sample.minute).padStart(2, "0") : "--"
    readonly property string day: sample ? String(sample.day).padStart(2, "0") : "--"
    readonly property string month: sample ? String(sample.month).padStart(2, "0") : "--"
    readonly property string year: sample ? String(sample.year) : "----"

    Timer {
        interval: 1000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: {
            try {
                const s = Native.localTime()
                if (!s || s.year === undefined) throw new Error("no local time")
                clock.sample = s
                clock.reportedError = false
            } catch (error) {
                if (!clock.reportedError) {
                    clock.reportedError = true
                    console.error("Failed to read OS local time", error)
                }
            }
        }
    }
}
