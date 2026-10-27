// The bubble (src/components/Bubble/Bubble.tsx, bubble.less): the 420 px #0f0f0f panel on the right that
// holds the quick settings and the menus opened from them. It springs in from the right (mass 1,
// stiffness 51, damping 11: translateX 100 % → 1 % in 450 ms, then rests at 0 when the enter class goes)
// and back out; while it closes it keeps showing the component it had.
//
// React mounts the component each time. Creating it costs 50-100 ms on the machine, a visible hitch at the
// start of the slide, so the components in `kept` are created once (ahead of time) and kept hidden; they
// get bubbleShown() when shown again, where they reset what a fresh mount would.
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
    readonly property Item current: _current
    property Item _current: null
    property var _kept: ({})
    readonly property var kept: ["quick-settings"]

    visible: shown

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
                bubble.unload()
                // handleExited
                if (!Nav.bubbleVisible) Nav.setBubbleDisplay({ visible: false, component: "" })
            }
        }
    }

    function create(name) {
        const route = Routes.route(name)
        if (!route || !route.url) {
            if (name) console.error("Bubble component not found:", name)
            return null
        }
        const component = Qt.createComponent(route.url)
        if (component.status !== Component.Ready) {
            console.error("Bubble component failed to load", name, component.errorString())
            return null
        }
        const item = component.createObject(panel, Object.assign({ visible: false }, route.props || {}))
        if (item && item.hasOwnProperty("inBubble")) item.inBubble = true
        return item
    }

    // Shows `name`, switching at once from whatever was shown.
    function load(name) {
        if (component === name && _current) return
        unload()
        component = name
        let item = _kept[name]
        if (!item) {
            item = create(name)
            if (item && kept.indexOf(name) >= 0) {
                const k = Object.assign({}, _kept)
                k[name] = item
                _kept = k
            }
        } else if (typeof item.bubbleShown === "function") {
            item.bubbleShown()
        }
        if (!item) return
        item.visible = true
        item.enabled = Qt.binding(() => bubble.enabled)
        _current = item
    }
    function unload() {
        if (_current) {
            if (_kept[component] === _current) {
                _current.visible = false
                _current.enabled = false
            } else {
                _current.destroy()
            }
        }
        _current = null
        component = ""
    }

    // Create the kept components while nothing moves, so the first opening is smooth too.
    Timer {
        interval: 1500
        running: true
        onTriggered: {
            for (const name of bubble.kept) {
                if (bubble._kept[name]) continue
                const item = bubble.create(name)
                if (!item) continue
                item.enabled = false
                const k = Object.assign({}, bubble._kept)
                k[name] = item
                bubble._kept = k
            }
        }
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
        }
    }
}
