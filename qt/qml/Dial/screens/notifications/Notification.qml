// The notification screen (src/components/Notification/Notification.tsx, notification.css): the newest
// notification's message (and image) in a 330 x 308 box inside the round, darkened display, and its
// responses as yellow buttons under it. One response: one button. More: the selected one in the middle
// with its neighbours half-hidden behind it (scale 0.8, 130 px out, half opaque); the knob moves the
// selection. A message too long for the box scrolls 50 px per detent first (the options stay disabled
// until its end is shown), with a scrollbar and the bottom fading out. A press acknowledges the selected
// response (Api.acknowledgeNotification; a 404 counts as done) and removes the notification; main.qml
// leaves this screen when none are left.
import QtQuick
import Dial
import "../support"

Item {
    id: screen
    anchors.fill: parent

    readonly property int scrollValue: 50
    readonly property var notification: Notifications.count > 0 ? Notifications.items[Notifications.count - 1] : null
    readonly property string notificationId: notification ? String(notification.id) : ""
    readonly property var responses: notification && notification.responses ? notification.responses : []
    // white-space: pre-line: newlines kept, other runs of white space collapsed.
    readonly property string message: notification && notification.message ? String(notification.message).replace(/[ \t\f\r]+/g, " ") : ""
    readonly property string image: notification && notification.image ? String(notification.image) : ""

    property int selectedOption: 0
    property bool canSelectOption: false
    property bool scrollable: false
    property real scrollTop: 0

    // For the end-to-end tests.
    readonly property string dialFocusedLabel: responses.length === 1 ? (responses[0] || "OK")
                                             : responses.length ? String(responses[selectedOption] || "") : ""
    readonly property string dialProbe_notificationId: notificationId
    readonly property bool dialProbe_notificationScrollable: scrollable
    readonly property bool dialProbe_notificationCanSelect: canSelectOption

    // useEffect([notifications]): whether the message overflows its box decides scrolling and whether the
    // options can be picked at once. (The selection is kept, as in React, but not past the last option.)
    function measure() {
        const contentHeight = content.height
        const overflowing = (scrollable ? 60 : 20) + contentHeight > 308
        scrollable = overflowing
        canSelectOption = !overflowing
        scrollTop = 0
        if (selectedOption > Math.max(0, responses.length - 1)) selectedOption = Math.max(0, responses.length - 1)
    }
    Connections {
        target: Notifications
        function onItemsChanged() { Qt.callLater(screen.measure) }
    }
    Component.onCompleted: Qt.callLater(measure)

    readonly property real scrollHeight: 20 + content.height + 40
    readonly property real maxScroll: Math.max(0, scrollHeight - 308)

    function scrollMessage(up) {
        scrollTop = Math.min(maxScroll, Math.max(0, scrollTop + (up ? -scrollValue : scrollValue)))
        // (React compares whole pixels: scrollHeight - scrollTop === clientHeight.)
        if (!canSelectOption && Math.abs(scrollHeight - scrollTop - 308) < 0.5) {
            canSelectOption = true
        } else if (canSelectOption && scrollTop < scrollHeight - 308) {
            canSelectOption = false
            selectedOption = 0
        }
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: {
            if (screen.canSelectOption && screen.responses.length > 1 && screen.selectedOption > 0) screen.selectedOption--
            else screen.scrollMessage(true)
        }
        onTurnRight: {
            if (screen.canSelectOption && screen.responses.length > 1 && screen.selectedOption < screen.responses.length - 1) screen.selectedOption++
            else screen.scrollMessage(false)
        }
        onPressDown: {
            const n = screen.notification
            if (!n) return
            const id = n.id
            const response = n.responses ? n.responses[screen.selectedOption] : undefined
            Api.acknowledgeNotification({ id: id, response: response }).then(() => {
                Notifications.removeOne(id)
            }).catch(error => {
                if (error && error.status === 404) {
                    Notifications.removeOne(id)
                    return
                }
                console.error("Error acknowledging Notification: ", JSON.stringify(error && error.data))
            })
        }
    }

    // .notification-circular-container: the darkened round.
    Rectangle {
        anchors.fill: parent
        radius: 240
        color: Qt.rgba(0, 0, 0, 0.8)
        visible: screen.notification !== null
    }

    // The column (content box + buttons) centered in the 440 x 440 padding box: the options' row is 60 px
    // tall; a single button is positioned absolutely, so it takes no room and centers on the row's line.
    readonly property real buttonsHeight: responses.length === 1 ? 0 : 60
    readonly property real columnTop: 20 + (440 - (308 + 20 + buttonsHeight)) / 2

    Item {
        id: messageBox
        visible: screen.notification !== null
        x: 75
        y: screen.columnTop
        width: 330
        height: 308
        clip: true

        Column {
            id: content
            width: messageBox.width - 20 - (screen.scrollable ? 8 : 0)
            x: 10
            y: screen.scrollable ? 20 - screen.scrollTop : 10 + Math.max(0, (288 - height) / 2)
            CssText {
                width: parent.width
                text: screen.message
                color: "white"
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                font.pixelSize: 24
            }
            Item {
                visible: screen.image.length > 0
                width: parent.width
                height: visible ? img.height + 20 : 0
                Image {
                    id: img
                    y: 20
                    anchors.horizontalCenter: parent.horizontalCenter
                    source: screen.image
                    fillMode: Image.PreserveAspectFit
                    width: Math.min(implicitWidth, parent.width * 0.8)
                    height: implicitWidth > 0 ? width * implicitHeight / implicitWidth : 0
                    smooth: true
                }
                // border-radius: 10px, by covering the corners outside a rounded outline.
                Rectangle {
                    x: img.x - 10
                    y: img.y - 10
                    width: img.width + 20
                    height: img.height + 20
                    radius: 20
                    color: "transparent"
                    border.width: 10
                    border.color: "black"
                    visible: img.status === Image.Ready
                }
            }
        }

        // mask-image: linear-gradient(to bottom, black 80%, transparent 100%) while scrollable.
        Rectangle {
            visible: screen.scrollable
            y: messageBox.height * 0.8
            width: messageBox.width
            height: messageBox.height * 0.2
            gradient: Gradient {
                GradientStop { position: 0; color: Qt.rgba(0, 0, 0, 0) }
                GradientStop { position: 1; color: Qt.rgba(0, 0, 0, 1) }
            }
        }
        // ::-webkit-scrollbar: 8 px, a faint track and the thumb.
        Rectangle {
            visible: screen.scrollable
            x: messageBox.width - 8
            width: 8
            height: messageBox.height
            radius: 4
            color: Qt.rgba(1, 1, 1, 0.1)
            Rectangle {
                width: 8
                radius: 4
                height: Math.max(16, messageBox.height * messageBox.height / screen.scrollHeight)
                y: screen.maxScroll > 0 ? (messageBox.height - height) * screen.scrollTop / screen.maxScroll : 0
                color: Qt.rgba(1, 1, 1, 0.3)
            }
        }
    }

    // ---- the buttons (Arial 20 px, padding 15 30, 25 px radius, at most 150 px wide with an ellipsis)
    FontMetrics { id: buttonFont; font.family: "Arial"; font.pixelSize: 20 }
    readonly property real buttonRowCenterY: columnTop + 308 + 20 + (responses.length === 1 ? 0 : 30)

    component NotificationButton: Item {
        id: button
        property string text: ""
        property bool selected: false
        readonly property real buttonWidth: Math.min(150, buttonFont.advanceWidth(text) + 60)
        width: buttonWidth
        height: 54
        // box-shadow: 0 0 10px rgba(224, 176, 48, 0.5) on the selected one.
        Repeater {
            model: 5
            Rectangle {
                required property int index
                readonly property real grow: 2 * (index + 1)
                x: -grow
                y: -grow
                width: button.width + 2 * grow
                height: button.height + 2 * grow
                radius: 25 + grow
                color: Qt.rgba(224 / 255, 176 / 255, 48 / 255, 0.06)
                opacity: button.selected ? 1 : 0
                Behavior on opacity { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
            }
        }
        Rectangle {
            anchors.fill: parent
            radius: 25
            color: button.selected ? "#e0b030" : "#f5c444"
            Behavior on color { ColorAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
        }
        Text {
            x: 30
            width: parent.width - 60
            height: parent.height
            verticalAlignment: Text.AlignVCenter
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
            text: button.text
            color: "black"
            font.family: "Arial"
            font.pixelSize: 20
        }
    }

    NotificationButton {
        visible: screen.notification !== null && screen.responses.length === 1
        x: 240 - width / 2
        y: screen.buttonRowCenterY - height / 2
        text: screen.responses.length === 1 ? (screen.responses[0] || "OK") : ""
        selected: true
    }

    // Several responses: the buttons as React renders them, in order [left?, center, right?]. Each element
    // keeps its place in that list across selections (React reuses them by position), so a button that
    // turns from center to left slides, while the one that appears is drawn where it belongs at once. Its
    // box is anchored by `left: 50%` (left, center) or `right: 50%` (right) and jumps; the transform
    // (translate, scale) and the opacity run 300 ms ease.
    readonly property var slots: {
        const out = []
        const n = responses.length
        if (n <= 1) return out
        const s = Math.min(selectedOption, n - 1)
        if (s > 0) out.push({ cls: "left", text: String(responses[s - 1] === undefined ? "" : responses[s - 1]) })
        out.push({ cls: "center", text: String(responses[s] === undefined ? "" : responses[s]) })
        if (s < n - 1) out.push({ cls: "right", text: String(responses[s + 1] === undefined ? "" : responses[s + 1]) })
        return out
    }
    Repeater {
        model: 3
        NotificationButton {
            id: slot
            required property int index
            readonly property var spec: screen.slots[index] || null
            readonly property bool present: spec !== null && screen.notification !== null
            readonly property string cls: spec ? spec.cls : "center"
            // A newly mounted element starts in its place, without transition.
            property bool instant: true
            onPresentChanged: {
                instant = true
                Qt.callLater(() => { slot.instant = false })
            }
            Component.onCompleted: Qt.callLater(() => { slot.instant = false })

            visible: present
            text: spec ? spec.text : ""
            selected: cls === "center"
            z: cls === "center" ? 2 : 0
            readonly property real boxCenter: cls === "right" ? 240 - buttonWidth / 2 : 240 + buttonWidth / 2
            readonly property real targetShift: cls === "left" ? -104 : cls === "right" ? 104 : -buttonWidth / 2
            readonly property real targetScale: cls === "center" ? 1 : 0.8
            readonly property real targetOpacity: cls === "center" ? 1 : (screen.canSelectOption ? 0.5 : 0.3)
            property real shift: targetShift
            Behavior on shift { enabled: !slot.instant; NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
            Behavior on scale { enabled: !slot.instant; NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
            Behavior on opacity { enabled: !slot.instant; NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
            scale: targetScale
            opacity: targetOpacity
            x: boxCenter + shift - width / 2
            y: screen.buttonRowCenterY - height / 2
        }
    }
}
