// Experimental of the quick settings (src/components/Settings/Experimental.tsx), in the bubble: features
// not yet part of the product, one menu away. Manual mode closes the bubble (still intercepting, so the
// release of this press cannot click through on the setup screen) and opens the manual setup.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var options: [
        { key: "manual_mode", label: "Manual mode" },
        { key: "back", label: "Back" }
    ]

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            switch (screen.options[menu.activeIndex].key) {
            case "manual_mode":
                Nav.setBubbleDisplay({ visible: false, component: "", interceptsGesture: true })
                Nav.setScreen("manualSetup")
                break
            case "back":
                Nav.openBubble("quick-settings")
                break
            }
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
    }
}
