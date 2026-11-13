// The OS update status (src/components/OSStatus/OSStatus.tsx, OSStatus.css): one line of status and a Back
// entry, in a vertical Swiper of 8 slides per view, 16 px apart, centred on the active slide (slides:
// status, two empty ones, Back). Moving to Back centres the second slide, as the React Swiper does
// (slideTo(activeIndex) over the four slides); Back takes the yellow .active-setting. Back opens Advanced
// Settings. No route opens it in the React Dial.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    property int activeIndex: 0
    readonly property var items: ["content", "back"]
    readonly property string statusInfo: {
        if (Device.osStatusError) return "Failed to get update status"
        switch (Device.osStatus.status) {
        case "COMPLETE": return "Update Complete"
        case "DOWNLOADING": return "Downloading Update: " + Math.round(Device.osStatus.progress) + "%"
        case "INSTALLING": return "Installing Update: " + Math.round(Device.osStatus.progress) + "%"
        }
        return "OS up to date."
    }
    readonly property string dialFocusedLabel: items[activeIndex] === "back" ? "Back" : statusInfo

    GestureHandler {
        // useHandleGestures without an ignore condition.
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.items.length - 1)
        onPressDown: if (screen.items[screen.activeIndex] === "back") Nav.openBubble("advancedSettings")
    }

    // Swiper: slide height (480 - 7 x 16) / 8 = 46, pitch 62; the active slide centred; style top -4px,
    // padding-left 29px.
    readonly property real slideHeight: (height - 7 * 16) / 8
    function slideY(i) { return height / 2 - slideHeight / 2 + (i - activeIndex) * (slideHeight + 16) - 4 }

    Text {
        x: 29
        y: screen.slideY(0)
        width: screen.width - 29
        text: screen.statusInfo
        color: "#dddddd"
        font.family: Theme.fontMono
        font.pixelSize: 22
    }
    // .settings-item(.active-setting): 90 % of the slide + 18 px padding, 46 px tall (the slide's height).
    Rectangle {
        x: 29
        y: screen.slideY(3)
        width: (screen.width - 29) * 0.9 + 18
        height: screen.slideHeight
        radius: 4
        color: screen.items[screen.activeIndex] === "back" ? Theme.brandYellow : "transparent"
        Text {
            x: 18
            height: parent.height
            verticalAlignment: Text.AlignVCenter
            text: "Back"
            color: screen.items[screen.activeIndex] === "back" ? "#0f0f0f" : "#dddddd"
            font.family: Theme.fontMono
            font.pixelSize: 22
            font.letterSpacing: 1.3
            font.capitalization: Font.AllUppercase
        }
    }
}
