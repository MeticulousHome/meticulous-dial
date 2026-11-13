// "Connect to a new network" (src/components/Wifi/ConnectWifiMenu.tsx), in the bubble: "Connect via APP"
// (the explanation), "Connect to a network" (the scan) and "Back" to the Wi-Fi menu. Nothing in the React
// Dial opens it any more (the Wi-Fi menu goes straight to the scan); ported for completeness.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0

    readonly property var items: [
        { key: "connect-via-app", label: "Connect via APP" },
        { key: "choose-wifi", label: "Connect to a network" },
        { key: "back", label: "Back" }
    ]

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.items.length - 1)
        onPressDown: {
            switch (screen.items[screen.activeIndex].key) {
            case "connect-via-app": Nav.setBubbleDisplay({ visible: true, component: "connectWifiViaApp" }); break
            case "choose-wifi": Nav.setBubbleDisplay({ visible: true, component: "selectWifi" }); break
            case "back": Nav.setBubbleDisplay({ visible: true, component: "wifiSettings" }); break
            }
        }
    }

    OptionsMenu {
        options: screen.items
        activeIndex: screen.activeIndex
    }
}
