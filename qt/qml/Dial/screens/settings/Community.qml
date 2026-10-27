// Community (src/components/Settings/Community/Community.tsx, Community.css), in the bubble: the automatic
// shot backup to Community, driven by the C++ uploader (Dial.Native's Community singleton; the Tauri
// commands community_* in the React Dial).
//   - not connected: a pairing QR code is requested once (with the machine's serial) and shown with its
//     countdown; "Try again" after a failure or when it expired. Becoming connected while pairing shows
//     "Connected to Community" (Done returns to the settings).
//   - connected: status, last upload, pending shots, retry state; Back, Pause / Resume uploads, Disconnect
//     (with a confirmation: Cancel / Disconnect).
//   - unavailable (and while the uploader does not exist in this build): "Community Unavailable".
// Layout: .community-screen, a centred column (10 px apart, 7 px when connecting) in the 420 x 480 box with
// 44 / 68 / 54 px padding (30 px at the bottom when connecting); it overflows evenly when too tall.
import QtQuick
import Dial
import Dial.Native

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    // The uploader (SettingsStore.community: Dial.Native's Community, or the tests' stand-in).
    readonly property var uploader: SettingsStore.community
    readonly property bool communityAvailable: !!uploader
    readonly property var status: communityAvailable ? uploader.status : null
    readonly property bool statusPending: communityAvailable && !status
    readonly property bool connected: !!status && status.connected === true
    // Without the uploader the React hook's query fails: shown here as the unavailable state.
    readonly property bool unavailable: !communityAvailable || (!!status && status.state === "unavailable")

    property string mode: "overview"           // overview | connected-success | disconnect
    property int activeAction: 0
    property string pairingUrl: ""
    property double pairingExpiresAt: 0         // s since the epoch, 0 = none
    property double now: Math.floor(Date.now() / 1000)
    property bool enrollmentAttempted: false
    property bool enrollmentInFlight: false
    property bool pairingWasActive: false
    property string enrollmentError: ""        // beginEnrollment.error
    property bool enrollmentPending: false
    property string operationPending: ""       // "paused" | "disconnect" while one runs
    property string operationError: ""

    readonly property bool pairingExpired: pairingExpiresAt > 0 && now >= pairingExpiresAt
    readonly property bool busy: enrollmentPending || operationPending !== ""
    readonly property string error: enrollmentError || operationError

    readonly property var actions: {
        if (!connected) {
            if (unavailable) return ["Back"]
            return enrollmentError || pairingExpired ? ["Try again", "Back"] : ["Back"]
        }
        return ["Back", status && status.paused ? "Resume uploads" : "Pause uploads", "Disconnect"]
    }
    readonly property var shownActions: mode === "disconnect" ? ["Cancel", "Disconnect"]
                                       : mode === "connected-success" ? ["Done"] : actions
    readonly property string dialFocusedLabel: shownActions[Math.min(activeAction, shownActions.length - 1)] || ""

    // ---- the uploader's answers
    Connections {
        target: screen.uploader
        ignoreUnknownSignals: true
        function onEnrollmentResult(result) {
            if (!screen.enrollmentPending) return
            screen.enrollmentPending = false
            screen.enrollmentInFlight = false
            if (!result || result.error) {
                screen.enrollmentError = String(result && result.error ? result.error : "Could not create a secure code")
                return
            }
            screen.pairingUrl = String(result.qrUrl || "")
            screen.pairingExpiresAt = Number(result.expiresAt || 0)
            screen.now = Math.floor(Date.now() / 1000)
        }
        function onOperationFinished(op, error) {
            const pending = screen.operationPending
            screen.operationPending = ""
            if (error) {
                screen.operationError = error
                return
            }
            screen.operationError = ""
            if (pending === "disconnect" || op === "disconnect") {
                screen.mode = "overview"
                screen.activeAction = 0
            }
        }
    }

    function startEnrollment() {
        if (enrollmentInFlight || connected || !communityAvailable) return
        enrollmentAttempted = true
        enrollmentInFlight = true
        pairingWasActive = true
        enrollmentError = ""
        pairingUrl = ""
        pairingExpiresAt = 0
        enrollmentPending = true
        uploader.beginEnrollment(Device.info && Device.info.serial ? String(Device.info.serial) : "")
    }
    // The first enrollment starts once the status and the device info are known.
    function maybeStartEnrollment() {
        if (!communityAvailable || statusPending || Device.infoPending || connected || unavailable || pairingUrl
                || enrollmentPending || enrollmentAttempted)
            return
        startEnrollment()
    }
    // As the React effect, after the bindings that depend on the change have settled.
    Component.onCompleted: Qt.callLater(maybeStartEnrollment)
    onStatusChanged: Qt.callLater(maybeStartEnrollment)
    onEnrollmentAttemptedChanged: Qt.callLater(maybeStartEnrollment)
    Connections {
        target: Device
        function onInfoChanged() { Qt.callLater(screen.maybeStartEnrollment) }
    }

    onConnectedChanged: {
        if (connected && pairingWasActive) {
            pairingWasActive = false
            mode = "connected-success"
            pairingUrl = ""
            pairingExpiresAt = 0
            activeAction = 0
        }
    }

    // The countdown, while a code is out.
    Timer {
        interval: 1000
        repeat: true
        running: screen.pairingExpiresAt > 0
        onTriggered: screen.now = Math.floor(Date.now() / 1000)
    }

    function goBack() { Nav.openBubble("settings") }

    GestureHandler {
        // useHandleGestures without an ignore condition (inside the bubble).
        enabled: screen.inBubble || !Nav.bubbleInterceptsGesture
        onTurnLeft: {
            if (screen.mode === "connected-success") return
            screen.activeAction = Math.max(screen.activeAction - 1, 0)
        }
        onTurnRight: {
            if (screen.mode === "connected-success") return
            const max = screen.mode === "disconnect" ? 1 : screen.actions.length - 1
            screen.activeAction = Math.min(screen.activeAction + 1, max)
        }
        onPressDown: {
            if (screen.busy) return
            if (screen.mode === "connected-success") {
                screen.mode = "overview"
                screen.activeAction = 0
                screen.goBack()
                return
            }
            if (screen.mode === "disconnect") {
                if (screen.activeAction === 0) {
                    screen.mode = "overview"
                    return
                }
                screen.operationError = ""
                screen.operationPending = "disconnect"
                screen.uploader.disconnect()
                return
            }
            const action = screen.actions[screen.activeAction]
            if (action === "Try again") {
                screen.pairingUrl = ""
                screen.pairingExpiresAt = 0
                screen.enrollmentError = ""
                screen.enrollmentAttempted = false
            } else if (action === "Pause uploads" || action === "Resume uploads") {
                screen.operationError = ""
                screen.operationPending = "paused"
                screen.uploader.setUploadPaused(action === "Pause uploads")
            } else if (action === "Disconnect") {
                screen.mode = "disconnect"
                screen.activeAction = 0
            } else if (action === "Back") {
                screen.goBack()
            }
        }
    }

    // toLocaleString([], { hour: "2-digit", minute: "2-digit" }) in the Dial's en-US webview: "02:05 PM".
    function formatTimestamp(value) {
        if (!value) return "Not yet"
        return Qt.formatTime(new Date(value * 1000), "hh:mm AP")
    }
    function readableError(value) {
        if (!value) return "None"
        return String(value).replace(/_/g, " ")
    }

    // ---- what each state shows: [{ kind, text }] laid out in one column
    readonly property bool connecting: mode === "overview" && !connected && !unavailable
    readonly property int secondsLeft: Math.max((pairingExpiresAt > 0 ? pairingExpiresAt : now) - now, 0)
    readonly property string title: mode === "disconnect" ? "Disconnect Community?"
                                  : mode === "connected-success" ? "Connected to Community"
                                  : unavailable && !connected ? "Community Unavailable"
                                  : !connected ? "Connect to Community" : "Community"
    readonly property string copy: mode === "disconnect" ? "Future uploads will stop. Shots already stored in Community will remain in your account."
                                 : mode === "connected-success" ? "New shots will be uploaded privately to your account."
                                 : unavailable && !connected ? "Automatic backup could not access its storage. Brewing and Espresso remain available. Restart the Dial after checking machine storage."
                                 : !connected ? "Scan this secure code with your phone. It opens Community or helps you install the app."
                                 : ""
    readonly property string placeholderText: pairingExpired ? "Secure code expired"
                                            : enrollmentError ? "Could not create a secure code" : "Creating secure code..."
    readonly property string connectHint: pairingExpired ? "Choose Try again to create a new secure code."
                                        : pairingUrl ? "Sign in, review private backup, then connect. Code expires in "
                                                       + Math.floor(secondsLeft / 60) + ":" + String(secondsLeft % 60).padStart(2, "0") + "."
                                        : "Keep this screen open while Community prepares the connection."
    readonly property string errorText: mode === "connected-success" ? ""
                                      : unavailable && !connected && mode === "overview" ? readableError(status ? status.lastError : null)
                                      : error ? error : ""
    readonly property bool showQr: connecting && pairingUrl !== "" && !pairingExpired

    readonly property string dialProbe_communityMode: mode === "overview" ? (connected ? "connected" : unavailable ? "unavailable" : "connect") : mode

    Item {
        id: box
        // padding 44 / 68 / 54 (30 at the bottom when connecting)
        x: 68
        y: 44
        width: 420 - 136
        height: 480 - 44 - (screen.connecting ? 30 : 54)

        Column {
            id: column
            width: box.width
            y: (box.height - height) / 2
            spacing: screen.connecting ? 7 : 10

            Text {
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: screen.title
                color: "#e7e7e7"
                font.family: Theme.fontRegular
                font.pixelSize: 24
            }
            Text {
                visible: text.length > 0
                anchors.horizontalCenter: parent.horizontalCenter
                width: Math.min(parent.width, 340)
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: screen.copy
                color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0.7)
                font.family: Theme.fontRegular
                font.pixelSize: 15
                lineHeight: 18.75
                lineHeightMode: Text.FixedHeight
            }

            // .community-qr: white, 8 px radius, 10 px padding around the 256 px code (react-qr-code's
            // default size: its width / height props do not resize it), 4.8 px of inline descent under it.
            Rectangle {
                visible: screen.showQr
                anchors.horizontalCenter: parent.horizontalCenter
                width: 276
                height: 280.8
                radius: 8
                color: "white"
                QrCode {
                    x: 10
                    y: 10
                    width: 256
                    height: 256
                    value: screen.pairingUrl
                    level: "L"
                }
            }
            // .community-qr-placeholder
            Rectangle {
                visible: screen.connecting && !screen.showQr
                anchors.horizontalCenter: parent.horizontalCenter
                width: 220
                height: 220
                radius: 8
                color: "transparent"
                border.width: 1
                border.color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0x55 / 255)
                Text {
                    x: 24
                    y: 24
                    width: 172
                    height: 172
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    wrapMode: Text.WordWrap
                    text: screen.placeholderText
                    color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0xa6 / 255)
                    font.family: Theme.fontRegular
                    font.pixelSize: 15
                    lineHeight: 18.75
                    lineHeightMode: Text.FixedHeight
                }
            }
            Text {
                visible: screen.connecting
                anchors.horizontalCenter: parent.horizontalCenter
                width: Math.min(parent.width, 340)
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: screen.connectHint
                color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0.7)
                font.family: Theme.fontRegular
                font.pixelSize: 15
                lineHeight: 18.75
                lineHeightMode: Text.FixedHeight
            }

            // .community-status-grid: 300 px, columns "1fr auto" (the values start where the widest one
            // fits at the right), 8 px between rows, 16 px between the columns, left-aligned.
            Item {
                id: grid
                visible: screen.mode === "overview" && screen.connected
                anchors.horizontalCenter: parent.horizontalCenter
                width: 300
                height: 4 * rowHeight + 3 * 8
                readonly property real rowHeight: statusValue.implicitHeight
                readonly property real valueX: 300 - Math.max(statusValue.implicitWidth, lastValue.implicitWidth,
                                                              pendingValue.implicitWidth, retryValue.implicitWidth)
                component GridLabel: Text {
                    color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0x99 / 255)
                    font.family: Theme.fontRegular
                    font.pixelSize: 15
                }
                component GridValue: Text {
                    x: grid.valueX
                    color: "#e7e7e7"
                    font.family: Theme.fontRegular
                    font.pixelSize: 15
                }
                GridLabel { y: 0; text: "Status" }
                GridValue { id: statusValue; y: 0; text: screen.status && screen.status.paused ? "Upload paused" : "Connected" }
                GridLabel { y: grid.rowHeight + 8; text: "Last upload" }
                GridValue { id: lastValue; y: grid.rowHeight + 8; text: screen.formatTimestamp(screen.status ? screen.status.lastSuccessAt : null) }
                GridLabel { y: 2 * (grid.rowHeight + 8); text: "Pending" }
                GridValue { id: pendingValue; y: 2 * (grid.rowHeight + 8); text: screen.status ? String(screen.status.pendingCount) : "" }
                GridLabel { y: 3 * (grid.rowHeight + 8); text: "Retry state" }
                GridValue { id: retryValue; y: 3 * (grid.rowHeight + 8); text: screen.readableError(screen.status ? screen.status.lastError : null) }
            }

            // .community-actions: pills, 8 px apart, centred.
            Row {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 8
                Repeater {
                    model: screen.shownActions.length
                    delegate: Rectangle {
                        required property int index
                        readonly property bool active: screen.mode === "connected-success" || index === screen.activeAction
                        readonly property string label: screen.busy && active && screen.mode === "overview"
                                                        ? "Working..." : screen.shownActions[index]
                        width: Math.max(118, pillText.implicitWidth) + 24 + 2
                        height: pillText.implicitHeight + 14 + 2
                        radius: height / 2
                        color: active ? "#e7e7e7" : "transparent"
                        border.width: 1
                        border.color: active ? "#e7e7e7" : Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0x55 / 255)
                        Text {
                            id: pillText
                            x: 13
                            y: 8
                            width: parent.width - 26
                            horizontalAlignment: Text.AlignHCenter
                            text: parent.label
                            color: parent.active ? "#171717" : Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0xa6 / 255)
                            font.family: Theme.fontRegular
                            font.pixelSize: 15
                        }
                    }
                }
            }

            // .community-error: 14 px margins above and below (the default <p> margins).
            Item {
                visible: screen.errorText.length > 0
                anchors.horizontalCenter: parent.horizontalCenter
                width: errorLabel.width
                height: errorLabel.height + 28
                Text {
                    id: errorLabel
                    y: 14
                    width: Math.min(implicitWidth, 320)
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: screen.errorText
                    color: "#ff7b70"
                    font.family: Theme.fontRegular
                    font.pixelSize: 14
                    lineHeight: 17.5
                    lineHeightMode: Text.FixedHeight
                }
            }
        }
    }
}
