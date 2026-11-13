// Scroll Directions (src/components/Settings/ScrollDirection.tsx), in the bubble: whether the knob is
// reversed on the profiles carousel and on the keyboard (reverse_scrolling.home / .keyboard), toggled here.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property var initialSettings: [
        { key: "home", label: "Profiles" },
        { key: "keyboard", label: "Keyboard" },
        { key: "back", label: "Back" }
    ]
    readonly property var options: {
        const s = settings
        if (!s) return initialSettings
        const rs = s.reverse_scrolling || {}
        return initialSettings.map(item => item.key === "back" ? item
            : { key: item.key, label: item.label + ": " + (rs[item.key] ? "Reversed" : "Classic") })
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            if (item.key === "back") {
                Nav.openBubble("quick-settings")
                return
            }
            if (!screen.settings) return
            const reverse = Object.assign({}, screen.settings.reverse_scrolling)
            reverse[item.key] = !reverse[item.key]
            BackendSettings.update({ reverse_scrolling: reverse }).catch(() => {})
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
    }
}
