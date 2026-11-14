// Set Date (src/components/Settings/Advanced/TimeDate/DateConfig.tsx), in the bubble: DD.MM.YYYY in rolling
// digits (ABC Diatype Mono light 60 px); the knob moves the focused field (yellow) by a day, a month or a
// year (as Date.setDate / setMonth / setFullYear roll over), a push cycles day → month → year, a long press
// sets the OS date (now, with this year, month and day) and a double press aborts; both return to time &
// date. The same layout as Set Time, without the time zone line.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    readonly property real clockFontSize: 60
    readonly property color activeColor: "#f5c444"
    readonly property color inactiveColor: "#E6E6E6"

    property date newTime: new Date()
    property string activeField: "day"
    readonly property string dialProbe_date: newTime.getFullYear() + "-" + String(newTime.getMonth() + 1).padStart(2, "0")
                                             + "-" + String(newTime.getDate()).padStart(2, "0")
    readonly property string dialFocusedLabel: activeField

    function changeTime(direction) {
        const next = new Date(newTime.getTime())
        if (activeField === "day") next.setDate(next.getDate() + direction)
        else if (activeField === "month") next.setMonth(next.getMonth() + direction)
        else next.setFullYear(next.getFullYear() + direction)
        newTime = next
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onTurnRight: screen.changeTime(1)
        onTurnLeft: screen.changeTime(-1)
        onPressDown: {
            screen.activeField = screen.activeField === "day" ? "month" : screen.activeField === "month" ? "year" : "day"
        }
        onLongEncoder: {
            const set = new Date()
            set.setFullYear(screen.newTime.getFullYear())
            set.setMonth(screen.newTime.getMonth())
            set.setDate(screen.newTime.getDate())
            Api.setTime(set).then(data => {
                if (data && data.error) throw new Error(data.error)
            }).catch(error => console.error("Error updating User Settings:", error && error.message ? error.message : error))
            Nav.openBubble("timeDate")
        }
        onDoubleClick: Nav.openBubble("timeDate")
    }

    Item {
        id: container
        y: 100
        width: 400
        height: 320
        readonly property real gap: (height - clockWrapper.height - help.height) / 3

        // ClockWrapper: day . month . year, each counter at least 70 px, 60 px top padding.
        Item {
            id: clockWrapper
            anchors.horizontalCenter: parent.horizontalCenter
            y: container.gap
            width: day.width + dot1.width + month.width + dot2.width + year.width
            height: 60 + screen.clockFontSize

            component Separator: Text {
                y: 60
                width: day.columnWidth
                height: screen.clockFontSize
                verticalAlignment: Text.AlignVCenter
                text: "."
                color: "white"
                font.family: Theme.fontMono
                font.weight: Font.Light
                font.pixelSize: screen.clockFontSize
                font.letterSpacing: -0.02 * screen.clockFontSize
            }
            component Field: AnimatedCounter {
                property string field
                y: 60
                width: implicitWidth
                height: implicitHeight
                fontSize: screen.clockFontSize
                minWidth: 70
                color: screen.inactiveColor
                incrementColor: screen.activeColor
                decrementColor: screen.activeColor
                forced: screen.activeField === field
                forcedColor: screen.activeColor
            }

            Field { id: day; field: "day"; value: screen.newTime.getDate(); maxDigits: 2 }
            Separator { id: dot1; x: day.width }
            Field { id: month; field: "month"; x: dot1.x + dot1.width; value: screen.newTime.getMonth() + 1; maxDigits: 2 }
            Separator { id: dot2; x: month.x + month.width }
            Field { id: year; field: "year"; x: dot2.x + dot2.width; value: screen.newTime.getFullYear(); maxDigits: 4 }
        }

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
