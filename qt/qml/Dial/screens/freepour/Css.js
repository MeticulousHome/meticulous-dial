.pragma library
// The CSS of free-pour.css as the browser lays it out, for the QML of this directory.

// line-height: normal, per px of font-size, as the browser computes it (the fonts' OS/2 typo metrics:
// ABC Diatype ascent 0.85 + descent 0.15, ABC Diatype Mono 0.77 + 0.23; measured in the React build).
// Qt reads larger ascent / descent for ABC Diatype (0.975 / 0.276), but both center the glyphs on the line
// box the same way within 0.001 em, so a Text as tall as the CSS line box with AlignVCenter puts the
// baseline where the browser does.
const DIATYPE_NORMAL = 1.0
const MONO_NORMAL = 1.0

// The browser synthesizes bold (the fonts have no bold face) without widening the glyphs (measured: the
// bold and regular texts of the React build have the same advances).
const SYNTHETIC_BOLD_OFFSET = 0

// font-variant-numeric: tabular-nums (.free-pour-screen, .free-pour-history). ABC Diatype's tnum feature
// makes the space, the digits and : · + ° – 0.6 em wide. Qt 6.4 cannot turn font features on: the spaces
// get the difference as word spacing (0.6 em tabular minus Qt's 0.237 em space); digits and punctuation
// keep their proportional widths.
const TABULAR_WORD_SPACING_EM = 0.363

// The browser lays text out with hinted metrics: whole-pixel advances. ABC Diatype Mono's 0.6 em advance
// becomes 7 px at 11 px, 8 px at 13 px: the difference as letter spacing.
function monoAdvanceRounding(pixelSize) {
    return Math.round(pixelSize * 0.6) - pixelSize * 0.6
}

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

function isSyntheticBold(css) { return css >= 600 }
