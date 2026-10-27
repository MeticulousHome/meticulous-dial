// A Text laid out as a CSS block with `line-height: <cssLineHeight>px` (0: normal): every line box that
// tall, the glyphs centered in it the way Chromium does (half-leading), so text lands where the React
// Dial draws it. Chromium lays ABC Diatype out with its hhea metrics (0.85 / 0.15 em, rounded) while Qt
// uses the win metrics (0.975 / 0.276 em); the mono cut uses its typo metrics in both (0.773 / 0.227).
// The padding moves Qt's first baseline onto Chromium's and makes the height n x line-height.
import QtQuick
import Dial

Text {
    id: text
    property real cssLineHeight: 0
    // The height of a "normal" line box where Chromium's differs from ascent + descent (mono light).
    property real cssNormalHeight: 0

    readonly property bool _mono: font.family === Theme.fontMono
    readonly property real _px: font.pixelSize
    readonly property real _cssAscent: Math.round((_mono ? 0.773 : 0.85) * _px)
    readonly property real _cssDescent: Math.round((_mono ? 0.227 : 0.15) * _px)
    readonly property real _qtAscent: (_mono ? 0.773 : 0.975) * _px
    readonly property real _qtHeight: _mono ? _px : (0.975 + 0.276) * _px
    readonly property real cssLine: cssLineHeight > 0 ? cssLineHeight
                                  : cssNormalHeight > 0 ? cssNormalHeight : _cssAscent + _cssDescent
    readonly property real _halfLeading: (cssLine - _cssAscent - _cssDescent) / 2

    color: "#e7e7e7"
    font.family: Theme.fontRegular
    font.pixelSize: 16
    lineHeightMode: Text.FixedHeight
    lineHeight: cssLine
    topPadding: _halfLeading + _cssAscent - _qtAscent
    bottomPadding: cssLine - topPadding - Math.max(cssLine, _qtHeight)
}
