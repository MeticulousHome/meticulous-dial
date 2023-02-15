import './setting-numerical.css';
import { useReduxSelector } from '../store/store';
import { useEffect, useState } from 'react';
import { roundPrecision } from '../../utils';

const radius = 237;
const strokeWidth = 6;
const circumference = radius * 2 * Math.PI;
const transform = `rotate(116.5, ${radius}, ${radius})`;

interface Props {
  type: 'pressure' | 'temperature' | 'flow' | 'weight';
}

export function SettingNumerical({ type }: Props): JSX.Element {
  const gesture = useReduxSelector((state) => state.gesture);
  const [total, setTotal] = useState<number>(0);
  const [interval, setInterval] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(0);
  const [unit, setUnit] = useState<string>('0');
  const [customClass, setCustomClass] = useState<string>('');

  useEffect(() => {
    let mTotal;
    switch (gesture.value) {
      case 'click':
        break;
      case 'doubleClick':
        break;
      case 'left':
      case 'right':
        if (
          (total === maxValue && gesture.value === 'right') ||
          (total === 0 && gesture.value === 'left')
        ) {
          return;
        }
        mTotal = total + (gesture.value === 'left' ? -interval : +interval);
        setTotal(type === 'weight' ? mTotal : roundPrecision(mTotal, 1));
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

  /* 
    Presión
    de 0-13 bar, incremento de 0.1, -> 00.0
    valor por defecto 8

    Temperatura
    de 20-99 c, incremento de 0.5, -> 00.0
    valor por defecto 85

    Peso límite de 0-150 g, incremento de 1, -> 000
    valor por defecto 36

    Flow de 0-8 ml/s, incremento de 0.1, -> 0.0
    valor por defecto 4

  */
  useEffect(() => {
    switch (type) {
      case 'pressure':
        setInterval(0.1);
        setTotal(8);
        setUnit('bar');
        setMaxValue(13);
        setCustomClass('scale-presion');
        break;
      case 'temperature':
        setInterval(0.5);
        setTotal(20);
        setUnit('°c');
        setMaxValue(99);
        setCustomClass('scale-temp');
        break;
      case 'weight':
        setInterval(1);
        setTotal(36);
        setUnit('g');
        setMaxValue(150);
        setCustomClass('scale-weight');
        break;
      case 'flow':
        setInterval(0.1);
        setTotal(4);
        setUnit('ml/s');
        setMaxValue(8);
        setCustomClass('scale-flow');
        break;
      default:
        break;
    }
  }, [type]);

  const getTotalString = () => {
    let toLayout: string = '';
    let withPads: string = '';
    switch (type) {
      case 'pressure':
      case 'temperature':
        toLayout = addRightComplement(roundPrecision(total, 1).toString());
        withPads = toLayout.padStart(4, '0');
        break;
      case 'flow':
        toLayout = addRightComplement(roundPrecision(total, 1).toString());
        withPads = toLayout;
        break;
      case 'weight':
        toLayout = total.toString();
        withPads = toLayout.padStart(3, '0');
        break;
      default:
        break;
    }

    if (/^0*$/.test(toLayout.replace('.', ''))) {
      return <text className="opacity-20">{withPads}</text>;
    }

    let pads: JSX.Element[] = [];
    withPads.split(toLayout).map((i: string) => {
      for (let y = 1; y <= i.length; y++) {
        pads.push(<span className="opacity-20">0</span>);
      }
    });

    pads.push(<>{toLayout}</>);
    return pads;
  };

  const addRightComplement = (value: string) => {
    if (!value.includes('.')) {
      value = value.concat('.0');
    }
    return value;
  };

  return (
    <div className="gauge-container">
      <div className="scalesLayout">
        {/* <div className="title-main-1">sub-title</div> */}
        <div className="main-title-selected title__Big">{type}</div>
        <div className={`scale-content ${customClass}`}>
          <div className="scale-level">{getTotalString()}</div>
          <div className="scale-unit">{unit}</div>
        </div>
      </div>
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
