pragma Singleton
// Which screen the Dial shows and what the bubble (the right-hand panel: quick settings and the menus
// opened from it) holds: the React Dial's screens slice
// (src/components/store/features/screens/screens-slice.ts).
import QtQuick
import Dial.Native

QtObject {
    id: nav

    // A ScreenType of the React Dial (the keys of Routes.table). --screen=<name> starts elsewhere.
    property string screen: Native.startScreen.length ? Native.startScreen : "ready"
    property string prev: ""

    // bubbleDisplay: { visible, component, previousComponent, interceptsGesture, pinned }
    property bool bubbleVisible: false
    property string bubbleComponent: ""
    property string bubblePreviousComponent: ""
    property bool bubbleInterceptsGesture: false
    property bool bubblePinned: false

    // Every screen shown, in order, with the time ([[ms, name]]): for the end-to-end tests.
    property var history: []

    signal screenSet(string screen, string prev)

    function setScreen(name) {
        if (!name) {
            console.error("Setting screen to undefined! Aborting", name)
            return
        }
        prev = screen
        screen = name
        screenSet(name, prev)
    }

    // setBubbleDisplay({ visible, component?, interceptsGesture? })
    function setBubbleDisplay(o) {
        bubblePreviousComponent = bubbleComponent
        bubbleComponent = o.component || ""
        bubbleInterceptsGesture = !!o.interceptsGesture || !!o.visible
        if (!o.visible) bubblePinned = false
        bubbleVisible = !!o.visible
    }

    function setBubblePinned(pinned) { bubblePinned = pinned }

    // The common "close the bubble" of the React code: setBubbleDisplay({ visible: false, component: undefined }).
    function closeBubble(interceptsGesture) {
        setBubbleDisplay({ visible: false, component: "", interceptsGesture: !!interceptsGesture })
    }
    function openBubble(component) { setBubbleDisplay({ visible: true, component: component }) }
}
