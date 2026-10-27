// A paragraph of a .settings-explanation block wrapped inside the round display by the block's two float
// shapers (src/components/Settings/settings.css .settings-explanation-shaper-left / -right: 50 % x 50 %
// floats, shape-outside polygons, shape-margin 1 %). Qt has no shape-outside: the words are laid out line
// by line, each line box getting the room the two float areas (the polygons grown by the margin, clipped
// to the floats' boxes) leave in its band, as the browser does.
//
// The floats are 50 % of the block's height (the block is a flex item, so its height is definite): the
// block is textTop + lines x lineHeight + belowText tall, solved by iterating on the line count.
// Line breaks are decided with whole-pixel character advances, as the browser's text shaping rounds them
// (a mono font only: every character has the same advance).
import QtQuick
import Dial

Item {
    id: expl
    property string text: ""
    property real boxWidth: 400        // the block's content box
    property real textTop: 20          // the paragraph's padding-top
    property real textRight: 20        // the paragraph's padding-right
    property real lineHeight: 26
    property real belowText: 0         // the block's height under the paragraph
    property color color: "#dddddd"
    property int pixelSize: 22
    property string family: Theme.fontMono

    // [{ text, x }] per line, and the paragraph's height (padding included).
    property var lines: []
    readonly property real paragraphHeight: textTop + lines.length * lineHeight

    width: boxWidth
    height: paragraphHeight

    // Polygons in % of the float box (x may be px), as in settings.css.
    readonly property var leftShape: [[0, -9.65], [41.5, -9.3], [15, 11.58], [0, 32.67], ["-25px", 44.74]]
    readonly property var rightShape: [[8.5, -13.16], [44.5, 13.51], [65.5, 46.66], [82.14, 86.44], [96.3, 131.26], [99.5, 190.35], [100, -13.16]]

    FontMetrics {
        id: metrics
        font.family: expl.family
        font.pixelSize: expl.pixelSize
    }

    function samples(shape, w, h, offsetX) {
        const pts = shape.map(p => [offsetX + (typeof p[0] === "string" ? parseFloat(p[0]) : p[0] * w / 100), p[1] * h / 100])
        const out = []
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length]
            const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])))
            for (let s = 0; s < steps; s++) out.push([a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps])
        }
        return out
    }

    // The room [left, right] of the line box from y1 to y2.
    function room(y1, y2, left, right, w, h, r) {
        let l = 0
        let rr = boxWidth - textRight
        const b1 = Math.max(y1, 0), b2 = Math.min(y2, h)
        if (b1 < b2) {
            let maxX = -Infinity
            for (const q of left) {
                const dy = q[1] < b1 ? b1 - q[1] : (q[1] > b2 ? q[1] - b2 : 0)
                if (dy <= r) maxX = Math.max(maxX, q[0] + Math.sqrt(r * r - dy * dy))
            }
            if (maxX > 0) l = Math.min(maxX, w)
            let minX = Infinity
            for (const q of right) {
                const dy = q[1] < b1 ? b1 - q[1] : (q[1] > b2 ? q[1] - b2 : 0)
                if (dy <= r) minX = Math.min(minX, q[0] - Math.sqrt(r * r - dy * dy))
            }
            if (minX < boxWidth) rr = Math.min(rr, Math.max(minX, boxWidth - w))
        }
        return [l, rr]
    }

    function layoutFor(lineCount) {
        const w = boxWidth / 2
        const h = (textTop + lineCount * lineHeight + belowText) / 2
        const r = boxWidth / 100
        const left = samples(leftShape, w, h, 0)
        const right = samples(rightShape, w, h, boxWidth - w)
        const advance = Math.round(metrics.advanceWidth("0"))
        const words = text.split(" ").filter(s => s.length)
        const out = []
        let i = 0
        while (i < words.length) {
            const top = textTop + out.length * lineHeight
            const [l, rr] = room(top, top + lineHeight, left, right, w, h, r)
            let line = words[i++]
            while (i < words.length && (line.length + 1 + words[i].length) * advance <= rr - l) line += " " + words[i++]
            out.push({ text: line, x: l })
        }
        return out
    }

    function relayout() {
        if (!text.length) { lines = []; return }
        let result = layoutFor(1)
        for (let k = 0; k < 4; k++) {
            const next = layoutFor(result.length)
            const same = next.length === result.length
            result = next
            if (same) break
        }
        lines = result
    }
    onTextChanged: relayout()
    onBoxWidthChanged: relayout()
    Component.onCompleted: relayout()

    Repeater {
        model: expl.lines.length
        Text {
            required property int index
            x: expl.lines[index].x
            y: expl.textTop + index * expl.lineHeight
            height: expl.lineHeight
            verticalAlignment: Text.AlignVCenter
            text: expl.lines[index].text
            color: expl.color
            font.family: expl.family
            font.pixelSize: expl.pixelSize
        }
    }
}
