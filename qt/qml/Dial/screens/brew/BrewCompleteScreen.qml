// Brew complete (src/components/BrewCompleteScreen/BrewCompleteScreen.tsx), "remove cup" / "click to purge"
// and the purge after them: the cup leaving the drip tray, the shot's weight ("Scale not connected"
// without a scale), "Push to purge" / "Remove cup" and the brew time. Once the purge starts the shot's
// graph replaces them (and stays), with the small piston on the left while it purges.
// It goes home when the machine is idle, unless the knob was turned (the user is reading the graph): then
// a click puts it away. A manual brew holds the graph by itself (the quick menu offers to save it) until
// that click, and rests on the idle screen after the idle timeout. A click answers "click to purge".
import QtQuick
import Dial
import "BrewLogic.js" as Logic

Item {
    id: complete
    anchors.fill: parent
    property bool transitioning: false

    // The socket "action" events this screen sent (a test probe).
    property var sentActions: []
    readonly property var dialProbe_sent: sentActions
    function send(name) {
        sentActions = sentActions.concat([name])
        Backend.action(name)
    }

    readonly property int headerTop: 115
    readonly property string statsName: Stats.name
    readonly property real brewTime: Stats.profileTime
    readonly property real lastBrewWeight: Stats.sensors.w
    readonly property string weight: Logic.brewWeight(lastBrewWeight)
    readonly property bool scaleConnected: !isNaN(lastBrewWeight)
    readonly property bool isPurging: statsName === "purge"
    readonly property bool isIdle: statsName === "idle" || statsName === "END_STAGE"
    property bool showPlot: false
    property bool keepGraph: false
    property bool manualGraphReleased: false
    property bool wasManualBrew: false

    readonly property var graphProfile: wasManualBrew || ManualMode.isManualProfile ? ManualMode.activeProfile : Profiles.localProfile
    readonly property string stateLabel: statsName === "click to purge" ? "Push to purge" : statsName === "remove cup" ? "Remove cup" : ""

    // Test probes
    readonly property bool dialProbe_showPlot: showPlot
    readonly property bool dialProbe_keepGraph: keepGraph
    readonly property string dialProbe_weight: scaleConnected ? weight : ""

    onGraphProfileChanged: checkProfile()
    function checkProfile() {
        if (!graphProfile) {
            console.error("History was opened without a profile selected")
            Nav.setScreen("profileHome")
        }
    }
    function manualEffect() { if (ManualMode.isManualProfile) wasManualBrew = true }
    Connections {
        target: ManualMode
        function onIsManualProfileChanged() { complete.manualEffect() }
    }
    function idleEffect() {
        if (!isIdle || Notifications.hasNotifications) return
        if (wasManualBrew && !manualGraphReleased) {
            keepGraph = true
            return
        }
        if (!keepGraph) Nav.setScreen("profileHome")
    }
    onIsIdleChanged: idleEffect()
    onKeepGraphChanged: { idleEffect(); idleTimerEffect() }
    Connections {
        target: Notifications
        function onHasNotificationsChanged() { complete.idleEffect() }
    }
    // An unattended machine does not sit on a held manual graph forever.
    function idleTimerEffect() {
        if (!Idle.isIdle || !wasManualBrew || !keepGraph) return
        Nav.closeBubble()
        Nav.setScreen("idle")
    }
    Connections {
        target: Idle
        function onIsIdleChanged() { complete.idleTimerEffect() }
    }
    onIsPurgingChanged: if (isPurging) showPlot = true
    Component.onCompleted: {
        checkProfile()
        manualEffect()
        idleEffect()
        idleTimerEffect()
        if (isPurging) showPlot = true
    }

    function brewDoubleClick() {
        const decision = Logic.decideDoubleClick({ name: Stats.name, extracting: Stats.extracting }, { allowFinish: false })
        console.log("doubleClick decision", JSON.stringify({ screen: Nav.screen, decision: decision, name: Stats.name, extracting: Stats.extracting }))
        if (decision) send(decision)
    }
    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onDoubleClick: complete.brewDoubleClick()
        onClick: {
            if (complete.statsName === "click to purge") complete.send("continue")
            if (complete.isIdle && complete.keepGraph) {
                complete.manualGraphReleased = true
                complete.keepGraph = false
            }
        }
        onTurnLeft: complete.keepGraph = true
        onTurnRight: complete.keepGraph = true
    }

    // ---- ModularLeft moved 22 px right and 18 px up, content to the left: the small piston
    MiniPurgePiston {
        show: complete.isPurging
        x: 22 + 10
        y: complete.headerTop - 18 + 10 + (248 - height) / 2
    }

    // ---- the graph: ModularRight without padding, from the left edge; the 500 px GraphContainer is
    // squeezed to its content (flex-shrink: 20 + 266 px) and centered in the 250 px, so the plot starts at
    // 117 px, where ShotGraph (which centers its content in the full 480) puts it 127 px down.
    Loader {
        active: complete.showPlot
        y: complete.headerTop + (250 - 286) / 2 + 20 - 127
        sourceComponent: ShotGraph {
            profile: complete.graphProfile
        }
    }

    // ---- before the purge
    Item {
        anchors.fill: parent
        visible: !complete.showPlot

        RemoveCupAnimation {
            x: 230 - width
            y: complete.headerTop + 10 + (230 - height) / 2
        }

        // ModularRight: WeightContainer (padding 4 / 7, gap 3) and the state label, centered
        readonly property real rightHeight: weightBox.height + (complete.stateLabel.length ? 15 : 0)
        Item {
            id: weightBox
            x: 250
            y: complete.headerTop + 10 + (230 - parent.rightHeight) / 2
            width: 220
            height: 4 + (complete.scaleConnected ? 60 : 15) + 7
            Text {
                id: weightValue
                visible: complete.scaleConnected
                y: 4
                height: 60
                verticalAlignment: Text.AlignVCenter
                text: complete.weight
                color: "white"
                font.family: Theme.fontMono
                font.pixelSize: 60
                font.letterSpacing: -1.2
            }
            Text {
                visible: complete.scaleConnected
                x: weightValue.implicitWidth + 3
                y: 4
                height: 30
                verticalAlignment: Text.AlignVCenter
                text: "g"
                color: "#99e7e7e7"
                font.family: Theme.fontRegular
                font.pixelSize: 25
                font.letterSpacing: -0.25
            }
            Text {
                visible: !complete.scaleConnected
                y: 4
                height: 15
                verticalAlignment: Text.AlignVCenter
                text: "Scale not connected"
                color: "#f44336"
                font.family: Theme.fontRegular
                font.weight: Font.Light
                font.pixelSize: 15
                font.letterSpacing: 3
                font.capitalization: Font.AllUppercase
            }
        }
        Text {
            visible: complete.stateLabel.length > 0
            x: 250
            y: weightBox.y + weightBox.height
            height: 15
            verticalAlignment: Text.AlignVCenter
            text: complete.stateLabel
            color: "#99e7e7e7"
            font.family: Theme.fontRegular
            font.weight: Font.Light
            font.pixelSize: 15
            font.letterSpacing: 3
            font.capitalization: Font.AllUppercase
        }

        // ModularFooter: "Brew time" and the time (Mono 40 px light), 13 px apart
        Text {
            x: 30
            y: complete.headerTop + 250 + 10
            width: 420
            height: 15
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            text: "Brew time"
            color: "#99e7e7e7"
            font.family: Theme.fontRegular
            font.weight: Font.Light
            font.pixelSize: 15
            font.letterSpacing: 3
            font.capitalization: Font.AllUppercase
        }
        Text {
            x: 30
            y: complete.headerTop + 250 + 10 + 15 + 13
            width: 420
            height: 40
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            text: Logic.formatTime(complete.brewTime / 1000)
            color: "white"
            font.family: Theme.fontMono
            font.weight: Font.Light
            font.pixelSize: 40
            font.letterSpacing: -0.8
        }
    }
}
