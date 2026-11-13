// Router.tsx + Transitioner.tsx: shows Nav.screen. On a change the new route enters (scale + fade) while
// the old one leaves, 450 ms; a change during a transition makes the entering route the leaving one.
//
// Direction: "in" when the new route comes later in routes.ts than the previous screen (Nav.prev), else
// "out", unless the route's animationDirectionFrom names the previous screen.
//
// The title hand-over of the Transitioner (a title shared by two routes animating on its own) is ported
// as the React code decides it, but it never triggers with today's route table: the only candidates are
// the profile pills, which React compares by element identity (always different), so every transition
// is "large" and every title moves with its route.
import QtQuick
import Dial
import Dial.Native

Item {
    id: router
    width: 480
    height: 480

    property Item current: null
    property Item previous: null
    readonly property var currentRoute: current ? current.route : ({})
    readonly property string currentScreen: current ? current.screenName : ""
    readonly property bool transitioning: previous !== null

    signal routeShown(string name)

    Component {
        id: hostComponent
        RouteHost {}
    }

    function titleFor(name, route) {
        const hide = Profiles.isCreatingProfile && (name === "pressetSettings" || route.parent === "pressetSettings")
        if (hide && route.title === Routes.activeProfilesTitle) return undefined
        return Routes.evaluate(route.title)
    }
    function parentTitleFor(name, route) {
        if (!route.parentTitle) return null
        const hide = Profiles.isCreatingProfile && (name === "pressetSettings" || route.parent === "pressetSettings")
        if (hide && route.parentTitle === Routes.activeProfilesTitle) return undefined
        return Routes.evaluate(route.parentTitle)
    }

    function sync() {
        const name = Nav.screen
        if (current && current.screenName === name) return
        const route = Routes.route(name)
        if (!route) {
            console.error("Route not found:", name)
            return
        }
        const prevName = Nav.prev
        const calculated = !prevName || Routes.index(name) >= Routes.index(prevName) ? "in" : "out"
        const direction = (prevName && route.animationDirectionFrom && route.animationDirectionFrom[prevName]) || calculated
        console.log("Router", prevName, "->", name, direction + "(" + calculated + ")")

        const host = hostComponent.createObject(router, {
            screenName: name,
            route: route,
            bottomTitle: route.bottomTitle || ""
        })
        host.titleSpec = Qt.binding(() => titleFor(name, route))
        host.parentTitleSpec = Qt.binding(() => parentTitleFor(name, route))

        if (!current) {
            current = host
            Nav.history = Nav.history.concat([[Math.round(Native.monotonicMs()), name]])
            routeShown(name)
            return
        }

        if (previous) {
            previous.destroy()
            previous = null
        }
        const old = current
        const oldTitle = old.titleSpec, oldParentTitle = old.parentTitleSpec
        const newTitle = host.titleSpec, newParentTitle = host.parentTitleSpec
        const sharedTitleTransition = Routes.sameTitle(oldTitle, newTitle) && (route.titleShared || old.route.titleShared)
        const shouldTransitionTitle = sharedTitleTransition || Routes.sameTitle(oldParentTitle, newTitle)
        const shouldTransitionParentTitle = Routes.sameTitle(oldTitle, newParentTitle)
        const size = shouldTransitionTitle || shouldTransitionParentTitle ? "small" : "large"

        host.showParentTitle = Qt.binding(() => !(router.previous && shouldTransitionParentTitle))
        host.showTitle = Qt.binding(() => !(router.previous && shouldTransitionTitle))
        host.showBottomTitle = Qt.binding(() => !(router.previous && shouldTransitionTitle))
        old.showParentTitle = !(direction === "in" ? shouldTransitionParentTitle : shouldTransitionTitle)
        old.showTitle = !((route.titleShared || old.route.titleShared) ? shouldTransitionTitle : shouldTransitionParentTitle)
                        && (!!newTitle || typeof oldTitle === "string")
        old.showBottomTitle = false

        // The leaving route comes after the entering one in the React DOM: it is drawn on top.
        old.z = 1
        host.z = 0
        old.leave(direction, size)
        host.enter(direction, size)
        previous = old
        current = host
        cleanup.restart()
        Nav.history = Nav.history.concat([[Math.round(Native.monotonicMs()), name]])
        routeShown(name)
    }

    Timer {
        id: cleanup
        interval: Motion.ROUTE_DURATION
        onTriggered: {
            if (router.previous) {
                router.previous.destroy()
                router.previous = null
            }
        }
    }

    Connections {
        target: Nav
        function onScreenSet() { Qt.callLater(router.sync) }
    }
    Component.onCompleted: sync()
}
