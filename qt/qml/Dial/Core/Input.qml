pragma Singleton
// The knob and the buttons: the backend's socket.io "button" events become the React Dial's gestures
// (SocketProviderValue.tsx eventGestureMap), broadcast to every GestureHandler. The test server and the
// keyboard (development) feed the same path.
import QtQuick

QtObject {
    id: input

    // gesture: right | left | click | doubleClick | longEncoder | singleTare | doubleTare | longTare |
    //          tareDown | tareUp | context | pressDown | pressUp
    signal gesture(string type, int timeSinceLastEvent)

    readonly property var eventGestureMap: ({
        ENCODER_CLOCKWISE: "right",
        ENCODER_COUNTERCLOCKWISE: "left",
        ENCODER_PUSH: "click",
        ENCODER_DOUBLE: "doubleClick",
        ENCODER_LONG: "longEncoder",
        TARE: "singleTare",
        TARE_DOUBLE: "doubleTare",
        TARE_LONG: "longTare",
        TARE_PRESSED: "tareDown",
        TARE_RELEASED: "tareUp",
        CONTEXT: "context",
        ENCODER_PRESSED: "pressDown",
        ENCODER_RELEASED: "pressUp"
    })
    readonly property var resetsIdle: ["right", "left", "pressDown", "context", "singleTare"]

    // A "button" event from the backend: { type, time_since_last_event }.
    function handleButton(data) {
        if (!data) return
        const g = eventGestureMap[data.type]
        if (!g) return
        if (resetsIdle.indexOf(g) >= 0) Idle.resetTimer()
        gesture(g, data.time_since_last_event === undefined ? 1000 : data.time_since_last_event)
    }

    function emitGesture(type, timeSinceLastEvent) {
        gesture(type, timeSinceLastEvent === undefined ? 1000 : timeSinceLastEvent)
    }
}
