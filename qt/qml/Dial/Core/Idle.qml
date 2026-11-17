pragma Singleton
// The idle timer (src/hooks/useIdleTimer.tsx): 5 minutes without a gesture or a machine event and the
// home goes to the idle screen. forceIdle() is the quick settings' "sleep".
import QtQuick

QtObject {
    id: idle

    readonly property int defaultTimeout: 5 * 60 * 1000
    property int idleTime: defaultTimeout
    property bool isIdle: false
    property bool forceBubbleReopen: false

    property Timer _timer: Timer {
        interval: idle.idleTime
        running: true
        repeat: false
        onTriggered: idle.isIdle = true
    }

    function resetTimer() {
        isIdle = false
        _timer.restart()
    }
    function setTimer(timeout) {
        idleTime = timeout
        _timer.restart()
    }
    function forceIdle() {
        _timer.stop()
        isIdle = true
    }
    function setForceBubbleReopen(value) { forceBubbleReopen = !!value }
}
