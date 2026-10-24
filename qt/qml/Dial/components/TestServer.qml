// The test port (--test-port / DIAL_TEST_PORT), on 127.0.0.1 only: what the end-to-end tests read and do,
// as the Playwright driver of meticulous-integration reads the React DOM (tests/dial_app.py).
// One JSON object per message; each gets one JSON answer:
//   {cmd: "gesture", type, t}           a gesture straight into the Dial (Input)
//   {cmd: "button", type}               a backend "button" event (ENCODER_CLOCKWISE, ...)
//   {cmd: "state"}                      {screen, prev, bubble, bubbleComponent, transitioning, history}
//   {cmd: "texts"}                      every visible text of the route and the bubble over it
//   {cmd: "focused"}                    the focused menu entry (the topmost menu: bubble, then route)
//   {cmd: "probe", name}                a screen's own test property (dialProbe_<name>)
//   {cmd: "grab", path}                 the picture, saved as PNG
//   {cmd: "screen", name}               Nav.setScreen(name)
//   {cmd: "eval", js}                   any expression (debugging)
import QtQuick
import QtWebSockets
import Dial
import Dial.Native

WebSocketServer {
    id: server
    property Item root
    property Item router
    property Item bubble
    host: "127.0.0.1"
    port: Native.testPort
    listen: Native.testPort > 0

    Component.onCompleted: if (listen) console.log("test server on ws://127.0.0.1:" + port)

    function visibleIn(item) {
        let o = 1
        for (let i = item; i; i = i.parent) {
            if (!i.visible) return false
            o *= i.opacity
            if (o <= 0.001) return false
        }
        return true
    }
    function collectTexts(item, out) {
        if (!item || !item.visible || item.opacity <= 0.001) return
        if (item.hasOwnProperty("phase") && item.phase === "leave") return
        if (item instanceof Text && item.text && String(item.text).trim().length) {
            const p = item.mapToItem(root, 0, 0)
            if (p.x < 480 && p.y < 480 && p.x + item.width > 0 && p.y + item.height > 0) {
                let t = String(item.text)
                if (item.font.capitalization === Font.AllUppercase) t = t.toUpperCase()
                out.push(t)
            }
        }
        const kids = item.children
        for (let i = 0; i < kids.length; i++) collectTexts(kids[i], out)
    }
    function findFocused(item) {
        if (!item || !item.visible) return null
        if (item.hasOwnProperty("phase") && item.phase === "leave") return null
        const kids = item.children
        // Deepest first: a menu inside a screen wins over the screen's own value.
        for (let i = kids.length - 1; i >= 0; i--) {
            const f = findFocused(kids[i])
            if (f !== null) return f
        }
        if (item.hasOwnProperty("dialFocusedLabel") && item.dialFocusedLabel !== undefined && item.dialFocusedLabel !== null && item.dialFocusedLabel !== "")
            return String(item.dialFocusedLabel)
        return null
    }
    function findProbe(item, name) {
        if (!item) return undefined
        if (item.hasOwnProperty("phase") && item.phase === "leave") return undefined
        const key = "dialProbe_" + name
        if (item.hasOwnProperty(key)) return item[key]
        const kids = item.children
        for (let i = 0; i < kids.length; i++) {
            const v = findProbe(kids[i], name)
            if (v !== undefined) return v
        }
        return undefined
    }

    function handle(m, socket) {
        switch (m.cmd) {
        case "gesture":
            Input.emitGesture(m.type, m.t)
            return { ok: true }
        case "button":
            Input.handleButton({ type: m.type, time_since_last_event: m.t === undefined ? 300 : m.t })
            return { ok: true }
        case "state":
            return { screen: Nav.screen, prev: Nav.prev, bubble: Nav.bubbleVisible || bubble.shown,
                     bubbleVisible: Nav.bubbleVisible, bubbleComponent: bubble.shown ? bubble.component : "",
                     transitioning: router.transitioning, shown: router.currentScreen, history: Nav.history,
                     online: Device.isOnline, idle: Idle.isIdle }
        case "texts": {
            const out = []
            if (bubble.shown) collectTexts(bubble, out)
            collectTexts(router, out)
            return { texts: out }
        }
        case "focused": {
            let f = bubble.shown && Nav.bubbleVisible ? findFocused(bubble) : null
            if (f === null && router.current) f = findFocused(router.current)
            return { focused: f }
        }
        case "probe": {
            let v = bubble.shown ? findProbe(bubble, m.name) : undefined
            if (v === undefined && router.current) v = findProbe(router.current, m.name)
            return { value: v === undefined ? null : v }
        }
        case "grab":
            root.grabToImage(result => {
                result.saveToFile(m.path)
                socket.sendTextMessage(JSON.stringify({ id: m.id, saved: m.path }))
            })
            return null
        case "screen":
            Nav.setScreen(m.name)
            return { ok: true }
        case "eval":
            return { value: String(eval(m.js)) }
        case "mark":
            console.log("[dial-mark]", m.name, Date.now())
            return { ok: true }
        }
        return { error: "unknown command " + m.cmd }
    }

    onClientConnected: (socket) => {
        socket.onTextMessageReceived.connect((message) => {
            let m
            try { m = JSON.parse(message) } catch (e) { socket.sendTextMessage(JSON.stringify({ error: "bad json" })); return }
            let answer
            try { answer = server.handle(m, socket) } catch (e) { answer = { error: String(e) } }
            if (answer !== null) {
                answer.id = m.id
                socket.sendTextMessage(JSON.stringify(answer))
            }
        })
    }
}
