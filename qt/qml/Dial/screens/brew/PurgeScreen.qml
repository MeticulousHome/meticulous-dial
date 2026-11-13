// The purge screen (src/components/PurgePiston): "manual-purge", shown while the machine purges or homes
// the piston. Full-screen, the piston follows the piston's position (m_pos, 0..74 mm, the Lottie's 60
// frames; SmoothPiston: from where it is, smoothly between the readings) over a blinking Lottie; the
// pressure and the flow on either side. Back home once the machine is idle; a double click aborts.
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

    // ---- PurgePiston: the piston's frame in the Lottie it was drawn from (0..60).
    readonly property real pistonFrame: isNaN(piston.shown) ? NaN : piston.shown / maxPosition * totalFrames
    onPositionChanged: nanCheck.restart()
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
    // lottie/brew-piston.json baked: the disc's back, the rod (static) and the disc's front, which slide
    // 206 px from frame 0 to 60.
    SmoothPiston {
        id: piston
        x: 160
        y: 116
        width: 160
        height: 300
        position: purge.position
        maxPosition: purge.maxPosition
        travel: 206
        layers: [
            { source: Theme.asset("images/brew-piston-back.png"), moves: true },
            { source: Theme.asset("images/brew-piston-rod.png"), moves: false },
            { source: Theme.asset("images/brew-piston-front.png"), moves: true }
        ]
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
