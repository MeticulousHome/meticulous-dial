// Brew Settings of the quick settings (src/components/Settings/BrewSettings.tsx), in the bubble: Start and
// Purge (automatic / on button press, toggled here), the retraction distance and Auto Tare (their own
// full-screen routes; Auto Tare only when the machine supports it), Pre/Post-heat (its own route), Back.
// The device info is refetched every 10 s while it is open (tare_behavior_supported).
import QtQuick
import Dial
import "Retraction.js" as Retraction

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property bool tareSupported: !!(Device.info && Device.info.tare_behavior_supported)

    readonly property var initialSettings: [
        { key: "auto_start_shot", label: "Start" },
        { key: "auto_purge_after_shot", label: "Purge" },
        { key: "shot_volume", label: "Retraction distance" },
        { key: "tare_behavior", label: "Auto Tare" },
        { key: "heat_timeout_after_shot", label: "Pre/Post-heat" },
        { key: "back", label: "Back" }
    ]

    function valueOf(key, s) {
        switch (key) {
        case "auto_start_shot": return s.auto_start_shot ? "Automatic" : "On button press"
        case "auto_purge_after_shot": return s.auto_purge_after_shot ? "Automatic" : "On button press"
        case "shot_volume": return Retraction.retractionMmToVolumeMl(s.partial_retraction) + " mL"
        case "tare_behavior": return s.tare_behavior === "before_retraction" ? "Before retraction" : "After retraction"
        case "heat_timeout_after_shot": return s.heating_timeout + " min"
        }
        return null
    }

    readonly property var options: {
        const s = settings
        if (!s) return initialSettings
        return initialSettings.map(item => {
            if (item.key === "tare_behavior" && !tareSupported) return { key: item.key, label: item.label + ": Unavailable" }
            const v = valueOf(item.key, s)
            return { key: item.key, label: v === null ? item.label : item.label + ": " + v }
        })
    }

    // useDeviceInfo({ refetchInterval: 10000 }): refetched on mount and every 10 s.
    Timer {
        interval: 10000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: Device.refreshInfo()
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            switch (item.key) {
            case "heat_timeout_after_shot":
                Nav.setScreen("heat_timeout_after_shot")
                Nav.closeBubble()
                break
            case "shot_volume":
                Nav.setScreen("retraction_volume")
                Nav.closeBubble()
                break
            case "tare_behavior":
                if (!screen.tareSupported) break
                Nav.setScreen("tare_behavior")
                Nav.closeBubble()
                break
            case "back":
                Nav.openBubble("quick-settings")
                break
            default: {
                const s = screen.settings
                if (s && typeof s[item.key] === "boolean") {
                    const change = {}
                    change[item.key] = !s[item.key]
                    BackendSettings.update(change).catch(() => {})
                } else {
                    console.error("This setting type is not yet implemented!")
                }
            }
            }
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
    }
}
