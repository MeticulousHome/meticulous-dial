import { addRightComplement, roundPrecision } from '../../utils';
import './gauge.css';

const radius = 237;
const strokeWidth = 3;
export const circumference = radius * 2 * Math.PI;
const transform = `rotate(90, ${radius}, ${radius})`;
const minDigits = 3;

export type Unit =
  | 'bar'
  | 'celcius'
  | 'gram'
  | 'sec'
  | 'ml'
  | 'min'
  | 'pwm'
  | 'percentage';

const unitNameMap: Record<Unit, string> = {
  bar: 'bar',
  celcius: '°C',
  gram: 'g',
  sec: 's',
  ml: 'ml/s',
  pwm: 'PWM',
  percentage: '%',
  min: 'min'
};

const unitClassNameMap: Record<Unit, string> = {
  bar: 'scale-pressure',
  celcius: 'scale-temp',
  gram: 'scale-weight-limit',
  sec: 'scale-time',
  ml: 'scale-flow',
  percentage: 'scale-percentile',
  min: 'scale-time',
  pwm: 'scale-pwm'
};

const formatValue = (value: number, precision: number) => {
  const fractional = precision > 0;
  const valueOnly = fractional
    ? addRightComplement(roundPrecision(value, precision).toString())
    : value.toString();
  const padded = valueOnly.padStart(minDigits + (fractional ? 1 : 0), '0');
  return { valueOnly, padded };
};

export const getDashArray = (
  value: number,
  maxValue: number,
  minValue?: number
) => {
  if (value >= 0) {
    if (maxValue === 0) {
      return `0 ${circumference}`;
    }
    const percentage = Math.min(value, maxValue) / maxValue;
    const marc = circumference * percentage;
    return `${marc} ${circumference}`;
  } else {
    const percentage =
      Math.abs(Math.max(value, minValue | 0)) / Math.abs(minValue);
    const marc = percentage * circumference;
    const space = circumference - marc;
    return `0 ${space} ${marc}`;
  }
};

interface GaugeProps {
  value: number;
  minValue?: number;
  maxValue: number;
  precision: number;
  unit: Unit;
}

export function Gauge({
  value,
  minValue,
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
          strokeDasharray={getDashArray(value, maxValue, minValue)}
          transform={transform}
        />
      </svg>
    </div>
  );
}
