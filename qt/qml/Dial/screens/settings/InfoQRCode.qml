// "Show device info QR" (src/components/Settings/Advanced/InfoQrCode.tsx), in the bubble: a QR code of
// "SN:<serial> BATCH:<batch> COLOR:<COLOR>" (react-qr-code: 256 px, level L, 16 px white padding), the
// hint under it and a Back bar. Any push, or 30 s, returns to Device Info. "Loading..." until the device
// info is there.
//
// Layout as the CSS computes it in the 420 px bubble: .main-quick-settings.settings-explanation is shifted
// 20 px right and down (margin) and laid out as a column centred vertically: the QR block (345 px, 100 px
// right padding) and the Back bar (38 px, 80 px margin under it).
import QtQuick
import Dial
import Dial.Native

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property var info: Device.info
    readonly property bool isLoading: Device.infoPending
    readonly property string qrValue: info ? "SN:" + info.serial + " BATCH:" + info.batch_number
                                             + " COLOR:" + String(info.color === null || info.color === undefined ? "" : info.color).toUpperCase()
                                           : ""
    readonly property string dialProbe_qrValue: qrValue
    readonly property string dialFocusedLabel: isLoading ? "" : "Back"

    function back() { Nav.setBubbleDisplay({ visible: true, component: "deviceInfo" }) }

    // Auto-exit after 30 s, restarted when the device info changes.
    Timer {
        id: autoExit
        interval: 30000
        running: true
        onTriggered: screen.back()
    }
    onInfoChanged: autoExit.restart()
    onIsLoadingChanged: autoExit.restart()

    GestureHandler {
        // useHandleGestures without an ignore condition.
        onPressDown: screen.back()
    }

    // The 420 x 480 box at (20, 20).
    Item {
        x: 20
        y: 20
        width: 420
        height: 480

        Text {
            visible: screen.isLoading
            anchors.centerIn: parent
            text: "Loading..."
            color: "white"
            font.family: Theme.fontRegular
            font.pixelSize: 20
        }

        // 345 + 38 + 80 = 463 px, centred: starts at 8.5.
        Item {
            visible: !screen.isLoading
            y: (480 - 463) / 2
            width: 420
            height: 463

            Rectangle {
                // 320 px content box (100 px right padding): the 288 px white square centred in it.
                x: (320 - 288) / 2
                y: 0
                width: 288
                height: 288
                color: "white"
                QrCode {
                    x: 16
                    y: 16
                    width: 256
                    height: 256
                    value: screen.qrValue
                    level: "L"
                }
            }
            Text {
                x: 20
                y: 288 + 5
                width: 300
                wrapMode: Text.WordWrap
                text: "Scan with a QR Code scanner to get the SN, Batch & Color info of the machine"
                color: "white"
                font.family: Theme.fontRegular
                font.pixelSize: 16
                lineHeight: 26
                lineHeightMode: Text.FixedHeight
            }

            // .settings-item.active-setting: 90 % + 18 px padding = 396 px, centred; .settings-entry 6 px padding.
            Rectangle {
                x: (420 - 396) / 2
                y: 345
                width: 396
                height: 38
                radius: 4
                color: Theme.brandYellow
                Text {
                    x: 18 + 6
                    y: 6
                    height: 26
                    verticalAlignment: Text.AlignVCenter
                    text: "Back"
                    color: "#0f0f0f"
                    font.family: Theme.fontMono
                    font.pixelSize: 22
                    font.letterSpacing: 1.3
                    font.capitalization: Font.AllUppercase
                }
            }
        }
    }
}
