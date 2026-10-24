// LottieBubbleAnimation (src/components/Heating/LottieBubbleAnimation.tsx): the water bubbles, 170 x 270 in
// a black box with a 1 px padding, coloured by the temperature: a 12-stop gradient (grey, then deep purple
// to orange) 12 times the box's height, whose visible window slides with the temperature (20..90 °C) in
// 0.5 s, multiplied over the white bubbles. Without water the window goes back to grey.
//
// The multiply is baked into the file (screens/brew/tools/bake_water_bubbles.py): it draws black with
// bubble-shaped holes over the gradient, which is what white bubbles multiplied by it look like.
//
// Playback as lottie-web plays it: frames 0-60 once, then 60-314 in a loop (the loopComplete handler resets
// the segment to 60-314). Water gone: the loop stops at its end and 314-375 plays once (the bubbles drain).
// Water back: 0-314 at once, then 60-314 in a loop. setSubframe(false): the file's 29 frames a second.
import QtQuick
import Dial
import Dial.Native
import "BrewLogic.js" as Logic

Item {
    id: bubbles
    property real temperature: 0
    property bool waterStatus: true
    readonly property int bubblesWidth: 170
    readonly property int bubblesHeight: 270

    width: bubblesWidth + 2
    height: bubblesHeight + 2

    // Test probes: the segment playing and the gradient's position (percent).
    readonly property var dialProbe_bubbleSegment: [lottie.startFrame, lottie.endFrame]
    readonly property real dialProbe_bubbleGradient: gradientOffset

    readonly property real gradientOffset: Logic.bubbleGradientOffset(temperature, waterStatus)

    Rectangle {
        anchors.fill: parent
        color: "black"
    }

    // GradientContainer: 169 x 269 at (1, 1), background-size 100% 1200%.
    Item {
        x: 1
        y: 1
        width: bubbles.bubblesWidth - 1
        height: bubbles.bubblesHeight - 1
        clip: true
        Rectangle {
            id: strip
            width: parent.width
            height: parent.height * 12
            // background-position-y: p % = (box - image) * p
            y: (parent.height - height) * bubbles.gradientOffset / 100
            Behavior on y {
                NumberAnimation { duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
            }
            gradient: Gradient {
                GradientStop { position: 0.08; color: "grey" }
                GradientStop { position: 0.17; color: "#280B54" }
                GradientStop { position: 0.25; color: "#280B54" }
                GradientStop { position: 0.33; color: "#480B6A" }
                GradientStop { position: 0.42; color: "#65156E" }
                GradientStop { position: 0.50; color: "#82206C" }
                GradientStop { position: 0.58; color: "#9F2A63" }
                GradientStop { position: 0.67; color: "#BB3755" }
                GradientStop { position: 0.75; color: "#D44842" }
                GradientStop { position: 0.83; color: "#E8602D" }
                GradientStop { position: 0.92; color: "#F44D19" }
                GradientStop { position: 1.00; color: "#F44D19" }
            }
        }
    }

    LottieItem {
        id: lottie
        x: 1
        y: 1
        width: bubbles.bubblesWidth
        height: bubbles.bubblesHeight
        source: Theme.asset("lottie/brew-water-bubbles.json")
        subframes: 1
        loops: 1
        onFinished: bubbles.segmentEnded()
        onLoadedChanged: if (loaded && !bubbles.started) bubbles.start()
    }

    property bool started: false
    property var queue: []
    property bool loop: true

    function playSegment(segment) {
        lottie.startFrame = segment[0]
        lottie.endFrame = segment[1]
        lottie.gotoAndPlay(segment[0])
    }
    // loadAnimation: initialSegment [0, 60], loop, autoplay; playSegments([60, 314]) queued.
    function start() {
        started = true
        loop = true
        queue = [[60, 314]]
        playSegment([0, 60])
    }
    function segmentEnded() {
        if (queue.length) {
            const next = queue[0]
            queue = queue.slice(1)
            playSegment(next)
        } else if (loop) {
            playSegment([60, 314])
        }
    }
    onWaterStatusChanged: {
        if (!started) return
        if (waterStatus) {
            queue = []
            loop = true
            playSegment([0, 314])
        } else {
            loop = false
            queue = queue.concat([[314, 375]])
        }
    }
    Component.onCompleted: if (lottie.loaded) start()
}
