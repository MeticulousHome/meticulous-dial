// A rounded option (.shot-data-sharing-action, .report-contact-option): a 2 px #e7e7e766 outline with
// #e7e7e7b3 text, or filled #f5c444 with #171717 text when active. Sizes as the CSS box model adds them:
// minimum content width + padding + border; a label wider than maxWidth ends in an ellipsis.
import QtQuick
import Dial

Rectangle {
    id: pill
    property string text: ""
    property bool active: false
    property real fontSize: 21
    property real padV: 10
    property real padH: 18
    // min-width of the content box (content-box sizing) and the widest the pill may get (0: no limit).
    property real minContentWidth: 140
    property real maxWidth: 0
    property string fontFamily: Theme.fontRegular

    readonly property real _natural: Math.max(minContentWidth, label.implicitWidth) + 2 * padH + 4
    implicitWidth: maxWidth > 0 ? Math.min(maxWidth, _natural) : _natural
    implicitHeight: label.cssLine + 2 * padV + 4
    radius: height / 2
    color: active ? Theme.brandYellow : "transparent"
    border.width: 2
    border.color: active ? Theme.brandYellow : Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0.4)

    CssText {
        id: label
        x: pill.padH + 2
        y: pill.padV + 2
        width: pill.width - 2 * pill.padH - 4
        text: pill.text
        horizontalAlignment: Text.AlignHCenter
        elide: Text.ElideRight
        color: pill.active ? "#171717" : Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0.7)
        font.family: pill.fontFamily
        font.pixelSize: pill.fontSize
        cssLineHeight: pill.fontSize * 1.2
    }
}
