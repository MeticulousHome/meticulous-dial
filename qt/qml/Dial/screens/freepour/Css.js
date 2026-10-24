.pragma library
// The CSS of free-pour.css as the browser lays it out, for the QML of this directory.

// line-height: normal, per px of font-size (the fonts' ascent + descent, as FontMetrics reports them).
const DIATYPE_NORMAL = 1.2509375
const MONO_NORMAL = 1.0

// display: flex; flex-direction: column; justify-content: center: the top of each box, given
// [[margin-top, height], ...] in document order.
function flexColumnTops(containerHeight, boxes) {
    let total = 0
    for (const box of boxes) total += box[0] + box[1]
    let y = (containerHeight - total) / 2
    const tops = []
    for (const box of boxes) {
        y += box[0]
        tops.push(y)
        y += box[1]
    }
    return tops
}

// font-weight to a QFont weight. Only the light (300) and regular faces exist: the browser picks regular
// for 400-550 and synthesizes bold from 600 up, as Qt does for a Bold request.
function weight(css) {
    if (css <= 300) return 300
    if (css < 600) return 400
    return 700
}
