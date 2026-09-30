import { TargetTick } from './TargetTick';
import { Trail } from './manualTarget';
import {
  ARC_END_ANGLE,
  ARC_RADIUS,
  ARC_SIZE,
  ARC_START_ANGLE,
  CIRCLE,
  CIRCLE_DEG,
  NEEDLE_LENGTH,
  STEP_EDGE_OFFSET,
  STEP_LENGTH,
  valueToAngleRad
} from './meterGeometry';

interface MeterProps {
  className?: string;
  min: number;
  max: number;
  value: number;
  step: number;
  target?: { value: number; trail: Trail | null; color: string };
}

export function Meter({
  min,
  max,
  value,
  step,
  className,
  target
}: MeterProps) {
  const range = max - min;
  const steps = range / step + 1;
  const needleAngle = valueToAngleRad(value, min, max);

  return (
    <div style={{ width: ARC_SIZE, height: ARC_SIZE }} className={className}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {new Array(steps).fill(null).map((_, i) => {
          const angle =
            ARC_START_ANGLE +
            (i / (steps - 1)) * (ARC_END_ANGLE - ARC_START_ANGLE);
          const x = Math.cos(angle);
          const y = Math.sin(angle);
          const start = ARC_RADIUS - STEP_EDGE_OFFSET;
          const end = start - STEP_LENGTH;
          return (
            <path
              key={i}
              d={`M${ARC_RADIUS + x * start} ${ARC_RADIUS + y * start} L${
                ARC_RADIUS + x * end
              } ${ARC_RADIUS + y * end}`}
              stroke="#4A4A4A"
              strokeWidth={1}
            />
          );
        })}
      </svg>
      <div
        style={{
          // For some reason animating svg element rotation is buggy on windows/linux
          // so we use a div instead
          position: 'absolute',
          left: ARC_RADIUS,
          top: ARC_RADIUS,
          width: NEEDLE_LENGTH,
          height: 4,
          background: '#F5C444',
          transition: 'transform 0.2s linear',
          transform: `rotate(${Math.round(
            needleAngle * (CIRCLE_DEG / CIRCLE)
          )}deg)`,
          transformOrigin: 'left center',
          zIndex: 99999
        }}
      />
      {target && (
        <TargetTick
          min={min}
          max={max}
          value={target.value}
          trail={target.trail}
          color={target.color}
        />
      )}
    </div>
  );
}
