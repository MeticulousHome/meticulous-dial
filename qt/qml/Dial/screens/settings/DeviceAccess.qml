// Devices of config (Settings.qml), in the bubble: which phones and browsers may use this machine.
//   - Pair a device: a one-time code as a QR code (PairDevice.qml).
//   - Require authorization: ON / OFF, toggled here (require_authorization). Off, every device on the
//     network can use the machine as before; on, only paired ones. Only the Dial can change it. Hidden
//     until the settings arrive, and on a backend without device authorization (no such setting).
//   - Sign out all devices: after a confirmation (SignOutDevices.qml).
//   - Back to config.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var settings: BackendSettings.data
    readonly property bool hasRequireAuthorization: !!settings && typeof settings.require_authorization === "boolean"

    readonly property var options: {
        const out = [{ key: "pair", label: "Pair a device" }]
        if (hasRequireAuthorization)
            out.push({ key: "require_authorization",
                       label: "Require authorization: " + (settings.require_authorization ? "ON" : "OFF") })
        out.push({ key: "sign_out_all", label: "Sign out all devices" })
        out.push({ key: "back", label: "Back" })
        return out
    }
    // The focus stays on the list when the toggle appears or goes.
    onOptionsChanged: menu.activeIndex = Math.min(menu.activeIndex, options.length - 1)

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            switch (item.key) {
            case "pair":
                Nav.openBubble("pairDevice")
                break
            case "require_authorization":
                if (screen.hasRequireAuthorization)
                    BackendSettings.update({ require_authorization: !screen.settings.require_authorization }).catch(() => {})
                break
            case "sign_out_all":
                Nav.openBubble("signOutDevices")
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
