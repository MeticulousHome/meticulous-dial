// theme (config of the quick settings), in the bubble: dark or light, the one shown marked "current". A push
// stores it (the `theme` setting) and the whole Dial changes. Unset, which follows the machine's color
// (ThemeRule.js), is what a machine starts with and is not offered here. Back returns to config.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property var options: [
        { key: "dark", label: "Dark", annotation: Theme.light ? "" : "current" },
        { key: "light", label: "Light", annotation: Theme.light ? "current" : "" },
        { key: "back", label: "Back" }
    ]

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (item.key === "back") {
                Nav.openBubble("settings")
                return
            }
            if (!screen.settings) return
            // A backend without the setting (the previous version): kept by this Dial.
            if (screen.settings.theme === undefined) Theme.setMode(item.key)
            else BackendSettings.update({ theme: item.key }).catch(() => {})
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
    }
}
