import React, { useState, useEffect, useRef, useCallback } from 'react';

const gridSize = 20;
const gameSize = 480;
const canvasSize = gameSize;
const squareSize = gameSize / gridSize;

interface Point {
  x: number;
  y: number;
}

const initialSnake: Point[] = [
  { x: 8, y: 8 },
  { x: 8, y: 7 },
  { x: 8, y: 6 }
];
const initialDirection: Point = { x: 0, y: 1 };

const getRandomPosition = (): Point => {
  const centerX = gridSize / 2;
  const centerY = gridSize / 2;
  const radius = (gridSize / 2) * 0.9;

  let x: number, y: number;
  do {
    // Generate random point within the grid
    x = Math.random() * gridSize;
    y = Math.random() * gridSize;
    //repeat if the point is outside the circle
  } while ((x - centerX) ** 2 + (y - centerY) ** 2 >= radius ** 2);

  return { x: Math.floor(x), y: Math.floor(y) };
};

const isOutsideCircle = (
  x_start: number,
  y_start: number,
  x_end: number,
  y_end: number,
  centerX: number,
  centerY: number,
  radius: number
): boolean => {
  let pointsOutside = 0;
  const points = [
    { x: x_start, y: y_start },
    { x: x_start, y: y_end },
    { x: x_end, y: y_start },
    { x: x_end, y: y_end }
  ];

  points.forEach((point) => {
    if ((point.x - centerX) ** 2 + (point.y - centerY) ** 2 > radius ** 2) {
      pointsOutside++;
    }
  });
  return pointsOutside >= 3;
};

const APPLE_IMAGE =
  'https://meticuloushome.com/wp-content/uploads/2022/12/logo-meticulous-01.png';

