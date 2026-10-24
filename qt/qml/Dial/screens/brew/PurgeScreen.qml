// The purge screen (src/components/PurgePiston): "manual-purge", shown while the machine purges or homes
// the piston. Full-screen, the piston Lottie follows the piston's position (m_pos, 0..74 mm over its 60
// frames, each new reading reached in 200 ms linear) over a blinking Lottie; the pressure and the flow on
// either side. Back home once the machine is idle; a double click aborts.
import QtQuick
import Dial
import Dial.Native
import "BrewLogic.js" as Logic

Item {
    id: purge
    anchors.fill: parent
    property bool transitioning: false

    // The socket "action" events this screen sent (a test probe).
    property var sentActions: []
    readonly property var dialProbe_sent: sentActions
    function send(name) {
        sentActions = sentActions.concat([name])
        Backend.action(name)
    }

    readonly property real maxPosition: 74
    readonly property real totalFrames: 60
    readonly property real position: Stats.sensorData.m_pos

    // Test probes
    readonly property real dialProbe_pistonFrame: pistonFrame
    readonly property bool dialProbe_blinkRaised: blinkRaised

    function brewDoubleClick() {
        const decision = Logic.decideDoubleClick({ name: Stats.name, extracting: Stats.extracting }, { allowFinish: false })
        console.log("doubleClick decision", JSON.stringify({ screen: Nav.screen, decision: decision, name: Stats.name, extracting: Stats.extracting }))
        if (decision) send(decision)
    }
    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onDoubleClick: purge.brewDoubleClick()
    }

    function idleEffect() {
        if (Stats.name === "idle" && !Notifications.hasNotifications && !Profiles.profileStarting) Nav.setScreen("profileHome")
    }
    Connections {
        target: Stats
        function onNameChanged() { purge.idleEffect() }
    }

    // ---- PurgePiston: the first reading places the piston (goToAndStop), every later one animates to it.
    property bool initialized: false
    property real pistonFrame: 0
    function positionEffect() {
        if (isNaN(position) || position < 0) return
        const current = Math.min(position, maxPosition) / maxPosition * totalFrames
        if (!initialized) {
            initialized = true
            pistonAnim.stop()
            pistonFrame = current
            return
        }
        pistonAnim.stop()
        pistonAnim.from = pistonFrame
        pistonAnim.to = Math.max(0, Math.min(current, totalFrames))
        pistonAnim.start()
    }
    onPositionChanged: {
        positionEffect()
        nanCheck.restart()
    }
    NumberAnimation {
        id: pistonAnim
        target: purge
        property: "pistonFrame"
        duration: 200
    }
    onPistonFrameChanged: piston.gotoAndStop(pistonFrame)
    // Without a position for 2 s, leave.
    Timer {
        id: nanCheck
        interval: 2000
        repeat: true
        running: true
        onTriggered: if (isNaN(purge.position)) Nav.setScreen("profileHome")
    }

    Component.onCompleted: {
        idleEffect()
        // At home the blink sits 206.5 px higher.
        if (Stats.name === "home") blinkRaised = true
        positionEffect()
    }
    property bool blinkRaised: false

    // Both Lotties are 480 x 480 full-screen in React; the files are cropped to the part they draw in
    // (screens/brew/tools/crop_lottie.py) and placed there 1:1.
    LottieItem {
        id: blink
        x: 160
        y: 324 - (purge.blinkRaised ? 206.5 : 0)
        width: 160
        height: 96
        source: Theme.asset("lottie/brew-blink.json")
        loops: -1
        onLoadedChanged: if (loaded) play()
    }
    LottieItem {
        id: piston
        x: 160
        y: 116
        width: 160
        height: 300
        source: Theme.asset("lottie/brew-piston.json")
        loops: 1
        // LottieItem rewinds to the segment start right after loadedChanged: place it a moment later.
        onLoadedChanged: if (loaded) Qt.callLater(() => piston.gotoAndStop(purge.pistonFrame))
    }

    // .values: the two readings, Mono 40 px over an 18 px grey unit, in 64 px columns 50 px in from the
    // edges (space-between inside the 50 px padding), vertically centered.
    Repeater {
        model: 2
        delegate: Item {
            required property int index
            x: index === 0 ? 50 : 480 - 50 - 64
            y: (480 - 63) / 2
            width: 64
            height: 63
            Text {
                // Wider than its 64 px column, the line overflows to the right.
                x: Math.max(0, (64 - implicitWidth) / 2)
                height: 40
                verticalAlignment: Text.AlignVCenter
                text: Logic.formatStatValue(parent.index === 0 ? Stats.sensors.p : Stats.sensors.f, 1)
                color: "white"
                font.family: Theme.fontMono
                font.pixelSize: 40
            }
            Text {
                y: 45
                width: 64
                height: 18
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: parent.index === 0 ? "bar" : "ml/s"
                color: "gray"
                font.family: Theme.fontMono
                font.pixelSize: 18
            }
        }
    }
}
