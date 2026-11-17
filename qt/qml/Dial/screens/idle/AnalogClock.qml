// The analog sleep clock (src/components/IdleScreen/AnalogClock.tsx): 60 indicators, the hour, minute and
// smooth second hands on the OS local time, the Meticulous logo and the Wi-Fi indicator. The hands move on
// every frame by rotation only; they stay hidden until the first time sample.
//
// As in React, the clock container has no height of its own (height: 100% of an auto-height parent), so
// its icon column is 56 px tall: the logo lands at y 103 and the Wi-Fi indicator, pushed up 103 px from
// the column's bottom, at y -74, off the screen.
import QtQuick
import Dial

Item {
    id: analog
    width: 480
    height: 480

    // The height the clock takes in the IdleScreen's flow (its pixel-shift rotation origin is the middle).
    readonly property real flowHeight: 56

    readonly property int diameter: 480
    readonly property real hourLength: 82.42
    readonly property real minuteLength: 125.5
    readonly property real secondsLength: 50.83

    property bool timeShown: false

    NetworkStatus { id: network }

    // The indicators: 1.5 px, every fifth 31.5 px #898989, else 15.5 px #494949 (one picture).
    Image {
        width: 480
        height: 480
        sourceSize: Qt.size(480, 480)
        source: Theme.asset("icons/idle-analog-ticks.svg")
        smooth: true
    }

    // Logo (logo-white.svg, 33 x 25) at the top of the icon column, moved down 103 px.
    Image {
        x: 225
        y: 103
        width: 33
        height: 25
        sourceSize: Qt.size(33, 25)
        source: Theme.publicImage("logo-white.svg")
    }

    // WifiIndicator (30 x 23 in a 27.57 px box), bottom of the 56 px column moved up 103 px: off screen.
    Image {
        x: 240 - 27.57 / 2
        y: analog.flowHeight - 27 - 103
        width: 30
        height: 23
        sourceSize: Qt.size(30, 23)
        source: Theme.asset(network.connected ? "icons/idle-wifi-on.svg" : "icons/idle-wifi-off.svg")
    }

    // RotationContainer: 10 px wide, the full height, turned around the clock's center.
    Item {
        id: hourHand
        width: 480
        height: 480
        visible: analog.timeShown
        Rectangle {
            x: 235.5
            y: (analog.diameter / 2 - analog.hourLength) / 2
            width: 9
            height: analog.hourLength
            color: "#E6E6E6"
            antialiasing: true
        }
    }
    Item {
        id: minuteHand
        width: 480
        height: 480
        visible: analog.timeShown
        Rectangle {
            x: 237
            y: (analog.diameter / 2 - analog.minuteLength) / 2
            width: 6
            height: analog.minuteLength
            color: "#E6E6E6"
            antialiasing: true
        }
    }
    Item {
        id: secondHand
        width: 480
        height: 480
        visible: analog.timeShown
        Rectangle {
            x: 238
            y: 0
            width: 4
            height: analog.secondsLength
            color: "#F5C444"
            antialiasing: true
        }
    }

    LocalClock {
        mode: "frame"
        running: analog.visible
        onRenderTime: ms => {
            const totalMinutes = ms / 60000
            hourHand.rotation = (totalMinutes / 60) % 12 * 30
            minuteHand.rotation = totalMinutes % 60 * 6
            // CLOCK_SMOOTH_SECONDS: the second hand sweeps
            secondHand.rotation = (ms / 1000) % 60 * 6
            analog.timeShown = true
        }
    }

    property alias dialProbe_secondRotation: secondHand.rotation
    readonly property bool dialProbe_wifiConnected: network.connected
}
