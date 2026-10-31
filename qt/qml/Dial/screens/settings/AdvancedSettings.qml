// Advanced Settings (src/components/Settings/Advanced/Advanced.tsx), in the bubble: SSH (toggled here),
// Disturbance resilience (toggled here; hidden when the machine's firmware cannot store it, see
// DisturbanceResilience.js; a refused change keeps the value and shows "Could not save" in the header),
// the display alignment screen, the update channel (hidden on a limited-access machine), the idle screen,
// the root password (case kept), factory reset, the manufacturing options when the backend offers them
// (GET /manufacturing answers 200, not 204), Back.
import QtQuick
import Dial
import "IdleScreens.js" as IdleScreens
import "DisturbanceResilience.js" as DisturbanceResilience

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property bool limitedAccess: BackendSettings.limitedAccess
    readonly property bool disturbanceResilienceAvailable: DisturbanceResilience.isAvailable(Device.info)
    // A disturbance resilience change sent and not answered yet: further pushes on it are ignored.
    property bool disturbanceResiliencePending: false
    // The backend refused the last change: shown in the header until the next gesture.
    property bool disturbanceResilienceFailed: false
    property bool alive: true
    Component.onDestruction: alive = false

    readonly property var initialSettings: [
        { key: "ssh_enabled", label: "SSH" },
        { key: DisturbanceResilience.SETTING_KEY, label: DisturbanceResilience.LABEL },
        { key: "displayAlignment", label: "Display Alignment Screen" },
        { key: "set_update_channel", label: "Update channel" },
        { key: "idle_screen", label: "Select Idle Screen" },
        { key: "root_password", label: "ROOT PASSWORD", caseSensitive: true },
        { key: "factory_reset", label: "Factory reset", caseSensitive: false }
    ]

    function valueOf(key, s) {
        switch (key) {
        case "ssh_enabled": return s.ssh_enabled ? "ENABLED" : "DISABLED"
        case DisturbanceResilience.SETTING_KEY: return DisturbanceResilience.valueText(s)
        case "set_update_channel": return String(s.update_channel)
        case "idle_screen": return String(IdleScreens.shortLabel(s.idle_screen))
        }
        return null
    }

    readonly property var options: {
        const base = initialSettings.filter(i => !(limitedAccess && i.key === "set_update_channel")
                                                 && !(!disturbanceResilienceAvailable && i.key === DisturbanceResilience.SETTING_KEY))
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
        // disturbance_resilience_supported: the device info is otherwise only refetched every 2 h.
        Device.refreshInfo()
    }

    function toggleDisturbanceResilience() {
        if (!settings || disturbanceResiliencePending) return
        disturbanceResiliencePending = true
        disturbanceResilienceFailed = false
        // The item keeps the backend's value until it answers: BackendSettings takes its answer as the data.
        BackendSettings.update({ disturbance_resilience: !DisturbanceResilience.isEnabled(settings) }).then(() => {
            if (!screen.alive) return
            screen.disturbanceResiliencePending = false
        }).catch(error => {
            console.error("Could not save disturbance_resilience:", DisturbanceResilience.errorMessage(error))
            if (!screen.alive) return
            screen.disturbanceResiliencePending = false
            screen.disturbanceResilienceFailed = true
        })
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: { screen.disturbanceResilienceFailed = false; menu.previous() }
        onTurnRight: { screen.disturbanceResilienceFailed = false; menu.next() }
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            screen.disturbanceResilienceFailed = false
            switch (item.key) {
            case DisturbanceResilience.SETTING_KEY:
                screen.toggleDisturbanceResilience()
                break
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
        headerText: screen.disturbanceResilienceFailed ? DisturbanceResilience.SAVE_FAILED_TEXT : ""
    }
}