export const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Point[]>(initialSnake);
  const [apple, setApple] = useState<Point>(getRandomPosition);
  const [directionQueue, setDirectionQueue] = useState<Point[]>([
    initialDirection
  ]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appleImageRef = useRef(new Image());

  useEffect(() => {
    const appleImage = appleImageRef.current;
    appleImage.src = APPLE_IMAGE;
    // appleImage.onload = () => {};
  }, []);

  const moveSnake = useCallback(() => {
    setSnake((prevSnake) => {
      // A snake has at minimum a head
      if (!prevSnake.length) return initialSnake;

      let currentDirection = directionQueue[0] || initialDirection;

      // Pop the next direction from the queue, leaving always at least one
      if (directionQueue.length > 1) {
        currentDirection = directionQueue[1];
        setDirectionQueue((prevQueue) => prevQueue.slice(1));
      }
      let newHead: Point = {
        x: prevSnake[0].x,
        y: prevSnake[0].y
      };

      do {
        newHead = {
          x: newHead.x + currentDirection.x,
          y: newHead.y + currentDirection.y
        };

        // Wrap snake position on border collision
        if (newHead.x >= gridSize) newHead.x = 0;
        if (newHead.y >= gridSize) newHead.y = 0;
        if (newHead.x < 0) newHead.x = gridSize - 1;
        if (newHead.y < 0) newHead.y = gridSize - 1;
      } while (
        isOutsideCircle(
          newHead.x * 1,
          newHead.y * 1,
          newHead.x * 1 + 1,
          newHead.y * 1 + 1,
          gridSize / 2,
          gridSize / 2,
          gridSize / 2
        )
      );

      const newSnake = [newHead, ...prevSnake];

      // Check for apple collision
      if (newHead.x === apple.x && newHead.y === apple.y) {
        setApple(getRandomPosition);
      } else {
        newSnake.pop();
      }

      // Check for collision with itself
      if (
        newSnake
          .slice(1)
          .some((segment) => segment.x === newHead.x && segment.y === newHead.y)
      ) {
        alert('Game Over');
        return initialSnake; // Reset snake
      }

      return newSnake;
    });
  }, [directionQueue, apple]);

  const handleDirectionChange = (newDirection: Point) => {
    // Check if the new direction is valid
    const isValidDirection = () => {
      if (
        directionQueue.length &&
        ((newDirection.x === -directionQueue[directionQueue.length - 1].x &&
          newDirection.y === -directionQueue[directionQueue.length - 1].y) || // Opposite direction
          (newDirection.x === directionQueue[directionQueue.length - 1].x &&
            newDirection.y === directionQueue[directionQueue.length - 1].y)) // Same direction
      ) {
        return false;
      }
      if (directionQueue.length == 1) {
        // Check if the new direction leads to collision with the snake
        const head = snake[0];
        const newHead = {
          x: head.x + newDirection.x,
          y: head.y + newDirection.y
        };
        return !snake.some(
          (segment) => segment.x === newHead.x && segment.y === newHead.y
        );
      }
      return true;
    };

    if (isValidDirection()) {
      // Enqueue the new direction
      setDirectionQueue((prevQueue) => [...prevQueue, newDirection]);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    let turnClockwise = 1;
    switch (e.key) {
      case 'ArrowUp':
        handleDirectionChange({ x: 0, y: -1 });
        break;
      case 'ArrowRight':
        handleDirectionChange({ x: 1, y: 0 });
        break;
      case 'ArrowDown':
        handleDirectionChange({ x: 0, y: 1 });
        break;
      case 'ArrowLeft':
        handleDirectionChange({ x: -1, y: 0 });
        break;
      case 'a': // fallthrough
      case 'l': // counterclockwise
        turnClockwise = -1;
      // fallthrough
      case 'd': // fallthrough
      case 'r': {
        // clockwise
        if (!directionQueue || directionQueue.length == 0) return;

        const lastDirection = directionQueue[directionQueue.length - 1];

        if (lastDirection.x === 0 && lastDirection.y === -1) {
          // Up to Right
          handleDirectionChange({ x: turnClockwise, y: 0 });
        } else if (lastDirection.x === 1 && lastDirection.y === 0) {
          // Right to Down
          handleDirectionChange({ x: 0, y: turnClockwise });
        } else if (lastDirection.x === 0 && lastDirection.y === 1) {
          // Down to Left
          handleDirectionChange({ x: 0 - turnClockwise, y: 0 });
        } else if (lastDirection.x === -1 && lastDirection.y === 0) {
          // Left to Up
          handleDirectionChange({ x: 0, y: 0 - turnClockwise });
        }

        break;
      }
      default:
        break;
    }
  };

  const drawSquareGame = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      const centerX = gameSize / 2;
      const centerY = gameSize / 2;

      ctx.fillStyle = 'hotpink';
      ctx.fillRect(0, 0, gameSize, gameSize);

      // Draw the boundary circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, gameSize / 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#0A0A0A';
      ctx.fill();

      // Draw snake
      snake.forEach((segment, index) => {
        const xpos = segment.x * squareSize;
        const ypos = segment.y * squareSize;
        // Head is yellow
        const hue =
          (190 + (360 * (index - 1)) / Math.max(snake.length - 1, 5)) % 360;

        if (index === 0) {
          ctx.fillStyle = 'yellow';
        } else {
          ctx.fillStyle = `hsl(${hue}, 90%, 45%)`;
        }
        ctx.fillRect(xpos, ypos, squareSize, squareSize);
      });

      // Draw apple
      ctx.fillStyle = 'red';
      ctx.fillRect(
        apple.x * squareSize,
        apple.y * squareSize,
        squareSize,
        squareSize
      );

      if (appleImageRef.current && appleImageRef.current.complete) {
        ctx.drawImage(
          appleImageRef.current,
          apple.x * squareSize,
          apple.y * squareSize,
          squareSize,
          squareSize
        );
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(moveSnake, 150);
    return () => clearInterval(interval);
  }, [moveSnake]);

  useEffect(() => {
    drawSquareGame();
  }, [snake, apple]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      onKeyDown={handleKey}
      tabIndex={0}
    ></canvas>
  );
};
