// Menu > Help us improve (src/components/ShotDataSharing/HelpUsImprove.tsx): a full screen route opened
// from the quick settings. Not sharing: "Help improve" / "No thanks"; sharing: "Stop sharing" / "Back".
// A saved choice shows Thanks! or Sharing stopped for 4 s; that, "No thanks" and "Back" return to the
// screen under the menu with the quick settings open again.
import QtQuick
import Dial

Item {
    id: help
    anchors.fill: parent

    property int activeIndex: 0
    // Confirmation shown after a choice before returning to the menu: "thanks" | "stopped" | "".
    property string outcome: ""
    property bool busy: false
    property bool saveFailed: false
    property bool alive: true
    // The screen under the menu when this route was opened.
    property string returnScreen: ""
    Component.onCompleted: returnScreen = Nav.prev || "profileHome"
    Component.onDestruction: alive = false

    readonly property bool sharing: BackendSettings.value("shot_data_sharing", null) === true
    readonly property var actions: sharing ? view.optOutActions : view.optInActions
    onActionsChanged: activeIndex = Math.min(activeIndex, actions.length - 1)

    function goBack() {
        Nav.setScreen(returnScreen)
        Nav.setBubbleDisplay({ visible: true, component: "quick-settings" })
    }

    function save(value, nextOutcome) {
        busy = true
        saveFailed = false
        BackendSettings.update({ shot_data_sharing: value }).then(() => {
            if (!help.alive) return
            help.busy = false
            help.outcome = nextOutcome
        }).catch(() => {
            if (!help.alive) return
            help.busy = false
            help.saveFailed = true
        })
    }

    Timer {
        running: help.outcome !== ""
        interval: view.thanksScreenDurationMs
        onTriggered: help.goBack()
    }

    GestureHandler {
        enabled: !(help.outcome !== "" || Nav.bubbleInterceptsGesture)
        onTurnLeft: help.activeIndex = Math.max(help.activeIndex - 1, 0)
        onTurnRight: help.activeIndex = Math.min(help.activeIndex + 1, help.actions.length - 1)
        onPressDown: {
            if (help.busy) return
            switch (help.actions[help.activeIndex].key) {
            case "help_improve":
                help.save(true, "thanks")
                break
            case "stop_sharing":
                help.save(false, "stopped")
                break
            default:
                help.goBack()
                break
            }
        }
    }

    ShotDataSharingView {
        id: view
        title: help.outcome === "thanks" ? thanksTitle : help.outcome === "stopped" ? stoppedTitle : titleText
        copy: help.outcome === "thanks" ? thanksCopy : help.outcome === "stopped" ? stoppedCopy
              : help.sharing ? sharingCopy : optInCopy
        actions: help.outcome !== "" ? [] : help.actions
        activeIndex: help.activeIndex
        busy: help.busy
        error: help.outcome === "" && help.saveFailed
    }
}
