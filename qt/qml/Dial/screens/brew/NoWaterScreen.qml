// The machine stopped heating because the chamber has no water (the "Pour water and click to continue"
// stage): a full screen to read from across the kitchen, with no title and a thin red ring that pulses on
// the edge of the display. The drop is made of dots, as the heating screen's bubbles, and drains to grey as
// they do without water: lottie/brew-no-water.json (screens/brew/tools/make_no_water_drops.py).
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

    // The alert: a thin ring on the edge of the display that pulses.
    Arc {
        anchors.centerIn: parent
        radius: 232
        lineWidth: 6
        color: Theme.error
        SequentialAnimation on opacity {
            running: screen.visible
            loops: Animation.Infinite
            NumberAnimation { from: 0.2; to: 1; duration: 900; easing.type: Easing.InOutSine }
            NumberAnimation { from: 1; to: 0.2; duration: 900; easing.type: Easing.InOutSine }
        }
    }

    LottieItem {
        id: drops
        x: 132
        y: 26
        width: 216
        height: 240
        source: Theme.asset("lottie/brew-no-water.json")
        loops: -1
        playing: screen.visible
    }

    Text {
        x: 30
        y: 272
        width: 420
        height: 56
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "No water"
        color: Theme.white
        font.family: Theme.fontRegular
        font.weight: Font.Light
        font.pixelSize: 56
        font.letterSpacing: 7
        font.capitalization: Font.AllUppercase
    }
    // The label style of the brew screens (15 px, 3 px spacing), larger to read from a distance.
    Text {
        x: 30
        y: 342
        width: 420
        height: 22
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "Pour water"
        color: Theme.dataBlueLight
        font.family: Theme.fontRegular
        font.pixelSize: 22
        font.letterSpacing: 4.4
        font.capitalization: Font.AllUppercase
    }
    // As "Push to brew" on the heating screen: 20 px, 4 px spacing, its bottom 60 px from the end.
    Text {
        x: 30
        y: 400
        width: 420
        height: 20
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "Push to retry"
        color: Theme.gray10
        font.family: Theme.fontRegular
        font.pixelSize: 20
        font.letterSpacing: 4
        font.capitalization: Font.AllUppercase
    }
}
