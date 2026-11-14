// Start Animation (Advanced Settings), in the bubble: what the home's "Hold to start" ring looks like: the
// plain ring, sparks or rainbow sparkles (Core/HoldAnimation.qml), the stored one marked "current". A push
// stores the focused one, in the Dial's own storage. Back returns to Advanced Settings.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property string current: HoldAnimation.style
    readonly property var options: HoldAnimation.choices.concat([{ key: "back", label: "Back" }])
        .map(i => ({ key: i.key, label: i.label, annotation: i.key === current ? "current" : "" }))

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (item.key === "back") {
                Nav.openBubble("advancedSettings")
                return
            }
            HoldAnimation.setStyle(item.key)
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
        marqueeMinTextLength: 100000
    }
}
