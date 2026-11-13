// A line of free-pour.css text: centered in a box as tall as the CSS line box (line-height: normal unless
// `lineHeightPx` says otherwise), so the baseline sits where the browser puts it (half-leading).
// `letterSpacingPx` is the CSS letter-spacing; `tabular` is font-variant-numeric: tabular-nums (the spaces
// of ABC Diatype as wide as its tabular figures).
import QtQuick
import Dial
import "Css.js" as Css

Text {
    property bool mono: false
    property bool tabular: true
    property int cssWeight: 400
    property real letterSpacingPx: 0
    property real lineHeightPx: pixelSize * (mono ? Css.MONO_NORMAL : Css.DIATYPE_NORMAL)
    // The size alone: the spacing bindings below write `font`, and reading font.pixelSize in them would make
    // each write re-run them (a binding loop).
    readonly property real pixelSize: font.pixelSize

    width: parent ? parent.width : 480
    height: lineHeightPx
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    color: "#e7e3da"
    font.family: mono ? Theme.fontMono : Theme.fontRegular
    font.weight: Css.weight(cssWeight)
    font.letterSpacing: letterSpacingPx + (Css.isSyntheticBold(cssWeight) ? Css.SYNTHETIC_BOLD_OFFSET : 0)
                        + (mono ? Css.monoAdvanceRounding(pixelSize) : 0)
    font.wordSpacing: tabular && !mono ? pixelSize * Css.TABULAR_WORD_SPACING_EM : 0
}
