import './setting-numerical.css';
import { useReduxSelector } from '../store/store';
import { useEffect, useState } from 'react';

const radius = 237;
const strokeWidth = 6;
const circumference = radius * 2 * Math.PI;
const transform = `rotate(116.5, ${radius}, ${radius})`;

interface Props {
  maxValue: number;
  unit: string;
}

export function SettingNumerical({ maxValue, unit }: Props): JSX.Element {
  const gesture = useReduxSelector((state) => state.gesture);
  const [total, setTotal] = useState<number>(200);

  useEffect(() => {
    switch (gesture.value) {
      case 'click':
        break;
      case 'doubleClick':
        break;
      case 'left':
        setTotal(total === 0 ? 0 : total - 1);
        break;
      case 'right':
        setTotal(total === maxValue ? maxValue : total + 1);
        break;
      default:
        break;
    }
  }, [gesture]);

  const getDashArray = (value: number) => {
    const mI = (307.2 / maxValue) * (value / 100);
    const fA = mI * 100;
    const marc = circumference * (fA / 360);

    return `${marc} ${circumference}`;
  };

  return (
    <div className="gauge-container">
      <div className="gauge-caption">{total}</div>
      <div className="gauge-unit">{unit}</div>
      <svg width="480" height="480" viewBox="0 0 480 480">
        <circle
          fill="transparent"
          cx={radius}
          cy={radius - 3}
          r={radius}
          stroke="#272727"
          strokeWidth={strokeWidth}
          strokeDasharray={getDashArray(maxValue)}
          transform={transform}
        />
        <circle
          fill="transparent"
          cx={radius}
          cy={radius - 3}
          r={radius}
          stroke="white"
          strokeWidth={strokeWidth}
          strokeDasharray={getDashArray(total)}
          transform={transform}
        />
      </svg>
    </div>
  );
}
