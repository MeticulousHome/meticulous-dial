// One route on screen (Transitioner.tsx's .main-layout.route): the screen, its titles, and its enter or
// leave animation: 450 ms, scale on the route spring (0.3 / 2.3, or 0.87 / 1.4 when "small") with the
// fade-in / fade-out keyframes of navigation.less.
import QtQuick
import Dial

Item {
    id: host
    width: 480
    height: 480

    property string screenName
    property var route: ({})
    // The titles as this route shows them (the Transitioner decides which ones animate on their own).
    property var titleSpec
    property var parentTitleSpec: null
    property string bottomTitle: ""
    property bool showTitle: true
    property bool showParentTitle: true
    property bool showBottomTitle: true

    property string phase: "still"        // enter | leave | still
    property string direction: "in"
    property string animationSize: "large"
    property real progress: 1
    readonly property bool transitioning: phase !== "still"
    readonly property alias item: loader.item

    // A leaving route hears no gestures (VisibilityProvider value={false}).
    enabled: phase !== "leave"

    readonly property real zoomIn: animationSize === "small" ? 0.87 : Motion.ZOOM_IN_SCALE
    readonly property real zoomOut: animationSize === "small" ? 1.4 : Motion.ZOOM_OUT_SCALE
    readonly property real springValue: Motion.routeSpring(progress)

    scale: phase === "enter" ? Motion.lerp(direction === "in" ? zoomIn : zoomOut, 1, springValue)
         : phase === "leave" ? Motion.lerp(1, direction === "in" ? zoomOut : zoomIn, springValue)
         : 1
    opacity: phase === "enter" ? Motion.fadeIn(progress) : phase === "leave" ? Motion.fadeOut(progress) : 1
    transformOrigin: Item.Center

    NumberAnimation {
        id: run
        target: host
        property: "progress"
        from: 0
        to: 1
        duration: Motion.ROUTE_DURATION
        onFinished: if (host.phase === "enter") host.phase = "still"
    }

    function enter(dir, size) {
        direction = dir
        animationSize = size
        phase = "enter"
        run.restart()
    }
    function leave(dir, size) {
        direction = dir
        animationSize = size
        phase = "leave"
        run.restart()
    }
    function settle() {
        run.stop()
        phase = "still"
        progress = 1
    }

    Loader {
        id: loader
        anchors.fill: parent
        asynchronous: false
        Component.onCompleted: {
            const url = host.route.url
            if (!url) return
            const props = Object.assign({}, host.route.props || {})
            setSource(url, props)
        }
        onLoaded: {
            if (item && item.hasOwnProperty("transitioning"))
                item.transitioning = Qt.binding(() => host.transitioning)
            if (item && item.hasOwnProperty("routeName"))
                item.routeName = host.screenName
        }
        onStatusChanged: if (status === Loader.Error) console.error("Route", host.screenName, "failed to load", host.route.url)
    }

    NavTitle {
        visible: host.showParentTitle && host.parentTitleSpec !== null && host.parentTitleSpec !== undefined
        spec: host.parentTitleSpec
    }
    NavTitle {
        visible: host.showTitle && (typeof host.titleSpec === "string" || (host.titleSpec !== undefined && host.titleSpec !== null))
        spec: host.titleSpec
    }
    NavTitle {
        visible: host.showBottomTitle && host.bottomTitle.length > 0
        position: "bottom"
        spec: host.bottomTitle
    }
}
