// Set time zone (src/components/Settings/Advanced/TimeDate/TimeZone/TimeZoneConfig.tsx), in the bubble:
// Automatic (timezone_sync automatic / manual, toggled here), Select Timezone (only when manual: closes the
// bubble and asks for the country's first letter), Back to time & date.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property var initialSettings: [
        { key: "timezone_sync", label: "Automatic" },
        { key: "time_zone_selector", label: "Select Timezone" },
        { key: "back", label: "Back" }
    ]
    readonly property var options: {
        const s = settings
        const shown = initialSettings.filter(i => i.key !== "time_zone_selector" || (s && s.timezone_sync === "manual"))
        if (!s) return shown
        return shown.map(i => i.key === "timezone_sync"
                         ? { key: i.key, label: i.label + ": " + (s.timezone_sync === "automatic" ? "ENABLED" : "DISABLED") }
                         : i)
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[Math.min(menu.activeIndex, screen.options.length - 1)]
            if (!item) return
            switch (item.key) {
            case "timezone_sync":
                if (screen.settings)
                    BackendSettings.update({ timezone_sync: screen.settings.timezone_sync === "automatic" ? "manual" : "automatic" })
                        .catch(() => {})
                break
            case "time_zone_selector":
                Nav.closeBubble()
                Nav.setScreen("selectLetterCountry")
                break
            case "back":
                Nav.openBubble("timeDate")
                break
            }
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
    }
}
