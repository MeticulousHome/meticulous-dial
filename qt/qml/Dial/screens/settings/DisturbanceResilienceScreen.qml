// Config > disturbance resilience: a full screen route with the layout of ShotDataSharingView (title, copy,
// a row of pills, the error line). "Disabled" / "Enabled", the stored one focused when the screen opens; the
// copy is the focused pill's. A push saves the focused value (the backend answers once the machine stored
// it) and returns to the screen under the menu with config open again; a refused save stays here with the
// error line. Gestures wait for the settings.
import QtQuick
import Dial
import "../support"
import "DisturbanceResilience.js" as DisturbanceResilience

Item {
    id: screen
    anchors.fill: parent

    readonly property var settings: BackendSettings.data
    readonly property var choices: DisturbanceResilience.CHOICES
    property int activeIndex: 0
    property bool busy: false
    property bool saveFailed: false
    property bool alive: true
    // The screen under the menu when this route was opened.
    property string returnScreen: ""

    // For the end-to-end tests: the pill the knob is on.
    readonly property string dialFocusedLabel: busy ? "Saving..." : choices[activeIndex].label

    property bool initializedFromSettings: false
    Component.onCompleted: {
        returnScreen = Nav.prev || "profileHome"
        activeIndex = DisturbanceResilience.initialIndex(settings)
        initializedFromSettings = !!settings
    }
    Component.onDestruction: alive = false
    onSettingsChanged: {
        if (!initializedFromSettings && settings) {
            activeIndex = DisturbanceResilience.initialIndex(settings)
            initializedFromSettings = true
        }
    }

    function goBack() {
        Nav.setScreen(returnScreen)
        Nav.setBubbleDisplay({ visible: true, component: "settings" })
    }

    function save(value) {
        busy = true
        saveFailed = false
        BackendSettings.update({ [DisturbanceResilience.SETTING_KEY]: value }).then(() => {
            if (!screen.alive) return
            screen.busy = false
            screen.goBack()
        }).catch(error => {
            if (!screen.alive) return
            console.warn("disturbance_resilience was not saved: " + DisturbanceResilience.errorMessage(error))
            screen.busy = false
            screen.saveFailed = true
        })
    }

    GestureHandler {
        enabled: !(Nav.bubbleInterceptsGesture || !screen.settings || screen.busy)
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.choices.length - 1)
        onPressDown: screen.save(screen.choices[screen.activeIndex].value)
    }

    Column {
        x: 56
        width: 368
        // ShotDataSharingView: centered inside the padding box (48 top, 52 bottom), 14 px apart.
        y: 48 + (380 - height) / 2
        spacing: 14

        CssText {
            width: parent.width
            text: DisturbanceResilience.TITLE
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            font.pixelSize: 30
            cssLineHeight: 33
        }
        CssText {
            width: parent.width
            text: screen.choices[screen.activeIndex].copy
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            font.pixelSize: 21
            cssLineHeight: 27.3
        }
        Item {
            width: parent.width
            height: pills.height + 4
            Row {
                id: pills
                y: 4
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 10
                Repeater {
                    model: screen.choices.length
                    Pill {
                        required property int index
                        active: screen.activeIndex === index
                        text: screen.busy && screen.activeIndex === index ? "Saving..." : screen.choices[index].label
                    }
                }
            }
        }
        CssText {
            visible: screen.saveFailed
            width: parent.width
            text: "Could not save your choice. Please try again."
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            color: "#ff7b70"
            font.pixelSize: 18
            cssLineHeight: 23.4
        }
    }
}
