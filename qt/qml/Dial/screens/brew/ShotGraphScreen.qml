// The last shot's graph (ShotGraphScreen in src/components/ShotGraph/ShotGraphScreen.tsx), "shot_history",
// opened from the quick settings' "Last shot": the selected profile's last shot. A push or a double click
// goes home; the idle timeout rests on the idle screen.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    readonly property var activeProfile: Profiles.localProfile
    onActiveProfileChanged: checkProfile()
    function checkProfile() {
        if (!activeProfile) {
            console.error("History was opened without a profile selected")
            Nav.setScreen("profileHome")
        }
    }
    function idleEffect() {
        if (!Idle.isIdle) return
        Nav.setScreen("idle")
        Nav.closeBubble()
    }
    Connections {
        target: Idle
        function onIsIdleChanged() { screen.idleEffect() }
    }
    Component.onCompleted: {
        checkProfile()
        idleEffect()
    }

    function goHome() {
        Nav.closeBubble()
        Nav.setScreen("profileHome")
    }
    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onDoubleClick: screen.goHome()
        onPressDown: screen.goHome()
    }

    ShotGraph {
        profile: screen.activeProfile
    }
}
