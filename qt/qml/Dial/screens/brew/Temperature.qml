// Temperature (src/components/Heating/Temperatures.tsx): the value in ABC Diatype Mono (60 px light, or
// 25 px at weight 200 when small; -0.02em; line-height 1) and "°C" top-aligned after it (25 px regular at
// line-height 1.2, or 19 px weight 200 at line-height 1; #e7e7e799), 5 px apart (4 when small). The large
// one rolls its digits (AnimatedCounter).
import QtQuick
import Dial

Item {
    id: temperature
    property real value: 0
    property bool small: false
    property bool animated: false

    readonly property color tempColor: "#e7e7e7"
    readonly property real valueSize: small ? 25 : 60

    implicitWidth: valueBox.width + (small ? 4 : 5) + unit.implicitWidth
    implicitHeight: valueSize
    width: implicitWidth
    height: implicitHeight

    Item {
        id: valueBox
        width: temperature.animated ? counter.width : plain.implicitWidth
        height: temperature.valueSize
        RollingNumber {
            id: counter
            visible: temperature.animated
            value: temperature.animated ? temperature.value : 0
            fontSize: temperature.valueSize
            fontFamily: Theme.fontMono
            fontWeight: temperature.small ? Font.Thin : Font.Light
            letterSpacing: -0.02 * temperature.valueSize
            color: temperature.tempColor
        }
        Text {
            id: plain
            visible: !temperature.animated
            height: temperature.valueSize
            verticalAlignment: Text.AlignVCenter
            text: String(temperature.value)
            color: temperature.tempColor
            font.family: Theme.fontMono
            font.weight: temperature.small ? Font.Thin : Font.Light
            font.pixelSize: temperature.valueSize
            font.letterSpacing: -0.02 * temperature.valueSize
        }
    }
    Text {
        id: unit
        x: valueBox.width + (temperature.small ? 4 : 5)
        height: temperature.small ? 19 : 30
        verticalAlignment: Text.AlignVCenter
        text: "°C"
        color: "#99e7e7e7"
        font.family: temperature.small ? Theme.fontThin : Theme.fontRegular
        font.weight: temperature.small ? Font.Normal : Font.Normal
        font.pixelSize: temperature.small ? 19 : 25
        font.letterSpacing: temperature.small ? -0.19 : -0.25
    }
}
