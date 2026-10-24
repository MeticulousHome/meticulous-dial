// The DVD sleep screen (src/components/IdleScreen/DVD.tsx): the Meticulous and BQ logos (60 x 60 on a
// colored square) bounce inside the #111 circle; every bounce picks a new color from the palette.
//
// React moves each logo 1 px per animation frame and checks its corners against the circle on every
// frame. Here each straight run is one linear x / y animation (no per-frame JavaScript): the time until a
// corner reaches the circle is solved when the run starts, at 60 px/s (1 px per 60 Hz frame). At the end
// of the run the direction changes with React's reflection formula, including its random +-5 degrees.
// React's overlap check between the two logos (DVDIdleScreen's `collision`) changes nothing on screen
// and is not ported.
import QtQuick
import Dial

Item {
    id: dvd
    width: 480
    height: 480

    readonly property real flowHeight: 480
    readonly property real logoSize: 60
    readonly property real speed: 60          // px per second: ANIMATION_SPEED 1 px per frame at 60 Hz

    readonly property var palette: [
        "#FF0716", "#52c757", "#d6e97d", "#6613f0", "#b1dd52", "#ab87a4", "#095ff0", "#155e35", "#4d3d04",
        "#f62ebf", "#a760ff", "#a0ab3a", "#dade1f", "#d885cf", "#60e7d6", "#948a6b", "#f4e819", "#8d37fd",
        "#3d250e", "#5d336f", "#d48281", "#0ffd91", "#38460c", "#0aab95", "#59be2c", "#639697", "#93f1cc",
        "#8fdfbb", "#ebf841", "#70e478"
    ]
    // prevColorChoiceIndex (module level in React: shared by both logos)
    property int prevColorChoiceIndex: 0

    function getNewRandomColor() {
        const currentPalette = palette.slice()
        currentPalette.splice(prevColorChoiceIndex, 1)
        const colorChoiceIndex = Math.floor(Math.random() * currentPalette.length)
        prevColorChoiceIndex = colorChoiceIndex < prevColorChoiceIndex ? colorChoiceIndex : colorChoiceIndex + 1
        return currentPalette[colorChoiceIndex]
    }

    // Container: 480 x 480, #111, round.
    Rectangle {
        anchors.fill: parent
        radius: 240
        color: "#111111"
        antialiasing: true
    }

    component BouncyLogo: Rectangle {
        id: logo
        property url imageSource
        // direction (unit vector)
        property real dirX: 0
        property real dirY: 0
        property int bounces: 0
        width: dvd.logoSize
        height: dvd.logoSize
        color: "red"

        Image {
            anchors.fill: parent
            sourceSize: Qt.size(dvd.logoSize, dvd.logoSize)
            source: logo.imageSource
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
        }

        // The time (in px of travel) until the first corner leaves the circle.
        function travelToCircle() {
            let best = Infinity
            const corners = [[0, 0], [0, dvd.logoSize], [dvd.logoSize, 0], [dvd.logoSize, dvd.logoSize]]
            let corner = corners[0]
            for (let i = 0; i < 4; i++) {
                const qx = x + corners[i][0] - 240, qy = y + corners[i][1] - 240
                const b = qx * dirX + qy * dirY
                const c = qx * qx + qy * qy - 240 * 240
                const disc = b * b - c
                const t = disc < 0 ? 0 : -b + Math.sqrt(disc)
                if (t < best) { best = t; corner = corners[i] }
            }
            return { t: Math.max(0, best), corner: { x: x + corner[0] + dirX * best, y: y + corner[1] + dirY * best } }
        }

        // DVD.tsx: the reflection off the offending corner, with a random offset of up to 5 degrees.
        function reflect(offendingCorner) {
            const ax = offendingCorner.x - 240, ay = offendingCorner.y - 240
            const alpha = Math.atan2(ay, ax) + (ax > 0 ? 0 : Math.PI)
            const beta = Math.atan2(dirY, dirX) + (ax > 0 ? 0 : Math.PI)
            const dAngle = beta - alpha
            const tau = beta + dAngle
            const reflectedAngle = tau + Math.PI
            const exitAngle = reflectedAngle + Math.random() * (dAngle < 0 ? -0.087 : 0.087)
            dirX = Math.cos(exitAngle)
            dirY = Math.sin(exitAngle)
            color = dvd.getNewRandomColor()
            bounces++
        }

        function run() {
            let hit = travelToCircle()
            // A direction that still leaves the circle within a frame bounces again, as React does on the
            // following frames (each bounce a new color).
            for (let i = 0; i < 12 && hit.t < 1; i++) {
                reflect(hit.corner)
                hit = travelToCircle()
            }
            if (hit.t < 1) {
                // Never seen; head for the center rather than stop.
                const cx = 240 - dvd.logoSize / 2 - x, cy = 240 - dvd.logoSize / 2 - y
                const n = Math.max(1e-6, Math.hypot(cx, cy))
                dirX = cx / n
                dirY = cy / n
                hit = travelToCircle()
            }
            moveX.from = x
            moveX.to = x + dirX * hit.t
            moveY.from = y
            moveY.to = y + dirY * hit.t
            move.pendingCorner = hit.corner
            move.duration = hit.t / dvd.speed * 1000
            move.restart()
        }

        ParallelAnimation {
            id: move
            property var pendingCorner: null
            property int duration: 1000
            NumberAnimation { id: moveX; target: logo; property: "x"; duration: move.duration }
            NumberAnimation { id: moveY; target: logo; property: "y"; duration: move.duration }
            onFinished: {
                logo.reflect(move.pendingCorner)
                logo.run()
            }
        }

        function start() {
            x = 100 + Math.random() * 100
            y = 100 + Math.random() * 100
            const speedAngle = Math.random() * 2 * Math.PI
            dirX = Math.cos(speedAngle)
            dirY = Math.sin(speedAngle)
            run()
        }
    }

    BouncyLogo { id: met; imageSource: Theme.publicImage("logo.png") }
    BouncyLogo { id: bq; imageSource: Theme.publicImage("BQLogo.png") }

    Component.onCompleted: {
        met.start()
        bq.start()
    }

    // For the tests: each logo's position and how far its farthest corner is from the center.
    function positions() {
        return [met, bq].map(l => {
            let far = 0
            for (const c of [[0, 0], [0, logoSize], [logoSize, 0], [logoSize, logoSize]])
                far = Math.max(far, Math.hypot(l.x + c[0] - 240, l.y + c[1] - 240))
            return { x: l.x, y: l.y, farthestCorner: far }
        })
    }
    // For the tests (they change on a bounce only, not on every frame).
    readonly property int dialProbe_dvdBounces: met.bounces + bq.bounces
    readonly property var dialProbe_dvdColors: [String(met.color), String(bq.color)]
}
