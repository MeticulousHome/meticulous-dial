// .free-pour-abort-hint: 46 px from the bottom, Mono 13 px, 600, 0.9 px tracking, upper case.
import QtQuick

FpText {
    y: 480 - 46 - lineHeightPx
    mono: true
    cssWeight: 600
    font.pixelSize: 13
    letterSpacingPx: 0.9
    font.capitalization: Font.AllUppercase
    color: "#8d9694"
    text: "Double-press the dial to abort"
}
