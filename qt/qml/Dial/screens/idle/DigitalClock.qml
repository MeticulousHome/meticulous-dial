// The digital sleep clocks (src/components/IdleScreen/DigitalClock.tsx, DigitalClockBase.tsx,
// MetCatClock.tsx, DigitalClock.css): the Wi-Fi status on top, then the hours over the minutes (and AM / PM
// in the 12-hour format, clock_format_24_hour), or with useMetCat "HH:MM" over the MetCat animation. The OS
// local time is redrawn every 250 ms. The brightness goes to 0 on mount and back to 1 on unmount.
//
// The font is 'Rubik', sans-serif: Rubik is not shipped, so the system sans-serif draws it, as in React.
// The CSS line boxes use the font's ascent and descent rounded to pixels (line-height normal).
import QtQuick
import Dial
import Dial.Native
import "clockTime.js" as ClockTime

Item {
    id: digital
    width: 480
    height: 480

    property bool useMetCat: false

    property real milliseconds: -1
    readonly property bool hasTime: milliseconds >= 0
    readonly property var time: hasTime ? ClockTime.formatTime(ClockTime.uses24HourClock(BackendSettings.data), milliseconds) : null

    // The height of .clock-wrapper (the IdleScreen's pixel-shift rotation origin is its middle).
    readonly property real flowHeight: !hasTime ? 0
        : useMetCat ? 120 + mini.lineBox - 20
        : 120 + 2 * (big.lineBox - 20) + (time.midday ? small.lineBox - 20 : 0)

    readonly property string fontFamily: "Rubik"

    NetworkStatus { id: network }
    readonly property bool isWifiConnected: network.connected

    // line-height: normal with pixel-rounded ascent and descent
    component LineMetrics: FontMetrics {
        readonly property real roundedAscent: Math.round(ascent)
        readonly property real lineBox: Math.round(ascent) + Math.round(descent)
    }
    LineMetrics { id: indicatorMetrics; font.family: digital.fontFamily; font.pixelSize: 20; font.weight: Font.Medium }
    LineMetrics { id: big; font.family: digital.fontFamily; font.pixelSize: 110; font.weight: Font.Normal }
    LineMetrics { id: small; font.family: digital.fontFamily; font.pixelSize: 55; font.weight: Font.Medium }
    LineMetrics { id: mini; font.family: digital.fontFamily; font.pixelSize: 84; font.weight: Font.Light }

    // A .clock line: its CSS box starts at `top`; the text's baseline is the rounded ascent below.
    component ClockLine: Text {
        property real top: 0
        property LineMetrics metrics
        x: (480 - implicitWidth) / 2
        y: top + metrics.roundedAscent - metrics.ascent
        font.family: digital.fontFamily
        color: "#dddddd"
    }

    // .indicators.indicators-top: y 25, 30 px tall, centered, 5 px apart, #606060.
    Row {
        y: 25
        height: 30
        x: (480 - width) / 2
        spacing: 5
        Image {
            width: 30
            height: 30
            sourceSize: Qt.size(30, 30)
            source: Theme.asset(digital.isWifiConnected ? "icons/idle-wifi.png" : "icons/idle-no-wifi.png")
            smooth: true
            mipmap: true
        }
        Item {
            width: indicatorText.implicitWidth
            height: 30
            Text {
                id: indicatorText
                y: (30 - indicatorMetrics.lineBox) / 2 + indicatorMetrics.roundedAscent - indicatorMetrics.ascent
                text: digital.isWifiConnected ? "Ready" : "Not connected"
                color: "#606060"
                font.family: digital.fontFamily
                font.pixelSize: 20
                font.weight: Font.Medium
            }
        }
    }

    // DigitalClockBase: hours, minutes (110 px, margins -10 px), AM / PM (55 px, #606060).
    Item {
        visible: digital.hasTime && !digital.useMetCat
        anchors.fill: parent
        ClockLine {
            metrics: big
            top: 110
            font.pixelSize: 110
            text: digital.time ? ClockTime.pad2(digital.time.hours) : ""
        }
        ClockLine {
            metrics: big
            top: 110 + big.lineBox - 20
            font.pixelSize: 110
            text: digital.time ? ClockTime.pad2(digital.time.minutes) : ""
        }
        ClockLine {
            visible: !!(digital.time && digital.time.midday)
            metrics: small
            top: 110 + 2 * (big.lineBox - 20)
            font.pixelSize: 55
            font.weight: Font.Medium
            color: "#606060"
            text: digital.time ? digital.time.midday : ""
        }
    }

    // MetCatClock: "HH:MM" (84 px, light) and the cat (480 x 480 at y 60): frames 0-120 once, then 120-313
    // in a loop.
    Item {
        visible: digital.hasTime && digital.useMetCat
        anchors.fill: parent
        ClockLine {
            metrics: mini
            top: 110
            font.pixelSize: 84
            font.weight: Font.Light
            text: digital.time ? ClockTime.pad2(digital.time.hours) + ":" + ClockTime.pad2(digital.time.minutes) : ""
        }
        Loader {
            active: digital.useMetCat
            y: 60
            width: 480
            height: 480
            sourceComponent: LottieItem {
                id: cat
                width: 480
                height: 480
                source: Theme.asset("lottie/idle-metcat.json")
                startFrame: 0
                endFrame: 120
                loops: 1
                Component.onCompleted: play()
                onFinished: {
                    startFrame = 120
                    endFrame = 313
                    loops = -1
                    gotoAndPlay(120)
                }
            }
        }
    }

    LocalClock {
        mode: "refresh"
        onRenderTime: ms => digital.milliseconds = ms
    }

    Component.onCompleted: Api.setBrightness({ brightness: 0 }).catch(e => console.error("Error setting brightness", e && e.message))
    Component.onDestruction: Api.setBrightness({ brightness: 1 }).catch(e => console.error("Error setting brightness", e && e.message))

    readonly property string dialProbe_digitalTime: time ? (useMetCat ? ClockTime.pad2(time.hours) + ":" + ClockTime.pad2(time.minutes)
                                                                       : ClockTime.pad2(time.hours) + " " + ClockTime.pad2(time.minutes) + (time.midday ? " " + time.midday : "")) : ""
}
