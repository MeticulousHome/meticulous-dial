// Select Idle Screen (src/components/Settings/Advanced/IdleScreenSetting.tsx), in the bubble: analog,
// digital, cat or DVD, the stored one marked "current". A push stores the focused one and, 300 ms later,
// sends the Dial to the idle screen to show it (the bubble reopens when it wakes). Back returns to
// Advanced Settings.
import QtQuick
import Dial
import "IdleScreens.js" as IdleScreens

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property string current: BackendSettings.data ? String(BackendSettings.data.idle_screen) : ""
    readonly property var options: IdleScreens.IDLE_SCREENS.concat([{ key: "back", label: "Back" }])
        .map(i => ({ key: i.key, label: i.label, annotation: i.key === current ? "current" : "" }))

    Timer {
        id: showIdle
        interval: 300
        onTriggered: {
            Idle.forceIdle()
            Idle.setForceBubbleReopen(true)
        }
    }

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
            BackendSettings.update({ idle_screen: item.key }).catch(() => {})
            showIdle.restart()
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
        marqueeMinTextLength: 100000
    }
}
