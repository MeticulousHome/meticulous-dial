// time & date (src/components/Settings/Advanced/TimeDate/TimeDateConfig.tsx), in the bubble: the time zone
// (its own menu), the 12 / 24-hour format (toggled here, one change at a time), the OS time and date (their
// own setters, read every second), Back to the settings.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    property bool updatePending: false

    // uses24HourClock: clock_format_24_hour, 24-hour when unset.
    function uses24HourClock(s) {
        return s && s.clock_format_24_hour !== undefined && s.clock_format_24_hour !== null ? !!s.clock_format_24_hour : true
    }

    LocalClock { id: clock }

    readonly property var initialSettings: [
        { key: "time_zone", label: "Set time zone" },
        { key: "clock_format_24_hour", label: "Time format" },
        { key: "set_time", label: "Set Time" },
        { key: "set_date", label: "Set Date" },
        { key: "back", label: "Back" }
    ]
    readonly property var options: {
        const s = settings
        if (!s) return initialSettings
        return initialSettings.map(item => {
            switch (item.key) {
            case "time_zone": return { key: item.key, label: item.label + ": " + (s.time_zone || "Not set") }
            case "clock_format_24_hour": return { key: item.key, label: item.label + ": " + (uses24HourClock(s) ? "24-hour" : "12-hour") }
            case "set_time": return { key: item.key, label: item.label + ": " + clock.hours + ":" + clock.minutes }
            case "set_date": return { key: item.key, label: item.label + ": " + clock.year + "-" + clock.month + "-" + clock.day }
            }
            return item
        })
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            switch (screen.options[menu.activeIndex].key) {
            case "clock_format_24_hour":
                if (screen.settings && !screen.updatePending) {
                    screen.updatePending = true
                    BackendSettings.update({ clock_format_24_hour: !screen.uses24HourClock(screen.settings) })
                        .then(() => { screen.updatePending = false }, () => { screen.updatePending = false })
                }
                break
            case "time_zone":
                Nav.openBubble("timeZoneConfig")
                break
            case "set_time":
                Nav.openBubble("timeConfig")
                break
            case "set_date":
                Nav.openBubble("dateConfig")
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
