// Snake (src/components/Snake/Snake.tsx), the quick settings' easter egg (twenty turns past "exit"): a 20 x 20
// grid of 24 px squares on #0A0A0A; the snake steps every 150 ms, the knob turns it (clockwise right, only
// the last turn between two steps counts, a turn into its own body is ignored), it wraps around the edges
// skipping the cells outside the round screen, grows on the apple (a red square under the Meticulous logo)
// and starts over when it bites itself. A double press goes home. The bottom status stays on.
//
// React draws on a canvas; here each square is a Rectangle (the snake and the apple change 6.7 times a
// second).
import QtQuick
import Dial

Item {
    id: game
    anchors.fill: parent

    property bool transitioning: false

    readonly property int gridSize: 20
    readonly property int gameSize: 480
    readonly property real squareSize: gameSize / gridSize

    readonly property var initialSnake: [{ x: 8, y: 8 }, { x: 8, y: 7 }, { x: 8, y: 6 }]
    readonly property var initialDirection: ({ x: 0, y: 1 })

    property var snake: initialSnake
    property var apple: getRandomPosition()
    // The direction the snake last moved in, and the turn the knob asked for since then.
    property var direction: initialDirection
    property int pendingTurn: 0

    // Rotates a direction 90 degrees: 1 is clockwise, -1 counterclockwise
    function turnDirection(d, turn) { return { x: -d.y * turn, y: d.x * turn } }

    function getRandomPosition() {
        const centerX = gridSize / 2, centerY = gridSize / 2
        const radius = (gridSize / 2) * 0.9
        let x, y
        do {
            // Generate random point within the grid, repeat if the point is outside the circle
            x = Math.random() * gridSize
            y = Math.random() * gridSize
        } while ((x - centerX) ** 2 + (y - centerY) ** 2 >= radius ** 2)
        return { x: Math.floor(x), y: Math.floor(y) }
    }

    function isOutsideCircle(xStart, yStart, xEnd, yEnd, centerX, centerY, radius) {
        let pointsOutside = 0
        const points = [{ x: xStart, y: yStart }, { x: xStart, y: yEnd }, { x: xEnd, y: yStart }, { x: xEnd, y: yEnd }]
        for (let i = 0; i < 4; i++)
            if ((points[i].x - centerX) ** 2 + (points[i].y - centerY) ** 2 > radius ** 2) pointsOutside++
        return pointsOutside >= 3
    }

    function moveSnake() {
        const prevSnake = snake
        // A snake has at minimum a head
        if (!prevSnake.length) { snake = initialSnake; return }

        let currentDirection = direction
        if (pendingTurn !== 0) {
            const turnedDirection = turnDirection(currentDirection, pendingTurn)
            pendingTurn = 0
            // Ignore the turn when it leads straight into the snake
            const turnedHead = { x: prevSnake[0].x + turnedDirection.x, y: prevSnake[0].y + turnedDirection.y }
            if (!prevSnake.some(s => s.x === turnedHead.x && s.y === turnedHead.y)) currentDirection = turnedDirection
        }
        direction = currentDirection

        let newHead = { x: prevSnake[0].x, y: prevSnake[0].y }
        do {
            newHead = { x: newHead.x + currentDirection.x, y: newHead.y + currentDirection.y }
            // Wrap snake position on border collision
            if (newHead.x >= gridSize) newHead.x = 0
            if (newHead.y >= gridSize) newHead.y = 0
            if (newHead.x < 0) newHead.x = gridSize - 1
            if (newHead.y < 0) newHead.y = gridSize - 1
        } while (isOutsideCircle(newHead.x, newHead.y, newHead.x + 1, newHead.y + 1, gridSize / 2, gridSize / 2, gridSize / 2))

        const newSnake = [newHead].concat(prevSnake)
        // Check for apple collision
        if (newHead.x === apple.x && newHead.y === apple.y) apple = getRandomPosition()
        else newSnake.pop()

        // Check for collision with itself
        if (newSnake.slice(1).some(s => s.x === newHead.x && s.y === newHead.y)) {
            // FIXME display game over
            direction = initialDirection
            snake = initialSnake // Reset snake
            return
        }
        snake = newSnake
    }

    function handleTurn(clockwise) { pendingTurn = clockwise ? 1 : -1 }

    GestureHandler {
        onTurnLeft: game.handleTurn(false)
        onTurnRight: game.handleTurn(true)
        onDoubleClick: {
            Nav.closeBubble()
            Nav.setScreen("profileHome")
        }
    }

    Timer {
        interval: 150
        repeat: true
        running: true
        onTriggered: game.moveSnake()
    }

    // The canvas: 480 x 480, #0A0A0A (the boundary circle is filled with the same color).
    Rectangle {
        width: game.gameSize
        height: game.gameSize
        color: "#0A0A0A"
    }

    // Snake: the head yellow, the body around the hue circle from 190.
    Repeater {
        model: game.snake.length
        Rectangle {
            readonly property var segment: game.snake[index]
            x: segment ? segment.x * game.squareSize : 0
            y: segment ? segment.y * game.squareSize : 0
            width: game.squareSize
            height: game.squareSize
            color: index === 0 ? "yellow"
                 : Qt.hsla(((190 + (360 * (index - 1)) / Math.max(game.snake.length - 1, 5)) % 360) / 360, 0.9, 0.45, 1)
        }
    }

    // Apple: a red square with the logo over it.
    Rectangle {
        x: game.apple.x * game.squareSize
        y: game.apple.y * game.squareSize
        width: game.squareSize
        height: game.squareSize
        color: "red"
        Image {
            anchors.fill: parent
            sourceSize: Qt.size(game.squareSize, game.squareSize)
            source: Theme.publicImage("logo.png")
            smooth: true
            mipmap: true
        }
    }

    readonly property var dialProbe_snake: snake.map(s => [s.x, s.y])
    readonly property var dialProbe_apple: [apple.x, apple.y]
}
