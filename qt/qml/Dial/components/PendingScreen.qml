// Placeholder of a screen not ported yet: its name, and a push goes back home.
import QtQuick
import Dial

Item {
    id: pending
    property string routeName: ""
    property bool inBubble: false
    anchors.fill: parent

    Text {
        anchors.centerIn: parent
        width: 300
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
        text: "Not ported yet:\n" + pending.routeName
        color: Theme.cream
        font.family: Theme.fontMono
        font.pixelSize: 20
    }
    GestureHandler {
        enabled: pending.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onPressDown: {
            if (pending.inBubble) Nav.setBubbleDisplay({ visible: true, component: "quick-settings" })
            else Nav.setScreen("profileHome")
        }
    }
}
