// The status under the home (src/components/BottomStatus): temperature with the preheat funnel, the weight
// or "Scale not connected", "Waiting for the backend to come online", and the motor warning. It fades in
// (1 s) and out (1 s) with the route's bottomStatusHidden.
import QtQuick
import QtQuick.Shapes
import Dial

Item {
    id: status
    property bool hidden: false
    width: 480
    height: 480

    readonly property bool online: Device.isOnline
    readonly property bool scaleConnected: Stats.scaleConnected
    readonly property bool preheating: Stats.preheatTimeLeft !== 0

    // formatStatValue(value, 1): one decimal, ".0" on whole numbers.
    function formatStat(value) {
        const v = Math.round(Number(value) * 10) / 10
        if (isNaN(v)) return "NaN"
        return /^-?[0-9]+$/.test(String(v)) ? v + ".0" : String(v)
    }

    // bottomFadeIn: 0.02 → 0.9 (24 %) → 1; bottomFadeOut: 0.8 → 0.3 (20 %) → 0 (21 %).
    property real fade: 1
    opacity: hidden ? Motion.keyframes([[0, 0.8], [0.2, 0.3], [0.21, 0], [1, 0]], fade)
                    : Motion.keyframes([[0, 0.02], [0.24, 0.9], [1, 1]], fade)
    visible: opacity > 0
    NumberAnimation on fade { id: fadeAnim; from: 0; to: 1; duration: 1000; running: false }
    // Only a change after it is created fades: `hidden` going from its default to the boot screen's true
    // played the fade-out, which starts at 0.8, and flashed "Waiting for the backend to come online".
    property bool _created: false
    Component.onCompleted: _created = true
    onHiddenChanged: if (_created) fadeAnim.restart()

    // .bottom-status { bottom: 53px }: a column centered on the screen, its bottom edge 53 px up.
    Column {
        id: content
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 53

        Row {
            visible: status.online
            anchors.horizontalCenter: parent.horizontalCenter
            height: 23
            Text {
                text: status.formatStat(Stats.sensors.t)
                color: Theme.cream
                font.family: Theme.fontMono
                font.pixelSize: 24
                font.letterSpacing: -0.48
                height: 22
                verticalAlignment: Text.AlignTop
            }
            Text {
                leftPadding: 3
                width: 27
                text: "°C"
                color: Theme.cream
                font.family: Theme.fontRegular
                font.pixelSize: 11
            }
            Item {
                visible: status.preheating
                width: 37
                height: 23
                Funnel { x: 10; glowing: status.preheating }
            }
        }
        Item {
            anchors.horizontalCenter: parent.horizontalCenter
            width: Math.max(weightRow.visible ? weightRow.implicitWidth : 0, message.visible ? message.implicitWidth : 0)
            height: weightRow.visible ? 22 : message.implicitHeight
            Row {
                id: weightRow
                visible: status.online && status.scaleConnected
                anchors.horizontalCenter: parent.horizontalCenter
                Text {
                    text: status.formatStat(Stats.sensors.w)
                    color: Theme.cream
                    font.family: Theme.fontMono
                    font.pixelSize: 24
                    font.letterSpacing: -0.48
                    height: 22
                }
                Text {
                    leftPadding: 3
                    width: 27
                    text: "gr"
                    color: Theme.cream
                    font.family: Theme.fontRegular
                    font.pixelSize: 11
                }
            }
            Text {
                id: message
                visible: !weightRow.visible
                anchors.horizontalCenter: parent.horizontalCenter
                width: status.online ? implicitWidth : Math.min(implicitWidth, 300)
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: status.online ? "Scale not connected" : "Waiting for the backend to come online"
                color: Theme.error
                font.family: Theme.fontRegular
                font.pixelSize: 24
            }
        }
        Text {
            visible: Notifications.motorHot
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Motor temperature too high"
            color: Theme.error
            font.family: Theme.fontRegular
            font.pixelSize: 16
        }
    }

    // The preheat funnel (Funnel.tsx, funnel.css): #feffed, blinking to #981902 and back every 2.3 s while
    // preheating; 23 px tall (the SVG's 27 x 25 scaled to the container's height).
    component Funnel: Item {
        id: funnel
        property bool glowing: false
        width: 27 * 23 / 25
        height: 23
        property color tint: "#feffed"
        Shape {
            width: 27
            height: 25
            scale: 23 / 25
            transformOrigin: Item.TopLeft
            ShapePath {
                strokeWidth: 0.5
                strokeColor: funnel.tint
                fillColor: funnel.tint
                PathSvg { path: "M3.81286 17.4812C3.88007 11.957 3.42126 8.87114 1.06123 2.35297C0.823644 1.69677 1.30674 1 2.00463 1H25.1209C25.8188 1 26.3019 1.69677 26.0643 2.35297C23.7043 8.87114 23.2455 11.957 23.3127 17.4812L23.3128 17.49V22.9832C23.3128 23.4828 21.0628 24.5 13.5628 24.5C6.06279 24.5 3.81279 23.4828 3.81279 22.9832V17.49L3.81286 17.4812Z" }
            }
        }
        SequentialAnimation {
            running: funnel.glowing && funnel.visible
            loops: Animation.Infinite
            onRunningChanged: if (!running) funnel.tint = "#feffed"
            ColorAnimation { target: funnel; property: "tint"; from: "#feffed"; to: "#981902"; duration: 1150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
            ColorAnimation { target: funnel; property: "tint"; from: "#981902"; to: "#feffed"; duration: 1150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        }
    }
}
