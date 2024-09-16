import { useEffect, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import './Checkerboard.css';

export const Checkerboard = () => {
  const numRows = 8;
  const numCols = 8;
  const squareSize = 60; // Each square is 60x60 pixels

  const [check, setCheck] = useState(false);
  const [running, setRunning] = useState(true);

  useHandleGestures(
    {
      pressDown() {
        setCheck(true);
      },
      pressUp() {
        setCheck(false);
      }
    },
    false
  );

  const display_test_time = parseInt(process.env.DISPLAY_TEST_TIME) || 0;

  useEffect(() => {
    if (display_test_time <= 0) return;

    const toggleValue = () => {
      setRunning((prevValue) => !prevValue);
    };

    const interval = setInterval(toggleValue, display_test_time * 1000);

    return () => clearInterval(interval);
  }, []);

  const checkerboard = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const isBlack = (row + col) % 2 === 0;
      checkerboard.push(
        <div
          key={`${row}-${col}`}
          className="square"
          style={{
            backgroundColor: isBlack ? 'black' : 'white',
            width: squareSize,
            height: squareSize
          }}
        />
      );
    }
  }

  return (
    <div className={check ? 'gray' : 'checkerboard'}>
      {!check && running && checkerboard}
    </div>
  );
};
