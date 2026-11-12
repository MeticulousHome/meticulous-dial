// "Sign out all devices" of Devices (DeviceAccess.qml), in the bubble: the warning, then "Sign out all
// devices" and Back (focused first, so a stray push does nothing). Signing out calls
// POST /api/v1/auth/sign_out_all, showing the loading ring while it runs, and returns to Devices when it
// is done: every phone and browser has to pair again, and those connected now are disconnected. A failure
// stays here with its reason; a backend without device authorization (404) says it does not support it.
// Layout as FactoryReset.qml: the text from the top of the 420 px bubble, the two entries at the bottom.
import QtQuick
import Dial
import "Pairing.js" as Pairing

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    property int activeIndex: 1
    // idle | pending | error | unsupported
    property string signOutState: "idle"
    property bool alive: true
    Component.onDestruction: alive = false

    readonly property bool loading: signOutState === "pending"
    readonly property var settings: [
        { key: "sign_out_all", label: "Sign out all devices", widthPercentage: 81 },
        { key: "back", label: "Back", widthPercentage: 81 }
    ]
    readonly property string dialFocusedLabel: loading ? "" : settings[activeIndex].label
    readonly property string dialProbe_signOutState: signOutState
    readonly property string errorText: signOutState === "unsupported" ? Pairing.UNSUPPORTED_TEXT
                                      : signOutState === "error" ? "Could not sign out the devices. Try again." : ""

    function signOut() {
        signOutState = "pending"
        Api.signOutAllDevices().then(() => {
            if (!screen.alive) return
            screen.signOutState = "idle"
            Nav.openBubble("deviceAccess")
        }).catch(error => {
            if (!screen.alive) return
            if (error && error.status === 404) {
                screen.signOutState = "unsupported"
                return
            }
            console.error("Could not sign out all devices, status", error ? error.status : "none")
            screen.signOutState = "error"
        })
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture && !screen.loading
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.settings.length - 1)
        onPressDown: {
            if (screen.settings[screen.activeIndex].key === "sign_out_all") screen.signOut()
            else Nav.openBubble("deviceAccess")
        }
    }

    // .loading-center is position: fixed: the whole display, also in the bubble.
    Item {
        visible: screen.loading
        x: screen.inBubble ? -60 : 0
        width: 480
        height: 480
        LoadingScreen {}
    }

    // ---- the warning and the two entries
    Item {
        anchors.fill: parent
        visible: !screen.loading

        Text {
            x: 68
            y: 30
            height: 26
            verticalAlignment: Text.AlignVCenter
            text: "WARNING"
            color: Theme.brandYellow
            font.family: Theme.fontRegular
            font.pixelSize: 20
            font.bold: true
        }
        Column {
            x: 20
            y: 74
            width: 330
            spacing: 12
            component Paragraph: Text {
                width: parent.width
                wrapMode: Text.WordWrap
                color: "white"
                font.family: Theme.fontRegular
                font.pixelSize: 20
                lineHeight: 26
                lineHeightMode: Text.FixedHeight
            }
            Paragraph {
                text: "Sign out every device?"
                color: Theme.brandYellow
                font.bold: true
            }
            Paragraph { text: "Every phone and browser that uses this machine will have to pair again." }
            Paragraph { text: "This machine's own screen keeps working." }
        }

        Text {
            visible: text.length > 0
            x: 20
            y: 292
            width: 330
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: screen.errorText
            color: "#ff7b70"
            font.family: Theme.fontRegular
            font.pixelSize: 15
            lineHeight: 18.75
            lineHeightMode: Text.FixedHeight
        }

        // .settings-fixed-item-container: at the bottom, 50 px above the edge; items right-aligned, 81 % +
        // 9 % right padding + 18 px left padding = 396 px, 38 px tall, 5 px apart.
        Repeater {
            model: screen.settings.length
            delegate: Rectangle {
                required property int index
                readonly property bool active: index === screen.activeIndex
                x: 420 - width
                y: 480 - 50 - 2 * 43 + index * 43
                width: 420 * screen.settings[index].widthPercentage / 100 + 420 * (90 - screen.settings[index].widthPercentage) / 100 + 18
                height: 38
                radius: 4
                color: active ? Theme.brandYellow : "transparent"
                Text {
                    x: 18
                    width: 420 * screen.settings[parent.index].widthPercentage / 100
                    height: parent.height
                    verticalAlignment: Text.AlignVCenter
                    clip: true
                    text: screen.settings[parent.index].label
                    color: parent.active ? "#0f0f0f" : "#dddddd"
                    font.family: Theme.fontMono
                    font.pixelSize: 22
                    font.letterSpacing: 1.3
                    font.capitalization: Font.AllUppercase
                }
            }
        }
    }
}
