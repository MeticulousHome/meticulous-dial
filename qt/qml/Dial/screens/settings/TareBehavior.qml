// Auto Tare (src/components/Settings/TareBehavior.tsx), a full-screen route opened from Brew Settings:
// tare after or before the retraction, the stored one marked "current" and focused when the screen opens
// (once the settings are there). A push stores the focused one; Back returns to the previous screen and
// reopens Brew Settings. Gestures wait for the settings.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    readonly property var settings: BackendSettings.data
    readonly property string current: settings ? String(settings.tare_behavior) : ""

    readonly property var choices: [
        { key: "after_retraction", label: "After retraction" },
        { key: "before_retraction", label: "Before retraction" },
        { key: "back", label: "Back" }
    ]
    readonly property var options: choices.map(c => ({ key: c.key, label: c.label,
                                                       annotation: c.key === current ? "current" : "" }))

    function selectedIndex() {
        const i = choices.findIndex(c => settings && c.key === settings.tare_behavior)
        return i >= 0 ? i : 0
    }
    property bool initializedFromSettings: false
    Component.onCompleted: {
        menu.activeIndex = selectedIndex()
        initializedFromSettings = !!settings
    }
    onSettingsChanged: {
        if (!initializedFromSettings && settings) {
            menu.activeIndex = selectedIndex()
            initializedFromSettings = true
        }
    }

    GestureHandler {
        enabled: !(Nav.bubbleInterceptsGesture || !screen.settings)
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const selected = screen.choices[menu.activeIndex].key
            if (selected === "back") {
                Nav.setScreen(Nav.prev)
                Nav.setBubbleDisplay({ visible: true, component: "brewSettings" })
                return
            }
            BackendSettings.update({ tare_behavior: selected }).catch(() => {})
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
        // SelectedOption: no marquee.
        marqueeMinTextLength: 100000
    }
}
