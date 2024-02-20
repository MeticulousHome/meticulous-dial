// Basic trigonometry constants
const CIRCLE = Math.PI * 2;
const CIRCLE_DEG = 360;
const CIRCLE_BOTTOM_ANGLE = 0.25 * CIRCLE;

// For the steps/needle we don't want a full circle, but 300 deg
const ARC_FILL_RATIO = (CIRCLE_DEG - 60) / CIRCLE_DEG;
const ARC_START_ANGLE =
  CIRCLE_BOTTOM_ANGLE + ((1 - ARC_FILL_RATIO) * CIRCLE) / 2;
const ARC_END_ANGLE = ARC_START_ANGLE + ARC_FILL_RATIO * CIRCLE;

// Sizing
const ARC_SIZE = 478; // Basically window size, but can be anything as long as svg is sized properly
const ARC_RADIUS = ARC_SIZE / 2;
const STEP_LENGTH = 13;
const STEP_EDGE_OFFSET = 19;
const NEEDLE_LENGTH = ARC_RADIUS - STEP_LENGTH - STEP_EDGE_OFFSET - 10;

interface MeterProps {
  className?: string;
  min: number;
  max: number;
  value: number;
  step: number;
}

export function Meter({ min, max, value, step, className }: MeterProps) {
  const range = max - min;
  const steps = range / step + 1;
  const clampedValue = Math.max(min, Math.min(value, max));
  const relativeValue = (clampedValue - min) / range;
  const needleAngle =
    ARC_START_ANGLE + relativeValue * (ARC_END_ANGLE - ARC_START_ANGLE);

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
          transformOrigin: 'left center'
        }}
      />
    </div>
  );
}
