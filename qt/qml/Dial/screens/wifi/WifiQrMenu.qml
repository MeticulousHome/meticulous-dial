// The connection code (src/components/Wifi/WifiQrMenu.tsx), in the bubble: the backend's QR PNG
// (GET /wifi/config/qr.png, Api.wifiQrUrl()) at 280 px with "Scan with meticulous App to connect to the
// machine" under it, and the yellow "Back". A push, or 30 s, returns to the Wi-Fi menu.
//
// Layout (QrImage in div.main-quick-settings.settings-explanation > .settings-explanation-container): the
// outer box is the panel shifted 20 px right and down (margins), the column (QR block with 100 px right
// padding, then the 90 % entry with an 80 px bottom margin) is centered in it; the QR block fills the
// 420 px, so the code is centered in its 320 px content and the caption wraps in 300 px (16 px left padding
// 20 px, line height 26 px).
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false
    readonly property string dialFocusedLabel: "Back"
    readonly property int dialProbe_qrStatus: qr.status

    function back() { Nav.setBubbleDisplay({ visible: true, component: "wifiSettings" }) }

    // Auto-exit timer
    Timer {
        interval: 30000
        running: true
        onTriggered: screen.back()
    }

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onPressDown: screen.back()
    }

    // The outer flex box: the panel's size, 20 px right and down.
    readonly property real boxX: 20
    readonly property real boxY: 20
    readonly property real boxWidth: width
    readonly property real boxHeight: height
    // The column fills the box width (its QR block's max-content is wider than the box).
    readonly property real columnWidth: boxWidth
    readonly property real qrBlockContent: columnWidth - 100
    readonly property real captionHeight: caption.lineCount * 26
    readonly property real columnHeight: 280 + 5 + captionHeight + entry.height + 80
    readonly property real columnY: boxY + (boxHeight - columnHeight) / 2

    Image {
        id: qr
        x: screen.boxX + (screen.qrBlockContent - 280) / 2
        y: screen.columnY
        width: 280
        height: 280
        source: Api.wifiQrUrl()
        cache: false
        smooth: true
        fillMode: Image.Stretch
    }
    // The 26 px line boxes put the half-leading above the glyphs (3 px lower than Qt's fixed-height lines).
    Text {
        id: caption
        x: screen.boxX + 20
        y: qr.y + 280 + 5 + 3
        width: screen.qrBlockContent - 20
        wrapMode: Text.WordWrap
        text: "Scan with meticulous App to connect to the machine"
        color: "white"
        font.family: Theme.fontRegular
        font.pixelSize: 16
        lineHeightMode: Text.FixedHeight
        lineHeight: 26
    }
    // .settings-item.active-setting: 90 % wide plus its 18 px left padding, 6 px around "Back".
    Rectangle {
        id: entry
        x: screen.boxX + (screen.columnWidth - width) / 2
        y: qr.y + 280 + 5 + screen.captionHeight
        width: screen.columnWidth * 0.9 + 18
        height: 26 + 12
        radius: 4
        color: Theme.brandYellow
        Text {
            x: 18 + 6
            y: 6
            height: 26
            verticalAlignment: Text.AlignVCenter
            text: "Back"
            color: "#0f0f0f"
            font.family: Theme.fontMono
            font.pixelSize: 22
            font.letterSpacing: 1.3
            font.capitalization: Font.AllUppercase
        }
    }
}
