import {
  ARC_RADIUS,
  ARC_SIZE,
  CIRCLE,
  CIRCLE_DEG,
  TARGET_TICK_INNER_RADIUS,
  TARGET_TICK_OUTER_RADIUS,
  valueToAngleRad
} from './meterGeometry';
import { buildTrailGeometry } from './trailGeometry';
import { Trail, toBar } from './manualTarget';

const TRAIL_GRADIENT_ID = 'manual-target-trail';

const toDeg = (radians: number): number => radians * (CIRCLE_DEG / CIRCLE);

interface TargetTickProps {
  min: number;
  max: number;
  value: number;
  trail: Trail | null;
  // The colour of the control the machine is driving, so the marker and its
  // trail read as part of the pressure ring or of the flow ring.
  color: string;
}

export function TargetTick({ min, max, value, trail, color }: TargetTickProps) {
  const headAngle = valueToAngleRad(value, min, max);

  const geometry = trail
    ? buildTrailGeometry(
        headAngle - valueToAngleRad(toBar(trail.fromTenths), min, max)
      )
    : null;

  return (
    // One rotated frame holds both the trail and the marker, and the trail is
    // built with its head at local angle 0. The head is therefore glued to the
    // tick through every frame of the transition, instead of the trail snapping
    // to the new angle while the marker eases towards it.
    // The setpoint streams in every 100 ms, so a linear transition slightly
    // longer than that re-targets mid-flight and consecutive steps blend into
    // one motion instead of stopping between frames; keeping it under the
    // needle's 200 ms still leaves the target the more responsive of the two.
    // Rotating a div rather than animating svg attributes also keeps the
    // animation composited, which the dial's WebKitGTK runtime needs.
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: ARC_SIZE,
        height: ARC_SIZE,
        pointerEvents: 'none',
        zIndex: 99998,
        transformOrigin: 'center',
        transition: 'transform 150ms linear',
        transform: `rotate(${toDeg(headAngle)}deg)`
      }}
    >
      {geometry && (
        <svg
          width={ARC_SIZE}
          height={ARC_SIZE}
          viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <defs>
            <linearGradient
              id={TRAIL_GRADIENT_ID}
              gradientUnits="userSpaceOnUse"
              x1={geometry.gradient.x1}
              y1={geometry.gradient.y1}
              x2={geometry.gradient.x2}
              y2={geometry.gradient.y2}
            >
              <stop offset="0" stopColor={color} stopOpacity="0" />
              <stop offset="1" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <path d={geometry.path} fill={`url(#${TRAIL_GRADIENT_ID})`} />
        </svg>
      )}
      <div
        style={{
          // The left edge sits on the ring centre, so distances along this div
          // are radii: the transparent run is exactly the inner radius and the
          // painted run reaches the outer one. `top` is offset by half the
          // height so the centre-line passes through the rotation centre.
          position: 'absolute',
          left: ARC_RADIUS,
          top: ARC_RADIUS - 1.5,
          width: TARGET_TICK_OUTER_RADIUS,
          height: 3,
          background: `linear-gradient(to right, transparent 0px, transparent ${TARGET_TICK_INNER_RADIUS}px, ${color} ${TARGET_TICK_INNER_RADIUS}px, ${color} ${TARGET_TICK_OUTER_RADIUS}px)`
        }}
      />
    </div>
  );
}
