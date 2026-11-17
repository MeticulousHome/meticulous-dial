// useHandleGestures(handlers, shouldIgnoreGesture): put one in a screen and handle the gestures as signals,
//   GestureHandler { enabled: !Nav.bubbleInterceptsGesture; onTurnRight: ...; onPressDown: ... }
// The React gestures "right" and "left" are turnRight and turnLeft here (Item already has right / left).
// It hears gestures only while it is enabled, and Item.enabled is inherited: the route a screen lives in
// is disabled while it leaves (the React VisibilityContext), so a leaving screen hears nothing.
// React subscribes a handler after the render a gesture caused, so one that comes on during a gesture (the
// bubble closed by that press, a screen it opened) hears the next gesture, not that one: otherwise the press
// that picks "raise" in the quick settings also reached the home under it and filled its "Hold to start" ring.
import QtQuick
import Dial

Item {
    id: handler
    width: 0
    height: 0
    visible: false

    signal turnRight(int timeSinceLastEvent)
    signal turnLeft(int timeSinceLastEvent)
    signal click(int timeSinceLastEvent)
    signal doubleClick(int timeSinceLastEvent)
    signal longEncoder(int timeSinceLastEvent)
    signal singleTare(int timeSinceLastEvent)
    signal doubleTare(int timeSinceLastEvent)
    signal longTare(int timeSinceLastEvent)
    signal tareDown(int timeSinceLastEvent)
    signal tareUp(int timeSinceLastEvent)
    signal context(int timeSinceLastEvent)
    signal pressDown(int timeSinceLastEvent)
    signal pressUp(int timeSinceLastEvent)

    // Input.serial of the gesture during which the handler came on.
    property int enabledAt: -1
    Component.onCompleted: enabledAt = Input.serial
    onEnabledChanged: if (enabled) enabledAt = Input.serial

    Connections {
        target: Input
        enabled: handler.enabled
        function onGesture(type, timeSinceLastEvent) {
            if (handler.enabledAt === Input.serial) return
            const emit = handler[type === "right" ? "turnRight" : type === "left" ? "turnLeft" : type]
            if (typeof emit === "function") emit(timeSinceLastEvent)
        }
    }
}
