import { addRightComplement, roundPrecision } from '../../utils';
import './gauge.css';

const radius = 237;
const strokeWidth = 3;
export const circumference = radius * 2 * Math.PI;
const transform = `rotate(90, ${radius}, ${radius})`;
const minDigits = 3;

export type Unit = 'bar' | 'celcius' | 'gram' | 'sec';

const unitNameMap: Record<Unit, string> = {
  bar: 'bar',
  celcius: '°C',
  gram: 'g',
  sec: 's'
};

const unitClassNameMap: Record<Unit, string> = {
  bar: 'scale-pressure',
  celcius: 'scale-temp',
  gram: 'scale-weight-limit',
  sec: 'scale-time'
};

const formatValue = (value: number, precision: number) => {
  const fractional = precision > 0;
  const valueOnly = fractional
    ? addRightComplement(roundPrecision(value, precision).toString())
    : value.toString();
  const padded = valueOnly.padStart(minDigits + (fractional ? 1 : 0), '0');
  return { valueOnly, padded };
};

export const getDashArray = (value: number, maxValue: number) => {
  const mI = (360 / maxValue) * (Math.min(value, maxValue) / 100);
  const fA = mI * 100;
  const marc = circumference * (fA / 360);

  return `${marc} ${circumference}`;
};

interface GaugeProps {
  value: number;
  maxValue: number;
  precision: number;
  unit: Unit;
}

export function Gauge({
  value,
  maxValue,
  precision,
  unit
}: GaugeProps): JSX.Element {
  const { valueOnly, padded } = formatValue(value, precision);
  const padLength =
    padded.length - (/^[0.]+$/.test(valueOnly) ? 0 : valueOnly.length);

  return (
    <div className="gauge-container">
      <div className="scalesLayout">
        <div className={`scale-content ${unitClassNameMap[unit]}`}>
          <div className="scale-level">
            <span className="opacity-20">{padded.substring(0, padLength)}</span>
            {padded.substring(padLength)}
          </div>
          <div className="scale-unit">{unitNameMap[unit]}</div>
        </div>
      </div>
      <svg width="460" height="460" viewBox="-1 -2 480 480">
        <circle
          fill="transparent"
          cx={radius}
          cy={radius - 3}
          r={radius}
          stroke="#676767"
          strokeWidth={strokeWidth}
          strokeDasharray={getDashArray(maxValue, maxValue)}
          strokeLinecap="round"
          transform={transform}
        />
        <circle
          fill="transparent"
          cx={radius}
          cy={radius - 3}
          r={radius}
          stroke="#F5C444"
          strokeWidth={strokeWidth}
          strokeDasharray={getDashArray(value, maxValue)}
          transform={transform}
        />
      </svg>
    </div>
  );
}
