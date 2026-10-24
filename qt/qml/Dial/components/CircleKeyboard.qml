// PLACEHOLDER until the profile group ports src/components/CircleKeyboard (keep this API):
//   name, defaultValue (string), onlyLetters, capitalizeFirstLetter, ignoreGestures (shouldIgnoreGesture),
//   prefix, suffix; signals submitted(text), cancelled(), edited(text) (onChange), longPressed().
import QtQuick
import Dial

Item {
    id: keyboard
    anchors.fill: parent
    property string name: ""
    property string defaultValue: ""
    property bool onlyLetters: false
    property bool capitalizeFirstLetter: true
    property bool ignoreGestures: false
    property string prefix: ""
    property string suffix: ""
    property string text: defaultValue
    signal submitted(string text)
    signal cancelled()
    signal edited(string text)
    signal longPressed()

    Text {
        anchors.centerIn: parent
        text: keyboard.name + "\n" + keyboard.prefix + keyboard.text + keyboard.suffix
        color: "white"
        horizontalAlignment: Text.AlignHCenter
        font.family: Theme.fontRegular
        font.pixelSize: 24
    }
    GestureHandler {
        enabled: !keyboard.ignoreGestures && !Nav.bubbleInterceptsGesture
        onPressDown: keyboard.submitted(keyboard.text)
        onContext: keyboard.cancelled()
    }
}
