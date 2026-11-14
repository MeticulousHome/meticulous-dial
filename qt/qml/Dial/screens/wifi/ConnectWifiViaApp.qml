// "Connect via APP" (src/components/Wifi/ConnetWifiViaApp.tsx, connectWifiViaApp.css), in the bubble: how
// to add the machine from the meticulous app (ABC Diatype Mono 22 px, #dddddd, 26 px lines, wrapped in the
// round display by the explanation shapers) and the yellow "Back"; a push returns to "Connect to a new
// network".
//
// Layout: the .settings-explanation block sits 20 px from the panel's top and left, 400 px wide; the help
// text has 20 px of padding on top and right; "Back" is 90 % wide plus 18 px padding, 50 px under the
// text, 6 px around a 26 px line, with 80 px under it.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false
    readonly property string dialFocusedLabel: "Back"

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onPressDown: Nav.setBubbleDisplay({ visible: true, component: "connectWifiMenu" })
    }

    readonly property real blockWidth: Math.min(screen.width - 20, 400)

    WifiExplanation {
        id: help
        x: 20
        y: 20
        boxWidth: screen.blockWidth
        textTop: 20
        textRight: 20
        lineHeight: 26
        belowText: 50 + 38 + 80
        text: "To connect the machine to your existing WiFi download the meticulous App in the AppStore or PlayStore and select \"Add Device\" in the settings menu. An authentication will be requested if needed and the app will quide you through the process."
    }

    Rectangle {
        x: 20
        y: help.y + help.paragraphHeight + 50
        width: screen.blockWidth * 0.9 + 18
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
