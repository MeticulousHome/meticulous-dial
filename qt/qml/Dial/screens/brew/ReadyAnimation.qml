// The boot screen (src/components/ReadyAnimation): the loading Lottie loops (frames 380-530, from 383)
// until the backend answers with the profiles (useFetchData), then ReadyAnimation1 and ReadyAnimation2 play
// once and the Dial goes home, or to the shot data sharing prompt while that setting was never answered
// (resolvePostReadyScreen). Reports home_ready on the way.
import QtQuick
import Dial
import Dial.Native

Item {
    id: ready
    anchors.fill: parent
    property string phase: "loading"    // loading | ready1 | ready2 | done

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

    // useFetchData: ready once the profiles are in (the store retries on its own).
    Connections {
        target: Profiles
        function onProfilesLoadedChanged() { if (Profiles.profilesLoaded) ready.finishLoading() }
    }
    Component.onCompleted: {
        Notifications.load()
        loading.gotoAndPlay(383)
        if (Profiles.profilesLoaded) Qt.callLater(finishLoading)
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
