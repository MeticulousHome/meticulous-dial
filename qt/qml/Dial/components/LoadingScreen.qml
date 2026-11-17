// LoadingScreen (src/components/LoadingScreen): an 80 px ring, #f3f3f3 with a #f5c444 top quarter,
// spinning once a second, and an optional message under it.
import QtQuick
import Dial

Item {
    id: loading
    property string message: ""
    anchors.fill: parent

    Item {
        id: spinner
        // top/left calc(50% - 40px); the 5 px border sits outside the 80 px box (content-box).
        x: parent.width / 2 - 40
        y: parent.height / 2 - 40
        width: 90
        height: 90
        Arc { anchors.fill: parent; radius: 42.5; lineWidth: 5; color: "#f3f3f3"; sweep: 1 }
        Arc { anchors.fill: parent; radius: 42.5; lineWidth: 5; color: Theme.brandYellow; sweep: 0.25; startAngle: 135 }
        RotationAnimation on rotation { from: 0; to: 360; duration: 1000; loops: Animation.Infinite; running: loading.visible }
    }
    Text {
        visible: loading.message.length > 0
        anchors.horizontalCenter: parent.horizontalCenter
        y: parent.height / 2 + 68
        width: 170
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
        text: loading.message
        color: "white"
        font.family: Theme.fontMono
        font.pixelSize: 14
        font.bold: true
        lineHeight: 1.2
        font.capitalization: Font.AllUppercase
    }
}
