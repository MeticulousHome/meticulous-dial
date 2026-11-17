// The heating timeout after a shot (src/components/HeatTimeoutAfterShot): a gauge of 0..10 minutes in
// steps of 1, from the heating_timeout setting (10 while unknown); a push saves it and goes home with the
// brew settings menu open in the bubble. Like the React screen it dims the backlight when the idle timer
// fires and lights it again on wake (useDimScreen).
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    readonly property int maxTimeout: 10
    readonly property int interval: 1
    // useSyncedState(globalSettings?.heating_timeout || MAX_TIMEOUT): read once.
    property int localHeatingTimeout: (BackendSettings.data && BackendSettings.data.heating_timeout) || maxTimeout
    Component.onCompleted: localHeatingTimeout = localHeatingTimeout

    readonly property int dialProbe_heatingTimeout: localHeatingTimeout

    // useDimScreen: only changes after mounting.
    Connections {
        target: Idle
        function onIsIdleChanged() { Api.setBrightness({ brightness: Idle.isIdle ? 0 : 1 }) }
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.localHeatingTimeout = Math.max(screen.localHeatingTimeout - screen.interval, 0)
        onTurnRight: screen.localHeatingTimeout = Math.min(screen.localHeatingTimeout + screen.interval, screen.maxTimeout)
        onPressDown: {
            BackendSettings.update({ heating_timeout: screen.localHeatingTimeout }).catch(() => {})
            Nav.setScreen("profileHome")
            Nav.setBubbleDisplay({ visible: true, component: "brewSettings" })
        }
    }

    Gauge {
        value: screen.localHeatingTimeout
        maxValue: screen.maxTimeout
        precision: 0
        unit: "min"
    }
    NavTitle {
        position: "bottom"
        spec: "Time"
    }
}
