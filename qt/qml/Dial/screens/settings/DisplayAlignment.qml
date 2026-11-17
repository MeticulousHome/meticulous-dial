// The display alignment screen (src/components/Settings/Advanced/DisplayAlignment.tsx), a full-screen route
// opened from Advanced Settings: one white vertical line, 1 % of the width, down the middle, to check the
// panel's mounting. A push returns to the previous screen (the home if none) and reopens Advanced Settings.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onPressDown: {
            Nav.setScreen(Nav.prev || "profileHome")
            Nav.setBubbleDisplay({ visible: true, component: "advancedSettings" })
        }
    }

    // NUMLINES = 1: width 1 %, margins 4.5 %, centred by the flex container.
    Rectangle {
        width: screen.width * 0.01
        height: screen.height
        x: (screen.width - width) / 2
        color: "white"
    }
}
