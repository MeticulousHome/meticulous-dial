// Set Time (src/components/Settings/Advanced/TimeDate/TimeConfig.tsx, TimeConfig.css), in the bubble: the
// time zone over an HH:MM clock of rolling digits (ABC Diatype Mono light 110 px); the knob moves the
// focused field (yellow) by an hour or a minute, a push switches between hours and minutes, a long press
// sets the OS time (today, with these hours and minutes) and a double press aborts; both return to time &
// date. The clock starts at the Dial's own time.
//
// Layout of the styled components in the 420 px bubble: a 400 x 320 column under 100 px of padding, the
// three blocks spread evenly (space-evenly), centred; the clock 60 px under its top padding.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property real clockFontSize: 110
    readonly property color activeColor: "#f5c444"
    readonly property color inactiveColor: "#E6E6E6"

    property date newTime: new Date()
    property string activeField: "hours"
    readonly property int hours: newTime.getHours()
    readonly property int minutes: newTime.getMinutes()
    readonly property string dialProbe_time: String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0")
    readonly property string dialFocusedLabel: activeField

    function changeTime(direction) {
        const step = activeField === "hours" ? 60 * 60 * 1000 : 60 * 1000
        newTime = new Date(newTime.getTime() + step * direction)
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnLeft: screen.changeTime(-1)
        onTurnRight: screen.changeTime(1)
        onPressDown: screen.activeField = screen.activeField === "hours" ? "minutes" : "hours"
        onLongEncoder: {
            const set = new Date()
            set.setMinutes(screen.newTime.getMinutes())
            set.setHours(screen.newTime.getHours())
            Api.setTime(set).then(data => {
                if (data && data.error) throw new Error(data.error)
            }).catch(error => console.error("Error updating User Settings:", error && error.message ? error.message : error))
            Nav.openBubble("timeDate")
        }
        onDoubleClick: Nav.openBubble("timeDate")
    }

    // Container: 400 x 320 at y 100.
    Item {
        id: container
        y: 100
        width: 400
        height: 320
        readonly property real gap: (height - zone.height - clockWrapper.height - help.height) / 4

        Text {
            id: zone
            anchors.horizontalCenter: parent.horizontalCenter
            y: container.gap
            text: BackendSettings.data && BackendSettings.data.time_zone ? String(BackendSettings.data.time_zone) : ""
            color: "white"
            font.family: Theme.fontRegular
            font.pixelSize: 16
        }

        // ClockWrapper: hours (min 130 px) ":" minutes (two 65 px columns), 60 px top padding.
        Item {
            id: clockWrapper
            anchors.horizontalCenter: parent.horizontalCenter
            y: zone.y + zone.height + container.gap
            width: hoursCounter.width + colon.width + tens.width + units.width
            height: 60 + screen.clockFontSize

            AnimatedCounter {
                id: hoursCounter
                y: 60
                width: implicitWidth
                height: implicitHeight
                value: screen.hours
                fontSize: screen.clockFontSize
                minWidth: 130
                maxDigits: 2
                color: screen.inactiveColor
                incrementColor: screen.activeColor
                decrementColor: screen.activeColor
                forced: screen.activeField === "hours"
                forcedColor: screen.activeColor
            }
            Text {
                id: colon
                x: hoursCounter.width
                y: 60
                width: hoursCounter.columnWidth
                height: screen.clockFontSize
                verticalAlignment: Text.AlignVCenter
                text: ":"
                color: "white"
                font.family: Theme.fontMono
                font.weight: Font.Light
                font.pixelSize: screen.clockFontSize
                font.letterSpacing: -0.02 * screen.clockFontSize
            }
            AnimatedCounter {
                id: tens
                x: colon.x + colon.width
                y: 60
                width: implicitWidth
                height: implicitHeight
                value: Math.floor(screen.minutes / 10)
                fontSize: screen.clockFontSize
                minWidth: 65
                maxDigits: 1
                color: screen.inactiveColor
                incrementColor: screen.activeColor
                decrementColor: screen.activeColor
                forced: screen.activeField === "minutes"
                forcedColor: screen.activeColor
            }
            AnimatedCounter {
                id: units
                x: tens.x + tens.width
                y: 60
                width: implicitWidth
                height: implicitHeight
                value: screen.minutes % 10
                fontSize: screen.clockFontSize
                minWidth: 65
                maxDigits: 1
                color: screen.inactiveColor
                incrementColor: screen.activeColor
                decrementColor: screen.activeColor
                forced: screen.activeField === "minutes"
                forcedColor: screen.activeColor
            }
        }

        // HelpText: 50 px top padding, 15 px, line-height 1.2, letter-spacing 0.1em.
        Column {
            id: help
            anchors.horizontalCenter: parent.horizontalCenter
            y: clockWrapper.y + clockWrapper.height + container.gap
            topPadding: 50
            Repeater {
                model: ["long-press to confirm", "double-press to abort"]
                delegate: Text {
                    required property string modelData
                    anchors.horizontalCenter: parent.horizontalCenter
                    height: 18
                    verticalAlignment: Text.AlignVCenter
                    text: modelData
                    color: "white"
                    font.family: Theme.fontRegular
                    font.pixelSize: 15
                    font.letterSpacing: 1.5
                }
            }
        }
    }
}
