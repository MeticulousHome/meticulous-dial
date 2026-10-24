// A line of free-pour.css text: centered in a box as tall as the CSS line box (line-height: normal unless
// `lineHeightPx` says otherwise), so the baseline sits where the browser puts it (half-leading).
import QtQuick
import Dial
import "Css.js" as Css

Text {
    property bool mono: false
    property int cssWeight: 400
    property real lineHeightPx: font.pixelSize * (mono ? Css.MONO_NORMAL : Css.DIATYPE_NORMAL)

    width: parent ? parent.width : 480
    height: lineHeightPx
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    color: "#e7e3da"
    font.family: mono ? Theme.fontMono : Theme.fontRegular
    font.weight: Css.weight(cssWeight)
}
