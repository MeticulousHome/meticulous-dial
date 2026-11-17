// A piston that follows the machine's piston (m_pos) smoothly, drawn from pictures baked from its Lottie
// (tools/bake_piston.py): the layers bottom first, the moving ones slid down by position / maxPosition *
// travel px, by fractions of a pixel. Drawn by LottieItem instead, the piston could only stop on whole
// frames and the edges of its thin ellipses were rasterized again at every step.
//
// The machine's readings change every ~130 ms, now and then after 250-290 ms by twice the distance (a raise
// on a machine, 2026-10-27: 76.5 to 0 mm in 12 s, 0.8 mm per change). Animating 200 ms to each reading,
// restarted by the next one, moved the piston in jerks. Instead it is shown `delay` ms behind the readings,
// interpolated between the two around that time, so it moves at the piston's own pace. A change after more
// than `maxGap` ms on the same reading starts from a stop one `step` before it. The first reading places
// the piston at once; until then nothing is drawn. The times are monotonic: the wall clock can step back
// (time sync, setting the time) and the piston would jump back to an old reading.
import QtQuick
import Dial.Native

Item {
    id: figure
    // The piston's position, mm (NaN until a reading); past maxPosition it is shown at the end.
    property real position: NaN
    property real maxPosition: 74
    // How far the moving layers go down at maxPosition, px.
    property real travel: 0
    // [{ source, moves }], bottom first.
    property var layers: []
    property int delay: 350
    property int maxGap: 350
    property int step: 130

    // The position shown, mm.
    property real shown: NaN
    property var samples: []

    function add(value) {
        if (isNaN(value) || value < 0) return
        const v = Math.min(value, maxPosition)
        const now = Native.monotonicMs()
        if (samples.length === 0) {
            samples = [{ t: now - step, v: v }]
            shown = v
            return
        }
        const s = samples.slice(-8)
        const last = s[s.length - 1]
        if (v === last.v) return
        if (now - last.t > maxGap) s.push({ t: now - step, v: last.v })
        // Two changes a few ms apart are one reading's jitter, not a jump.
        s.push({ t: Math.max(now, s[s.length - 1].t + 40), v: v })
        samples = s
        follow.running = true
    }
    onPositionChanged: add(position)
    Component.onCompleted: add(position)

    FrameAnimation {
        id: follow
        onTriggered: {
            const s = figure.samples
            const t = Native.monotonicMs() - figure.delay
            const last = s[s.length - 1]
            if (t >= last.t) {
                figure.shown = last.v
                follow.running = false
                return
            }
            let i = s.length - 1
            while (i > 0 && s[i - 1].t > t) --i
            if (i === 0) {
                figure.shown = s[0].v
                return
            }
            const a = s[i - 1], b = s[i]
            figure.shown = a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t)
        }
    }

    readonly property real offset: isNaN(shown) ? 0 : shown / maxPosition * travel
    Repeater {
        model: figure.layers
        delegate: Image {
            required property var modelData
            y: modelData.moves ? figure.offset : 0
            width: figure.width
            height: figure.height
            source: modelData.source
            smooth: true
            visible: !isNaN(figure.shown)
        }
    }
}
