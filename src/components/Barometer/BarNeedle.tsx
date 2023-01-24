import React from 'react';
import { BarNeedleWrapper } from './barometer.style';

interface IProps {
  barNeedleRotatePosition: number;
}

const BarNeedle: React.FC<IProps> = ({ barNeedleRotatePosition }) => {
  return (
    <BarNeedleWrapper transform={`rotate(${barNeedleRotatePosition}deg)`}>
      <svg
        width="210"
        height="18"
        viewBox="0 0 240 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M36.777 7H240V11H36.777C35.8675 15.008 32.2832 18 28 18C24.4663 18 21.4082 15.9634 19.9355 13H0V5H19.9355C21.4082 2.03656 24.4663 0 28 0C32.2832 0 35.8675 2.99202 36.777 7Z"
          fill="#F5C444"
        />
      </svg>
    </BarNeedleWrapper>
  );
};
export default BarNeedle;
