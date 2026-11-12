// "Pair a device" of Devices (DeviceAccess.qml), in the bubble: asks the backend for a one-time pairing code
// as it opens (POST /api/v1/auth/pairing?mode=new) and shows the QR code of its pair URL on a white square,
// the code as ABCD-EFGH (for typing it in instead) and how long it stays valid. A phone's camera opens the
// pair URL in the web UI, which pairs itself; the backend then posts a notification that takes the screen.
//   - while asking: a placeholder; when the code expires or the call fails: "New code" and Back.
//   - a backend without device authorization (404): it says so, with Back only.
// The countdown runs on the Dial's monotonic clock from `expires_in`, so a clock change (time sync at boot,
// a time zone) cannot stretch or cut it. The code is never logged. What each state shows is in Pairing.js
// (tested by qt/tests/js/pairing.test.mts).
// Layout: Community.qml's centred column (8 px apart) in a 284 x 400 box at (68, 40) of the 420 px bubble.
import QtQuick
import Dial
import Dial.Native
import "Pairing.js" as Pairing

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    // loading | ready | expired | failed | unsupported (Pairing.js)
    property string pairingState: "loading"
    property string code: ""
    property string pairUrl: ""
    property real expiresIn: 0
    // Native.monotonicMs() when the code arrived, and at the last tick of the countdown.
    property double receivedAtMs: 0
    property double nowMs: 0
    property int activeAction: 0
    // A late answer to an earlier request (or to a screen already gone) is dropped.
    property int generation: 0
    property bool alive: true
    Component.onDestruction: alive = false

    readonly property int secondsLeft: pairingState === "ready" ? Pairing.secondsLeft(expiresIn, nowMs - receivedAtMs) : 0
    readonly property bool showQr: pairingState === "ready" && pairUrl.length > 0
    readonly property var actions: Pairing.actions(pairingState)
    onActionsChanged: activeAction = 0

    readonly property string dialFocusedLabel: actions[Math.min(activeAction, actions.length - 1)] || ""
    readonly property string dialProbe_pairingState: pairingState
    readonly property int dialProbe_secondsLeft: secondsLeft
    readonly property bool dialProbe_showsQr: showQr

    function requestCode() {
        const request = ++generation
        pairingState = "loading"
        code = ""
        pairUrl = ""
        expiresIn = 0
        Api.createPairingCode().then(data => {
            if (!screen.alive || request !== screen.generation) return
            const next = Pairing.fromAnswer(data)
            if (next.state !== "ready") {
                console.error("Pairing code answer without a usable code")
                screen.pairingState = next.state
                return
            }
            screen.code = next.code
            screen.pairUrl = next.pairUrl
            screen.expiresIn = next.expiresIn
            screen.receivedAtMs = Native.monotonicMs()
            screen.nowMs = screen.receivedAtMs
            screen.pairingState = "ready"
        }).catch(error => {
            if (!screen.alive || request !== screen.generation) return
            const next = Pairing.fromError(error)
            // Only the status: the answer's body would carry the code if one came back.
            if (next.state === "failed") console.error("Could not create a pairing code, status", error ? error.status : "none")
            screen.pairingState = next.state
        })
    }
    Component.onCompleted: requestCode()

    // The countdown, while a code is out. Once a second is enough: the display shows whole seconds.
    Timer {
        interval: 1000
        repeat: true
        running: screen.pairingState === "ready"
        onTriggered: {
            screen.nowMs = Native.monotonicMs()
            const next = Pairing.afterTick(screen.pairingState, screen.secondsLeft)
            if (next !== screen.pairingState) {
                screen.code = ""
                screen.pairUrl = ""
                screen.pairingState = next
            }
        }
    }

    function goBack() { Nav.openBubble("deviceAccess") }

    GestureHandler {
        // As Community: in the bubble it always listens (the bubble disables it while hidden).
        enabled: screen.inBubble || !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.activeAction = Math.max(screen.activeAction - 1, 0)
        onTurnRight: screen.activeAction = Math.min(screen.activeAction + 1, screen.actions.length - 1)
        onPressDown: {
            const action = screen.actions[screen.activeAction]
            if (action === "New code") screen.requestCode()
            else if (action === "Back") screen.goBack()
        }
    }

    Item {
        id: box
        x: 68
        y: 40
        width: 420 - 136
        height: 400

        Column {
            width: box.width
            y: (box.height - height) / 2
            spacing: 8

            Text {
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                text: "Pair a device"
                color: "#e7e7e7"
                font.family: Theme.fontRegular
                font.pixelSize: 24
            }

            // The code on white with a quiet zone, as Community's.
            Rectangle {
                visible: screen.showQr
                anchors.horizontalCenter: parent.horizontalCenter
                width: 200
                height: 200
                radius: 8
                color: "white"
                QrCode {
                    x: 8
                    y: 8
                    width: 184
                    height: 184
                    value: screen.showQr ? screen.pairUrl : ""
                    level: "M"
                }
            }
            Rectangle {
                visible: !screen.showQr
                anchors.horizontalCenter: parent.horizontalCenter
                width: 200
                height: 200
                radius: 8
                color: "transparent"
                border.width: 1
                border.color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0x55 / 255)
                Text {
                    x: 20
                    y: 20
                    width: 160
                    height: 160
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    wrapMode: Text.WordWrap
                    text: Pairing.placeholderText(screen.pairingState)
                    color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0xa6 / 255)
                    font.family: Theme.fontRegular
                    font.pixelSize: 15
                    lineHeight: 18.75
                    lineHeightMode: Text.FixedHeight
                }
            }

            Text {
                visible: screen.showQr
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                text: Pairing.displayCode(screen.code)
                color: "white"
                font.family: Theme.fontMono
                font.pixelSize: 30
                font.letterSpacing: 2
            }
            Text {
                readonly property string hint: Pairing.hintText(screen.pairingState, screen.secondsLeft)
                visible: hint.length > 0
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: hint
                color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0.7)
                font.family: Theme.fontRegular
                font.pixelSize: 15
                lineHeight: 18.75
                lineHeightMode: Text.FixedHeight
            }

            // Pills, 8 px apart, centred (Community's .community-actions).
            Row {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 8
                Repeater {
                    model: screen.actions.length
                    delegate: Rectangle {
                        required property int index
                        readonly property bool active: index === screen.activeAction
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
                            text: screen.actions[parent.index] || ""
                            color: parent.active ? "#171717" : Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0xa6 / 255)
                            font.family: Theme.fontRegular
                            font.pixelSize: 15
                        }
                    }
                }
            }
        }
    }
}
