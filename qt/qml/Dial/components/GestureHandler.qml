// useHandleGestures(handlers, shouldIgnoreGesture): put one in a screen and handle the gestures as signals,
//   GestureHandler { enabled: !Nav.bubbleInterceptsGesture; onTurnRight: ...; onPressDown: ... }
// The React gestures "right" and "left" are turnRight and turnLeft here (Item already has right / left).
// It hears gestures only while it is enabled, and Item.enabled is inherited: the route a screen lives in
// is disabled while it leaves (the React VisibilityContext), so a leaving screen hears nothing.
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

    Connections {
        target: Input
        enabled: handler.enabled
        function onGesture(type, timeSinceLastEvent) {
            const emit = handler[type === "right" ? "turnRight" : type === "left" ? "turnLeft" : type]
            if (typeof emit === "function") emit(timeSinceLastEvent)
        }
    }
}
