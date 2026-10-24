// The Dial (src/App.tsx): the 480 x 480 round display, turned to match the panel's mounting, with the
// router, the bottom status, the bubble and the scale overlay; plus what App.tsx does on its own: report
// ready, full brightness at start, the context button for the quick settings, the notifications screen,
// and the Community history scan after a shot.
import QtQuick
import QtQuick.Window
import Dial
import Dial.Native
import "Dial/screens/freepour" as FreePour
import "Dial/screens/freepour/ProfileContract.js" as PourOverContract
import "Dial/screens/support" as Support

Window {
    id: window
    width: 480
    height: 480
    visible: true
    color: "black"
    title: "Meticulous Dial"

    // The scale overlay (Scale.tsx): closed | small | full. While full, the router hears no gestures.
    property string scaleVisibility: "closed"

    Item {
        id: canvas
        width: 480
        height: 480
        anchors.centerIn: parent
        rotation: Native.rotation
        clip: true
        focus: true

        Router {
            id: router
            enabled: window.scaleVisibility !== "full"
        }

        BottomStatus {
            hidden: !!router.currentRoute.bottomStatusHidden
        }

        Bubble {
            id: bubble
            enabled: Nav.bubbleVisible && window.scaleVisibility !== "full"
        }

        Loader {
            id: scaleOverlay
            anchors.fill: parent
            z: 20
            source: Qt.resolvedUrl("Dial/screens/scale/Scale.qml")
            onLoaded: if (item && item.hasOwnProperty("visibility"))
                          window.scaleVisibility = Qt.binding(() => item.visibility)
        }

        // VITE_SHOW_CIRCLE: the round display's outline, for development on a square window.
        Rectangle {
            visible: Native.showCircle
            z: 1000
            x: -100
            y: -100
            width: 680
            height: 680
            radius: 340
            color: "transparent"
            border.color: "#222222"
            border.width: 100
        }

        // useSocketKeyboardListeners: the keyboard drives the Dial in development.
        Keys.onPressed: (event) => {
            if (event.isAutoRepeat && event.key !== Qt.Key_Left && event.key !== Qt.Key_Right) return
            Idle.resetTimer()
            const map = {}
            map[Qt.Key_Left] = "left"; map[Qt.Key_Right] = "right"; map[Qt.Key_Space] = "pressDown"
            map[Qt.Key_Return] = "context"; map[Qt.Key_Enter] = "context"; map[Qt.Key_Z] = "tareUp"
            map[Qt.Key_R] = "tareDown"; map[Qt.Key_S] = "longTare"; map[Qt.Key_E] = "longEncoder"
            map[Qt.Key_D] = "doubleTare"; map[Qt.Key_X] = "doubleClick"; map[Qt.Key_B] = "pressDown"
            map[Qt.Key_N] = "pressUp"
            if (map[event.key]) Input.emitGesture(map[event.key], 1000)
            if (event.key === Qt.Key_Q) Api.executeAction("stop")
        }
        Keys.onReleased: (event) => {
            if (event.isAutoRepeat) return
            if (event.key === Qt.Key_Space) { Input.emitGesture("pressUp", 1000); Input.emitGesture("click", 1000) }
            if (event.key === Qt.Key_T) Input.emitGesture("singleTare", 1000)
        }
    }

    // ---- App.tsx
    Component.onCompleted: {
        Native.ready()
        Api.setBrightness({ brightness: 1 }).catch(e => console.error("Error setting brightness", e.message))
        Notifications.load()
        Backend.connected   // instantiate the socket bridge
        // Installed pour-over profiles go through the Free Pour contract (profileApi.ts).
        Profiles.parsePourOverProfile = PourOverContract.parsePourOverProfile
        Profiles.refetchPourOver()
        // App.tsx: pour-over sessions saved while the backend was away are sent now.
        FreePour.FreePourStorage.syncAtStartup()
        // SocketProviderValue: reports dispatched from the app are collected and uploaded, headless.
        Support.DispatchedReports.start()
    }

    // App.tsx sets full brightness once at start. The Qt Dial can start before the backend answers (it no
    // longer waits for Weston), so it is set again when the backend comes online.
    Connections {
        target: Device
        function onCameOnline() {
            Api.setBrightness({ brightness: 1 }).catch(e => console.error("Error setting brightness", e.message))
        }
    }

    // The context button toggles the quick settings (App.tsx and Bubble.tsx's handlers: App's is off during
    // a shot or while the bubble intercepts gestures; the bubble's is always on, unless pinned).
    GestureHandler {
        id: contextHandler
        onContext: {
            if (Nav.bubbleVisible) {
                if (window.scaleVisibility === "full" || Nav.bubblePinned) return
                Nav.setBubbleDisplay({ visible: false, component: Nav.bubbleComponent })
            } else {
                if ((Stats.extracting || Nav.bubbleInterceptsGesture) && window.scaleVisibility === "full") return
                Nav.setBubbleDisplay({ visible: true, component: "quick-settings" })
            }
        }
    }

    // useNotificationHandler: any notification takes the screen; when the last one goes, back to where the
    // Dial was (the home if that screen does not count as a previous one).
    function syncNotifications() {
        if (Notifications.count > 0 && Nav.screen !== "notifications") {
            Nav.setScreen("notifications")
            Nav.closeBubble()
        } else if (Notifications.count === 0 && Nav.screen === "notifications") {
            const prevRoute = Routes.route(Nav.prev)
            Nav.setScreen(!Nav.prev || (prevRoute && prevRoute.ignoreAsPrevious) ? "profileHome" : Nav.prev)
        }
    }
    Connections {
        target: Notifications
        function onItemsChanged() { window.syncNotifications() }
    }
    Connections {
        target: Nav
        function onScreenSet() { window.syncNotifications() }
    }

    // After a shot the espresso history is compressed asynchronously: ask the Community uploader to scan
    // it after 3 s and again after 10 s.
    signal communityScanRequested()
    property bool extractionWasActive: false
    Connections {
        target: Stats
        function onExtractingChanged() {
            const completed = window.extractionWasActive && !Stats.extracting
            window.extractionWasActive = Stats.extracting
            if (completed) { firstScan.restart(); secondScan.restart() }
        }
    }
    Timer { id: firstScan; interval: 3000; onTriggered: window.communityScanRequested() }
    Timer { id: secondScan; interval: 10000; onTriggered: window.communityScanRequested() }
    onCommunityScanRequested: {
        if (typeof Community === "undefined") return
        const error = Community.scanHistory()
        if (error) console.error("Failed to request Community history scan:", error)
    }

    TestServer {
        root: canvas
        router: router
        bubble: bubble
        overlay: scaleOverlay.item
    }
}
