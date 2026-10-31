// "config" of the quick settings (src/components/Settings/Settings.tsx), in the bubble: Device Info,
// Community (with its connection state), time & date, sounds (toggled here), calibrate scale, Scroll
// Directions, disturbance resilience (its own screen; hidden when the firmware cannot store it), Advanced
// Settings, Back. Labels without values until the settings arrive. Unlike the other
// menus this one never scrolls a long label in the bar.
import QtQuick
import Dial
import "DisturbanceResilience.js" as DisturbanceResilience

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    // useCommunityUploadStatus: the Community uploader's status, when it exists.
    readonly property var uploader: SettingsStore.community
    // For the end-to-end tests, which put their stand-in uploader in it.
    readonly property QtObject settingsStore: SettingsStore
    readonly property var communityStatus: uploader ? uploader.status : null

    readonly property var initialSettings: [
        { key: "device_info", label: "Device Info" },
        { key: "community", label: "Community" },
        { key: "time_date", label: "time & date" },
        { key: "enable_sounds", label: "sounds" },
        { key: "calibrate", label: "calibrate scale" },
        { key: "scroll_directions", label: "Scroll Directions" },
        { key: DisturbanceResilience.SETTING_KEY, label: DisturbanceResilience.LABEL },
        { key: "advanced", label: "Advanced Settings" },
        { key: "back", label: "Back" }
    ]

    readonly property bool disturbanceResilienceAvailable: DisturbanceResilience.isAvailable(Device.info)
    readonly property var visibleSettings: initialSettings.filter(item =>
        disturbanceResilienceAvailable || item.key !== DisturbanceResilience.SETTING_KEY)

    readonly property var options: {
        if (!settings) return visibleSettings
        const state = communityStatus ? communityStatus.state : undefined
        return visibleSettings.map(item => {
            let label = item.label
            if (item.key === "community")
                label = "Community: " + (state === "connected" ? "Connected" : state === "upload_paused" ? "Upload paused" : "Not connected")
            else if (item.key === "enable_sounds")
                label = item.label + ": " + (settings.enable_sounds ? "ENABLED" : "DISABLED")
            return { key: item.key, label: label }
        })
    }

    // The bubble keeps this menu instead of mounting it each time (Bubble.kept): start as a fresh mount.
    function bubbleShown() {
        // Whether the firmware can store disturbance resilience comes with the machine info.
        Device.refreshInfo()
        menu.animated = false
        menu.activeIndex = 0
        menu.animated = true
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            switch (item.key) {
            case "device_info":
                Nav.openBubble("deviceInfo")
                break
            case "advanced":
                Nav.openBubble("advancedSettings")
                break
            case "community":
                Nav.openBubble("community")
                break
            case "calibrate":
                Nav.closeBubble()
                Nav.setScreen("calibrateScale")
                break
            case "enable_sounds":
                if (screen.settings) BackendSettings.update({ enable_sounds: !screen.settings.enable_sounds }).catch(() => {})
                break
            case "time_date":
                Nav.openBubble("timeDate")
                break
            case "scroll_directions":
                Nav.openBubble("scrollDirections")
                break
            case DisturbanceResilience.SETTING_KEY:
                // Like Help us improve: the hidden bubble keeps the gestures, so the release of this press
                // cannot click through and save on the screen.
                Nav.setBubbleDisplay({ visible: false, component: "", interceptsGesture: true })
                Nav.setScreen("disturbanceResilience")
                break
            case "back":
                Nav.openBubble("quick-settings")
                break
            }
        }
    }

    OptionsMenu {
        id: menu
        options: screen.options
        // Settings.tsx gives its inner options no $isMarquee: long labels are cut by the bar.
        marqueeMinTextLength: 100000
    }
}
