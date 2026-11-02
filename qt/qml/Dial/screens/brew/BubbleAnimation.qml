// The water bubbles, 170 x 270 in a black box with a 1 px padding, coloured by the four bar sensors: a vertical
// gradient from t_bar_up at the top to t_bar_down at the bottom, each stop easing to its colour in 0.5 s,
// seen through the holes of the bubbles. The palette is LottieBubbleAnimation.tsx's (purple to orange), on a
// scale that ends in orange at the target; React colours the whole box from one temperature (src/components/
// Heating/LottieBubbleAnimation.tsx), so this departs from it on purpose. Without water all four go grey.
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
    property var sensors: ({})
    property real temperatureTarget: 0
    property bool waterStatus: true
    readonly property int bubblesWidth: 170
    readonly property int bubblesHeight: 270

    width: bubblesWidth + 2
    height: bubblesHeight + 2

    // Test probes: the segment playing and the four colours the gradient is heading for and the four it draws now, top to bottom.
    readonly property var dialProbe_bubbleSegment: [lottie.startFrame, lottie.endFrame]
    readonly property var dialProbe_bubbleColors: colors
    function dialProbe_bubbleStops() {
        const out = []
        for (let i = 0; i < stops.stops.length; i++) out.push(String(stops.stops[i].color))
        return out
    }

    readonly property var colors: Logic.bubbleColors(sensors, temperature, temperatureTarget, waterStatus)
    property color shownUp: colors[0]
    property color shownMu: colors[1]
    property color shownMd: colors[2]
    property color shownDown: colors[3]
    Behavior on shownUp { ColorAnimation { duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
    Behavior on shownMu { ColorAnimation { duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
    Behavior on shownMd { ColorAnimation { duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
    Behavior on shownDown { ColorAnimation { duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }

    Rectangle {
        anchors.fill: parent
        color: "black"
    }

    // GradientContainer: 169 x 269 at (1, 1), four stops evenly spaced from the top bar sensor to the bottom.
    Rectangle {
        x: 1
        y: 1
        width: bubbles.bubblesWidth - 1
        height: bubbles.bubblesHeight - 1
        gradient: Gradient {
            id: stops
            GradientStop { position: 0; color: bubbles.shownUp }
            GradientStop { position: 1 / 3; color: bubbles.shownMu }
            GradientStop { position: 2 / 3; color: bubbles.shownMd }
            GradientStop { position: 1; color: bubbles.shownDown }
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
