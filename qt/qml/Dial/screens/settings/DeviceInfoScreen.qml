// Device Info (src/components/Settings/Advanced/DeviceInfoScreen.tsx), in the bubble: "Show device info QR",
// then every field of GET /machine as "key: value" (booleans as ENABLED / DISABLED, null as UNSET, without
// tare_behavior_supported), the backend / dial / firmware repositories as "key: branch (hash - comment...)",
// Back. The loading ring until the first answer; the device info is refetched when the screen opens.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var info: Device.info
    readonly property bool isLoading: Device.infoPending

    function describe(value) {
        if (typeof value === "boolean") return value ? "ENABLED" : "DISABLED"
        if (value === null || value === undefined) return "UNSET"
        return String(value)
    }

    readonly property var options: {
        const info = screen.info
        if (!info || isLoading) return []
        const basic = []
        for (const key in info) {
            if (key === "repository_info" || key === "tare_behavior_supported") continue
            basic.push({ key: key, label: key + ": " + describe(info[key]) })
        }
        const repositories = []
        const repo = info.repository_info
        if (repo) {
            for (const key in repo) {
                if (["backend", "dial", "firmware"].indexOf(key) < 0) continue
                const entry = repo[key] || {}
                // React splits "hash-comment" and would throw on a commit without "-": keep it empty instead.
                const parts = String(entry.commit || "").split("-")
                const comment = parts[1] || ""
                repositories.push({ key: key, label: key + ": " + entry.branch + " (" + parts[0].trim() + " - "
                                                    + (comment.length > 20 ? comment.slice(0, 20) : comment) + "...)" })
            }
        }
        return [{ key: "info_qr", label: "Show device info QR" }].concat(basic, repositories, [{ key: "back", label: "Back" }])
    }

    Component.onCompleted: Device.refreshInfo()

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            switch (item.key) {
            case "info_qr":
                Nav.openBubble("deviceInfoQR")
                break
            case "back":
                Nav.openBubble("settings")
                break
            }
        }
    }

    LoadingScreen { visible: screen.isLoading }

    OptionsMenu {
        id: menu
        visible: !screen.isLoading
        options: screen.options
    }
}
