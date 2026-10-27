// The result screen of the Wi-Fi flows (wifiResult.css: div.main-container.response): a 340 px column,
// padding 42 / 48 / 34 px, centered both ways, with the upper-case title (ABC Diatype Mono 34 px, line
// height 1), an optional yellow status (24 px, 1.08), the message (16 px, 1.18) and the yellow "OK" entry
// (34 px tall, 22 px from the message). Every text is #dddddd but the status (#f7df39).
import QtQuick
import Dial

Item {
    id: response
    anchors.fill: parent
    property string title: ""
    property string status: ""
    property string message: ""
    // The message div is there in every error (even empty, its 12 px margin counts) and in a success with a
    // warning; a plain success has the title only.
    property bool hasMessage: true
    readonly property string dialFocusedLabel: "Ok"

    readonly property real contentWidth: 340 - 2 * 48
    readonly property real contentTop: 42
    readonly property real contentBottom: height - 34

    Column {
        id: column
        x: (response.width - 340) / 2 + 48
        y: response.contentTop + (response.contentBottom - response.contentTop - height) / 2
        width: response.contentWidth
        spacing: 0

        Text {
            id: titleText
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: response.title
            color: "#dddddd"
            font.family: Theme.fontMono
            font.pixelSize: 34
            font.capitalization: Font.AllUppercase
            lineHeightMode: Text.FixedHeight
            lineHeight: 34
        }
        Item { width: 1; height: statusText.visible ? 10 : 0 }
        Text {
            id: statusText
            visible: response.status.length > 0
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: response.status
            color: "#f7df39"
            font.family: Theme.fontMono
            font.pixelSize: 24
            font.capitalization: Font.AllUppercase
            lineHeightMode: Text.FixedHeight
            lineHeight: 24 * 1.08
        }
        Item { width: 1; height: response.hasMessage ? 12 : 0 }
        Text {
            id: messageText
            // An empty message div is 0 px tall (the Column skips the invisible Text).
            visible: response.hasMessage && response.message.length > 0
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: response.message
            color: "#dddddd"
            font.family: Theme.fontMono
            font.pixelSize: 16
            lineHeightMode: Text.FixedHeight
            lineHeight: 16 * 1.18
        }
        Item { width: 1; height: 22 }
        // .settings-item.active-setting.connect-item with .settings-entry.connect-button: "OK". The 120 px
        // box keeps .settings-item's 18 px left padding (quick-settings.css wins over wifiResult.css), so
        // it is 138 px wide with the text centered in its right 120 px.
        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: 18 + 120
            height: 34
            radius: 4
            color: Theme.brandYellow
            Text {
                anchors.centerIn: parent
                anchors.horizontalCenterOffset: 9
                text: "Ok"
                color: "#0f0f0f"
                font.family: Theme.fontMono
                font.pixelSize: 22
                font.letterSpacing: 1.3
                font.capitalization: Font.AllUppercase
            }
        }
    }
}
