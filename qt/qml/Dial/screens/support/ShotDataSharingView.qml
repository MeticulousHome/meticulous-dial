// The shot data sharing screens (src/components/ShotDataSharing/ShotDataSharingView.tsx and
// ShotDataSharing.css), shared by the boot prompt and Help us improve: a title, the copy, an optional
// footnote, the options as pills in a row, and the error line when saving failed. Full screen, the column
// centered in the 368 x 380 box inside the 48 / 56 / 52 px padding, 14 px apart.
// ShotDataSharingThanks / ShotDataSharingStopped are this view with a title and copy only.
import QtQuick
import Dial

Item {
    id: view
    anchors.fill: parent

    // The texts and actions of ShotDataSharingView.tsx.
    readonly property int thanksScreenDurationMs: 4000
    readonly property var optInActions: [{ key: "help_improve", label: "Help improve" }, { key: "no_thanks", label: "No thanks" }]
    readonly property var optOutActions: [{ key: "stop_sharing", label: "Stop sharing" }, { key: "back", label: "Back" }]
    readonly property string titleText: "Help us improve"
    readonly property string optInCopy: "Share sensor data from your brews anonymously with Meticulous to help "
        + "us improve brew quality and reliability. It never includes your name, serial number or network details."
    readonly property string sharingCopy: "Anonymous sensor data from your brews is being shared with Meticulous. "
        + "You can stop sharing at any time."
    readonly property string laterNote: "You can change this any time from the menu under Help us improve."
    readonly property string errorText: "Could not save your choice. Please try again."
    readonly property string thanksTitle: "Thanks!"
    readonly property string thanksCopy: "Your brews will now help make every Meticulous better."
    readonly property string stoppedTitle: "Sharing stopped"
    readonly property string stoppedCopy: "Your machine will no longer send brew data to Meticulous."

    property string title: titleText
    property string copy: ""
    property string footnote: ""
    property var actions: []
    property int activeIndex: 0
    property bool busy: false
    property bool error: false

    // For the end-to-end tests: the option the knob is on.
    readonly property string dialFocusedLabel: actions.length ? actions[Math.min(activeIndex, actions.length - 1)].label : ""

    Column {
        id: column
        x: 56
        width: 368
        // justify-content: center inside the padding box (48 top, 52 bottom).
        y: 48 + (380 - height) / 2
        spacing: 14

        CssText {
            width: parent.width
            text: view.title
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            font.pixelSize: 30
            cssLineHeight: 33
        }
        CssText {
            visible: view.copy.length > 0
            width: parent.width
            text: view.copy
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            font.pixelSize: 21
            cssLineHeight: 27.3
        }
        CssText {
            visible: view.footnote.length > 0
            width: parent.width
            text: view.footnote
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            color: Qt.rgba(231 / 255, 231 / 255, 231 / 255, 0.7)
            font.pixelSize: 18
            cssLineHeight: 23.4
        }
        Item {
            visible: view.actions.length > 0
            width: parent.width
            height: actionsRow.height + 4
            Row {
                id: actionsRow
                y: 4
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 10
                Repeater {
                    model: view.actions.length
                    Pill {
                        required property int index
                        active: view.activeIndex === index
                        text: view.busy && view.activeIndex === index ? "Saving..." : view.actions[index].label
                    }
                }
            }
        }
        CssText {
            visible: view.error
            width: parent.width
            text: view.errorText
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            color: "#ff7b70"
            font.pixelSize: 18
            cssLineHeight: 23.4
        }
    }
}
