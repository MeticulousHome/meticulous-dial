// Sparks that whirl off a ring as it fills: clockwise from 6 o'clock, like Arc, from `sweep` when `burning`
// goes true to the whole circle in fillSeconds. Each spark is a small kite on one GridMesh and
// shaders/sparks.vert moves them all, so this costs no script per frame and few pixels. QtQuick.Particles
// runs on the CPU and needs a module the Dial doesn't ship today. The same mesh and clock draw the other
// styles: "sparkles" (four-point stars in the colours of the rainbow), "steam" (large soft puffs that rise)
// and "drops" (thick drips of coffee that stretch from the ring, break and fall).
// The clock is an Animator: it runs on the render thread and keeps moving while the QML thread is busy, which
// a NumberAnimation doesn't (building a screen takes it for 50-100 ms and more).
// When burning stops no new sparks are born and the ones in the air fly on until they die. When it starts
// again before that, they stay in the air: the shader knows the last two burns. When the ring is full the
// sparks go on around all of it.
//
// The render thread's clock is not the wall clock: it falls behind when frames drop. So the times a burn
// starts and stops are read from the clock itself. An Animator writes its value back when it stops, and
// `probe` is a second one that runs in step with the clock only to be stopped, read and started again.
import QtQuick

Item {
    id: ring
    property real radius: 235
    property real sweep: 0              // 0..1 of the circle, read when burning starts
    property real fillSeconds: 1
    property bool burning: false
    property string style: "sparks"     // sparks | sparkles | steam | drops
    // A puff of steam and a drip of coffee are slow: they last longer than a spark.
    readonly property real lifeScale: style === "steam" ? 2.6 : style === "drops" ? 2 : 1

    readonly property int count: 300
    readonly property int longestLifeMs: Math.round(850 * lifeScale)    // the 0.85 of shaders/sparks.vert
    // Whether anything is drawn and animated: from the first spark to the death of the last one.
    readonly property bool animating: flying
    property bool flying: false

    // The burn that is on or was last (1) and the one before it (0), in the clock's seconds: when they
    // started and stopped, and how much of the ring was filled when they started.
    readonly property real stillBurning: 1e6
    property real w1Start: 0
    property real w1Stop: -1
    property real w1FillFrom: 0
    property real w0Start: 0
    property real w0Stop: -1
    property real w0FillFrom: 0
    // Where the clock started, and the most it may show: the shader draws nothing outside these (see
    // onBurningChanged), so clockSeconds is also the longest that sparks can go on.
    property real clockFrom: 0
    readonly property real clockSeconds: 120    // the 120.0 of shaders/sparks.vert
    // When the drips were told to let go (release()), in the clock's seconds; stillBurning until then.
    property real letGo: stillBurning
    readonly property real dialProbe_sparkLetGo: letGo
    // The profile starts: every drip that hangs from the ring breaks now (shaders/sparks.vert). The other
    // styles have nothing that hangs.
    function release() {
        if (flying && burning) letGo = clockNow()
    }
    // Test probes: [start, stop] of the two burns, and the time the clock stopped at.
    readonly property var dialProbe_sparkBurns: [[w0Start, w0Stop], [w1Start, w1Stop]]
    readonly property real dialProbe_sparkClockStopped: Math.max(effect.time, effect.now)

    // The clock's time now. The probe starts again from there a frame later, so it falls a frame behind on
    // every reading: sparks that young are not bright enough to be missed.
    function clockNow() {
        probe.stop()
        const t = effect.now
        probe.from = t
        probe.to = t + 600
        probe.start()
        return t
    }

    onBurningChanged: {
        if (burning) {
            died.stop()
            if (flying) {
                // Sparks in the air: the burn they came from moves down one place and they fly on.
                w0Start = w1Start
                w0Stop = w1Stop
                w0FillFrom = w1FillFrom
                w1Start = clockNow()
            } else {
                // An empty sky. The render thread starts the clock some frames after this, and until then
                // the shader has the time the clock stopped at. A start before that time would put it
                // inside this burn, as the time of a ring long full: sparks on all of the ring, gone when
                // the clock starts. So the clock starts after it, by a random step (no two burns look the
                // same), or far before it once it is high (a float's seconds get coarse), where the shader
                // draws nothing either: more than clockSeconds after the start.
                const stopped = Math.max(effect.time, effect.now)
                const t = stopped > 300 ? Math.floor(Math.random() * 20)
                                        : Math.floor(stopped) + 1 + Math.floor(Math.random() * 20)
                w0Start = 0
                w0Stop = -1
                w1Start = t
                clockFrom = t
                clock.from = probe.from = t
                clock.to = probe.to = t + 600
                flying = true
                clock.restart()
                probe.restart()
            }
            w1Stop = stillBurning
            w1FillFrom = sweep
            letGo = stillBurning
        } else {
            w1Stop = clockNow()
            died.restart()
        }
    }
    onFlyingChanged: {
        if (flying) return
        clock.stop()
        probe.stop()
    }

    Timer {
        id: died
        interval: ring.longestLifeMs + 350  // the clock can run behind this timer when frames drop
        onTriggered: ring.flying = false
    }

    ShaderEffect {
        id: effect
        anchors.fill: parent
        visible: ring.flying
        mesh: GridMesh { resolution: Qt.size(3 * ring.count - 1, 1) }
        // Uniforms of shaders/sparks.vert, by name.
        property real time: 0           // moved by the clock only
        property real now: 0            // moved by the probe only
        property real clockFrom: ring.clockFrom
        property real w1Start: ring.w1Start
        property real w1Stop: ring.w1Stop
        property real w1FillFrom: ring.w1FillFrom
        property real w0Start: ring.w0Start
        property real w0Stop: ring.w0Stop
        property real w0FillFrom: ring.w0FillFrom
        property real fillSeconds: ring.fillSeconds
        property real radius: ring.radius
        property real side: width
        property real count: ring.count
        property real style: ({ sparks: 0, sparkles: 1, steam: 2, drops: 3 })[ring.style] || 0
        property real lifeScale: ring.lifeScale
        property real letGo: ring.letGo
        vertexShader: "../shaders/sparks.vert.qsb"
        fragmentShader: "../shaders/sparks.frag.qsb"
    }

    UniformAnimator {
        id: clock
        target: effect
        uniform: "time"
        duration: 600000
    }
    UniformAnimator {
        id: probe
        target: effect
        uniform: "now"
        duration: 600000
    }
}
