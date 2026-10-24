// Update channel (src/components/Settings/Advanced/UpdateChannel.tsx), in the bubble: stable or beta, the
// stored one marked "current"; a push stores the focused one. Back returns to Advanced Settings.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property string current: BackendSettings.data ? String(BackendSettings.data.update_channel) : ""
    readonly property var options: ["stable", "beta"].map(c => ({ key: c, label: c, annotation: c === current ? "current" : "" }))
                                   .concat([{ key: "back", label: "Back", annotation: current === "back" ? "current" : "" }])

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
            BackendSettings.update({ update_channel: item.key }).catch(() => {})
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
        marqueeMinTextLength: 100000
    }
}
