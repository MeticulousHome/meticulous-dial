// The boot prompt (src/components/ShotDataSharing/ShotDataSharingPrompt.tsx): shown after the boot
// animation while `shot_data_sharing` was never answered (ReadyAnimation's resolvePostReadyScreen).
// "Help improve" stores true and thanks for 4 s, "No thanks" stores false; both then go home. A failed
// save shows the error line and keeps the prompt.
import QtQuick
import Dial

Item {
    id: prompt
    anchors.fill: parent

    property int activeIndex: 0
    property bool showThanks: false
    // useUpdateSettings: isPending / isError of the last save.
    property bool busy: false
    property bool saveFailed: false
    property bool alive: true
    Component.onDestruction: alive = false

    function save(value, onSuccess) {
        busy = true
        saveFailed = false
        BackendSettings.update({ shot_data_sharing: value }).then(() => {
            if (!prompt.alive) return
            prompt.busy = false
            onSuccess()
        }).catch(() => {
            if (!prompt.alive) return
            prompt.busy = false
            prompt.saveFailed = true
        })
    }

    Timer {
        running: prompt.showThanks
        interval: view.thanksScreenDurationMs
        onTriggered: Nav.setScreen("profileHome")
    }

    GestureHandler {
        enabled: !(prompt.showThanks || Nav.bubbleInterceptsGesture)
        onTurnLeft: prompt.activeIndex = Math.max(prompt.activeIndex - 1, 0)
        onTurnRight: prompt.activeIndex = Math.min(prompt.activeIndex + 1, view.optInActions.length - 1)
        onPressDown: {
            if (prompt.busy) return
            if (view.optInActions[prompt.activeIndex].key === "help_improve")
                prompt.save(true, () => { prompt.showThanks = true })
            else
                prompt.save(false, () => Nav.setScreen("profileHome"))
        }
    }

    ShotDataSharingView {
        id: view
        title: prompt.showThanks ? thanksTitle : titleText
        copy: prompt.showThanks ? thanksCopy : optInCopy
        footnote: prompt.showThanks ? "" : laterNote
        actions: prompt.showThanks ? [] : optInActions
        activeIndex: prompt.activeIndex
        busy: prompt.busy
        error: !prompt.showThanks && prompt.saveFailed
    }
}
