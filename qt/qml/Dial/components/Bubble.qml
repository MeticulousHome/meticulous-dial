// The bubble (src/components/Bubble/Bubble.tsx, bubble.less): the 420 px #0f0f0f panel on the right that
// holds the quick settings and the menus opened from them. It springs in from the right (mass 1,
// stiffness 51, damping 11: translateX 100 % → 1 % in 450 ms, then rests at 0 when the enter class goes)
// and back out; while it closes it keeps showing the component it had.
import QtQuick
import Dial

Item {
    id: bubble
    width: 480
    height: 480
    z: 10

    // Shown while visible and while the exit animation runs (unmountOnExit).
    property bool shown: false
    property string component: ""
    property real progress: 1
    property bool entering: true
    readonly property bool active: shown

    visible: shown
    enabled: Nav.bubbleVisible

    readonly property real shift: progress >= 1 ? (entering ? 0 : 480)
                                 : entering ? Motion.lerp(480, 4.8, Motion.bubbleSpring(progress))
                                            : Motion.lerp(4.8, 480, Motion.bubbleSpring(progress))

    NumberAnimation {
        id: slide
        target: bubble
        property: "progress"
        from: 0
        to: 1
        duration: 450
        onFinished: {
            if (!bubble.entering) {
                bubble.shown = false
                content.source = ""
                bubble.component = ""
                // handleExited
                if (!Nav.bubbleVisible) Nav.setBubbleDisplay({ visible: false, component: "" })
            }
        }
    }

    function load(name) {
        const route = Routes.route(name)
        if (!route || !route.url) {
            if (name) console.error("Bubble component not found:", name)
            return
        }
        if (component === name && content.status !== Loader.Null) return
        component = name
        content.setSource(route.url, route.props || {})
    }

    Connections {
        target: Nav
        function onBubbleVisibleChanged() {
            if (Nav.bubbleVisible) {
                if (Nav.bubbleComponent) bubble.load(Nav.bubbleComponent)
                bubble.entering = true
                bubble.shown = true
                slide.restart()
            } else if (bubble.shown && bubble.entering) {
                bubble.entering = false
                slide.restart()
            }
        }
        function onBubbleComponentChanged() {
            // The component switches at once while open; on close it keeps the last one.
            if (Nav.bubbleComponent && Nav.bubbleVisible) bubble.load(Nav.bubbleComponent)
        }
    }

    Item {
        x: bubble.shift
        width: 480
        height: 480
        Rectangle {
            id: panel
            x: 60
            width: 420
            height: 480
            color: Theme.bubble
            Loader {
                id: content
                anchors.fill: parent
                onLoaded: if (item && item.hasOwnProperty("inBubble")) item.inBubble = true
                onStatusChanged: if (status === Loader.Error) console.error("Bubble component failed to load", bubble.component)
            }
        }
    }
}
