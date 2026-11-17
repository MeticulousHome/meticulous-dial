// The bug report's loading animation (src/components/BugReport/BugReportAnimation.tsx): a sequence of
// Lottie clips by phase.
//   collecting  CollectingData, looping: motes converging on a core while the machine compiles the report;
//   submitting  CollapsingBridge once (the designed hand-off; it starts on the collecting loop's boundary,
//               the only frame both clips agree on), then ProcessingSubmission looping;
//   finished    Finished once, then finished(). A submission landing while the bridge plays waits for it.
// The clips are 200 x 200 drawn at `size`.
import QtQuick
import Dial
import Dial.Native

Item {
    id: anim
    property string phase: "collecting"
    property real size: 200
    signal finished()

    width: size
    height: size

    // What is on screen: "" | collecting | bridge | processing | finishedClip
    property string playing: ""
    property bool bridgePending: false
    property bool finishQueued: false
    property bool bridgeOnLoop: false

    function clip(name) {
        return name === "collecting" ? collecting : name === "bridge" ? bridge
             : name === "processing" ? processing : finishedClip
    }
    function play(name) {
        [collecting, bridge, processing, finishedClip].forEach(c => { if (c !== clip(name)) c.stop() })
        bridgeOnLoop = false
        playing = name
        clip(name).gotoAndPlay(0)
    }
    function playFinished() { play("finishedClip") }
    function playBridge() { play("bridge") }

    function applyPhase() {
        switch (phase) {
        case "collecting":
            // Re-entering the flow after a cancel or a failure starts clean.
            bridgePending = false
            finishQueued = false
            play("collecting")
            break
        case "submitting":
            if (bridgePending) break
            bridgePending = true
            // Let the collecting loop come round first: cutting on an arbitrary frame snaps the arc.
            if (playing === "collecting") {
                bridgeOnLoop = true
                break
            }
            playBridge()
            break
        case "finished":
            if (bridgePending) {
                finishQueued = true
                break
            }
            playFinished()
            break
        }
    }
    onPhaseChanged: applyPhase()
    Component.onCompleted: applyPhase()

    LottieItem {
        id: collecting
        anchors.fill: parent
        visible: anim.playing === "collecting"
        source: Theme.asset("lottie/support-collecting-data.json")
        loops: -1
        onLooped: if (anim.bridgeOnLoop && anim.playing === "collecting") anim.playBridge()
    }
    LottieItem {
        id: bridge
        anchors.fill: parent
        visible: anim.playing === "bridge"
        source: Theme.asset("lottie/support-collapsing-bridge.json")
        loops: 1
        onFinished: {
            if (anim.playing !== "bridge") return
            anim.bridgePending = false
            if (anim.finishQueued) {
                anim.finishQueued = false
                anim.playFinished()
                return
            }
            anim.play("processing")
        }
    }
    LottieItem {
        id: processing
        anchors.fill: parent
        visible: anim.playing === "processing"
        source: Theme.asset("lottie/support-processing-submission.json")
        loops: -1
    }
    LottieItem {
        id: finishedClip
        anchors.fill: parent
        visible: anim.playing === "finishedClip"
        source: Theme.asset("lottie/support-finished.json")
        loops: 1
        onFinished: if (anim.playing === "finishedClip") anim.finished()
    }
}
