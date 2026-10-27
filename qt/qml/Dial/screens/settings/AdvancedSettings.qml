// Advanced Settings (src/components/Settings/Advanced/Advanced.tsx), in the bubble: SSH (toggled here),
// the display alignment screen, the update channel (hidden on a limited-access machine), the idle screen,
// the root password (case kept), factory reset, the manufacturing options when the backend offers them
// (GET /manufacturing answers 200, not 204), Back.
import QtQuick
import Dial
import "IdleScreens.js" as IdleScreens

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property bool limitedAccess: BackendSettings.limitedAccess

    readonly property var initialSettings: [
        { key: "ssh_enabled", label: "SSH" },
        { key: "displayAlignment", label: "Display Alignment Screen" },
        { key: "set_update_channel", label: "Update channel" },
        { key: "idle_screen", label: "Select Idle Screen" },
        { key: "root_password", label: "ROOT PASSWORD", caseSensitive: true },
        { key: "factory_reset", label: "Factory reset", caseSensitive: false }
    ]

    function valueOf(key, s) {
        switch (key) {
        case "ssh_enabled": return s.ssh_enabled ? "ENABLED" : "DISABLED"
        case "set_update_channel": return String(s.update_channel)
        case "idle_screen": return String(IdleScreens.shortLabel(s.idle_screen))
        }
        return null
    }

    readonly property var options: {
        const base = limitedAccess ? initialSettings.filter(i => i.key !== "set_update_channel") : initialSettings
        const s = settings
        if (!s) return base
        const formatted = base.map(item => {
            let label = item.label
            if (item.key === "root_password") label = item.label + ": " + (SettingsStore.rootPassword || "*****")
            else {
                const v = valueOf(item.key, s)
                if (v !== null) label = item.label + ": " + v
            }
            return { key: item.key, label: label, caseSensitive: !!item.caseSensitive }
        })
        const extra = SettingsStore.manufacturingSchema !== null && SettingsStore.manufacturingSchema !== undefined
                      ? [{ key: "manufacturing", label: "Manufacturing Options" }] : []
        return formatted.concat(extra, [{ key: "back", label: "Back" }])
    }
    // useEffect: the focus stays on the list when it gets shorter.
    onOptionsChanged: menu.activeIndex = Math.min(menu.activeIndex, options.length - 1)

    Component.onCompleted: {
        SettingsStore.fetchRootPassword()
        SettingsStore.fetchManufacturingSchema()
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            switch (item.key) {
            case "ssh_enabled":
                if (screen.settings) BackendSettings.update({ ssh_enabled: !screen.settings.ssh_enabled }).catch(() => {})
                break
            case "set_update_channel":
                Nav.openBubble("updateChannel")
                break
            case "idle_screen":
                Nav.openBubble("idleScreenSettings")
                break
            case "factory_reset":
                Nav.openBubble("factoryReset")
                break
            case "manufacturing":
                Nav.openBubble("manufacturingSettings")
                break
            case "displayAlignment":
                Nav.closeBubble()
                Nav.setScreen("displayAlignment")
                break
            case "back":
                Nav.openBubble("settings")
                break
            }
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
    }
}
