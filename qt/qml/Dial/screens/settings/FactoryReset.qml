// Factory reset (src/components/Settings/Advanced/FactoryReset.tsx, FactoryReset.css), in the bubble: the
// warning, then "!! Factory reset !!" and Back (focused first). Factory reset asks for the machine's serial
// on the circle keyboard (over the whole screen); a matching serial (case and surrounding spaces ignored)
// wipes the Community uploader's local state (Community.factoryResetLocal, when it exists) and calls
// GET /machine/factory_reset?confirm=true, showing the loading ring while it runs and after it succeeded.
// A wrong serial clears the field and says "Serial does not match"; cancelling returns to the warning.
//
// The warning is laid out as the browser does it in the 420 px bubble (.settings-explanation: 20 px
// margins, 20 px / 26 px ABC Diatype; the shape-outside floats only indent and wrap its first lines): the
// line breaks are the ones the React Dial renders.
import QtQuick
import Dial
import Dial.Native

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    property int activeIndex: 1
    property bool serialPromptOpen: false
    property string serialInput: ""
    property bool serialRejected: false
    // useFactoryReset: idle | pending | success | error
    property string resetState: "idle"

    readonly property string deviceSerial: Device.info && Device.info.serial !== undefined && Device.info.serial !== null
                                           ? String(Device.info.serial).trim() : ""
    readonly property bool loading: resetState === "pending" || resetState === "success" || (serialPromptOpen && Device.infoPending)

    readonly property var settings: [
        { key: "factory_reset", label: "!! Factory reset !!", widthPercentage: 81 },
        { key: "back3", label: "Back", widthPercentage: 81 }
    ]
    readonly property string dialFocusedLabel: serialPromptOpen || loading ? "" : settings[activeIndex].label
    readonly property string dialProbe_resetState: resetState

    function openSerialPrompt() {
        serialInput = ""
        serialRejected = false
        serialPromptOpen = true
    }
    function closeSerialPrompt() {
        serialInput = ""
        serialRejected = false
        serialPromptOpen = false
    }

    // api.ts factoryReset: the local Community state first (a failure aborts), then the backend.
    function factoryReset() {
        resetState = "pending"
        new Promise((resolve, reject) => {
            if (typeof Community !== "undefined" && Community) {
                const error = Community.factoryResetLocal()
                if (error) { reject(new Error(error)); return }
            }
            resolve()
        }).then(() => Api.factoryReset()).then(data => {
            if (data && data.error) throw new Error(data.error)
            console.log("Factory Reset successfull.")
            resetState = "success"
        }).catch(error => {
            console.error("Error during factory reset", error && error.message ? error.message : error)
            resetState = "error"
        })
    }

    GestureHandler {
        enabled: !(screen.serialPromptOpen || !Nav.bubbleInterceptsGesture) && !screen.loading
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.settings.length - 1)
        onPressDown: {
            if (screen.settings[screen.activeIndex].key === "factory_reset") screen.openSerialPrompt()
            else Nav.openBubble("advancedSettings")
        }
    }

    LoadingScreen { visible: screen.loading }

    // ---- the warning and the two entries
    Item {
        anchors.fill: parent
        visible: !screen.loading && !screen.serialPromptOpen

        component Line: Text {
            x: 20
            height: 26
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.StyledText
            color: "white"
            font.family: Theme.fontRegular
            font.pixelSize: 20
        }
        Line { x: 68; y: 30; text: "<b><font color='#f5c444'>WARNING</font></b>" }
        Line { y: 66; text: "<b><font color='#f5c444'>This operation cannot be undone</font></b>" }
        Line { y: 92; text: "Before continuing make sure to do the" }
        Line { y: 118; text: "following:" }
        Line { y: 154; text: "• Back up your profiles" }
        Line { y: 180; text: "• Back up the machine Logs" }
        Line { y: 216; text: "If You are experiencing any kind of issue" }
        Line { y: 242; text: "please reach out to <b>Customer Support</b> first" }

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

    // ---- the serial prompt: .factory-reset-serial-keyboard covers the whole 480 px screen.
    Rectangle {
        visible: screen.serialPromptOpen && !screen.loading
        x: screen.inBubble ? -60 : 0
        width: 480
        height: 480
        color: Theme.bubble
        Loader {
            anchors.fill: parent
            active: screen.serialPromptOpen
            sourceComponent: CircleKeyboard {
                name: screen.serialRejected ? "Serial does not match" : "Enter Serial Number"
                defaultValue: screen.serialInput
                ignoreGestures: !Nav.bubbleInterceptsGesture || screen.loading
                onSubmitted: (input) => {
                    if (screen.deviceSerial.length > 0 && input.trim().toLowerCase() === screen.deviceSerial.toLowerCase()) {
                        screen.serialRejected = false
                        screen.factoryReset()
                        return
                    }
                    screen.serialRejected = true
                    screen.serialInput = ""
                }
                onCancelled: screen.closeSerialPrompt()
                onEdited: (input) => {
                    screen.serialInput = input
                    screen.serialRejected = false
                }
            }
        }
    }
}
