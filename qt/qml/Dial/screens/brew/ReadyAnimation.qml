// The boot screen (src/components/ReadyAnimation): the loading Lottie loops (frames 380-530, from 383)
// until the Dial is online, then ReadyAnimation1 and ReadyAnimation2 play once and the Dial goes home, or to
// the shot data sharing prompt while that setting was never answered (resolvePostReadyScreen). Reports
// home_ready on the way.
//
// React waited for the profiles only (useFetchData). After a power cycle the Qt Dial starts before the
// backend, and its socket can connect seconds after the profiles come in (reconnecting every 5 s at most):
// the home then said "Waiting for the backend to come online". The loading Lottie is the wait, so it stays
// until Device.isOnline (the socket, the settings and the profiles).
import QtQuick
import Dial
import Dial.Native

Item {
    id: ready
    anchors.fill: parent
    property string phase: "loading"    // loading | ready1 | ready2 | done
    readonly property string dialProbe_phase: phase

    function resolvePostReadyScreen(settings) {
        return settings && settings.shot_data_sharing === null ? "shotDataSharingPrompt" : "profileHome"
    }

    function finishLoading() {
        if (phase !== "loading") return
        phase = "ready1"
        ready1.play()
    }
    function finishReady2() {
        if (phase === "done") return
        phase = "done"
        Native.homeReady()
        Nav.setScreen(resolvePostReadyScreen(BackendSettings.data))
        Notifications.load()
    }

    // Ready once online (the stores retry on their own).
    Connections {
        target: Device
        function onIsOnlineChanged() { if (Device.isOnline) ready.finishLoading() }
    }
    Component.onCompleted: {
        Notifications.load()
        loading.gotoAndPlay(383)
        if (Device.isOnline) Qt.callLater(finishLoading)
    }

    LottieItem {
        id: loading
        width: 480
        height: 480
        visible: ready.phase === "loading"
        source: Theme.asset("lottie/ready-loading.json")
        loops: -1
        startFrame: 380
        endFrame: 530
    }
    LottieItem {
        id: ready1
        width: 480
        height: 480
        visible: ready.phase === "ready1"
        source: Theme.asset("lottie/ready-1.json")
        loops: 1
        onFinished: {
            ready.phase = "ready2"
            ready2.play()
        }
    }
    LottieItem {
        id: ready2
        width: 480
        height: 480
        visible: ready.phase === "ready2"
        source: Theme.asset("lottie/ready-2.json")
        loops: 1
        onFinished: ready.finishReady2()
    }
}
