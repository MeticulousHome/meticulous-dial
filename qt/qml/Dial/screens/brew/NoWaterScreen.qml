// The machine stopped heating because the chamber has no water (the "Pour water and click to continue"
// stage): a full screen to read from across the kitchen, with no title and a red ring that pulses on the
// edge of the display. The drops are lottie/brew-no-water.json (screens/brew/tools/make_no_water_drops.py).
//
// The stage belongs to the firmware: a push reaches it through the machine's own button and heating goes
// on, so this screen sends nothing on a click. A "continue" here could land once heating is back, where it
// starts the shot at once (the heating screen's BREW NOW). A double push aborts, as on the heating screen.
import QtQuick
import Dial
import Dial.Native
import "BrewLogic.js" as Logic

Item {
    id: screen
    anchors.fill: parent

    // The socket "action" events this screen sent (a test probe).
    property var sentActions: []
    readonly property var dialProbe_sent: sentActions
    // The alert sounds asked of the backend (a test probe).
    property var alertSounds: []
    readonly property var dialProbe_alertSounds: alertSounds
    readonly property bool dialProbe_dropsPlaying: drops.playing

    // Back home once the machine is idle again (no notification waiting, not just starting).
    Connections {
        target: Stats
        function onNameChanged() { screen.idleEffect() }
    }
    Connections {
        target: Profiles
        function onProfileStartingChanged() { screen.idleEffect() }
    }
    function idleEffect() {
        if (Stats.name === "idle" && !Notifications.hasNotifications && !Profiles.profileStarting) Nav.setScreen("profileHome")
    }
    Component.onCompleted: {
        idleEffect()
        playAlertSound()
    }

    // The backend plays the sound, and stays silent if the user turned sounds off. It has no error sound, so
    // the alert uses "notification".
    function playAlertSound() {
        alertSounds = alertSounds.concat(["notification"])
        Api.playSound("notification").catch(e => console.warn("No alert sound", e && e.message))
    }

    function brewDoubleClick() {
        const decision = Logic.decideDoubleClick({ name: Stats.name, extracting: Stats.extracting }, { allowFinish: false })
        console.log("doubleClick decision", JSON.stringify({ screen: Nav.screen, decision: decision, name: Stats.name, extracting: Stats.extracting }))
        if (!decision) return
        sentActions = sentActions.concat([decision])
        Backend.action(decision)
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onDoubleClick: screen.brewDoubleClick()
    }

    Rectangle {
        anchors.fill: parent
        anchors.margins: 3
        radius: width / 2
        color: "transparent"
        border.width: 9
        border.color: Theme.error
        SequentialAnimation on opacity {
            running: screen.visible
            loops: Animation.Infinite
            NumberAnimation { from: 0.25; to: 1; duration: 900; easing.type: Easing.InOutSine }
            NumberAnimation { from: 1; to: 0.25; duration: 900; easing.type: Easing.InOutSine }
        }
    }

    LottieItem {
        id: drops
        x: 80
        y: 34
        width: 320
        height: 240
        source: Theme.asset("lottie/brew-no-water.json")
        loops: -1
        playing: screen.visible
    }

    Text {
        x: 30
        y: 274
        width: 420
        height: 64
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "No water"
        color: Theme.white
        font.family: Theme.fontRegular
        font.pixelSize: 58
        font.letterSpacing: 5
        font.capitalization: Font.AllUppercase
    }
    Text {
        x: 30
        y: 346
        width: 420
        height: 28
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "Pour water"
        color: Theme.dataBlueLight
        font.family: Theme.fontRegular
        font.pixelSize: 24
        font.letterSpacing: 4
        font.capitalization: Font.AllUppercase
    }
    Text {
        x: 30
        y: 384
        width: 420
        height: 24
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "Tap to retry"
        color: Theme.gray10
        font.family: Theme.fontRegular
        font.pixelSize: 20
        font.letterSpacing: 4
        font.capitalization: Font.AllUppercase
    }
}
