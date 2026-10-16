import {
  ARC_RADIUS,
  TARGET_TICK_INNER_RADIUS,
  TARGET_TICK_OUTER_RADIUS
} from './meterGeometry.ts';

/**
 * Pure geometry of the comet-shaped trail that follows the manual target tick.
 *
 * Everything here is expressed in the *marker's local frame*: the origin is the
 * ring centre, the marker itself lies along local angle 0 (the +x axis) and
 * angles grow clockwise on screen because SVG y grows downwards. The caller
 * rotates the whole frame to the marker's angle, so the trail's head is welded
 * to the tick at every frame of that rotation instead of racing ahead of it.
 *
 * No React and no DOM, so `tests/trailGeometry.test.mts` can import it directly.
 */

/** One sample of the tapered inner edge per degree of sweep. */
export const TRAIL_SEGMENT_RAD = Math.PI / 180;

export interface TrailGeometry {
  path: string;
  gradient: { x1: number; y1: number; x2: number; y2: number };
}

const pointAt = (angle: number, radius: number): [number, number] => [
  ARC_RADIUS + Math.cos(angle) * radius,
  ARC_RADIUS + Math.sin(angle) * radius
];

const fmt = (value: number): string => value.toFixed(2);

/**
 * Builds the trail for a sweep of `deltaRad = headAngle - tipAngle`, signed, so
 * the tip sits at local angle `-deltaRad` and the head at 0.
 *
 * The outer edge is a true arc at the tick's outer radius. The inner edge is a
 * polyline that starts at the head's inner corner and tapers linearly back out
 * to the outer radius, so the shape is exactly as wide as the painted tick
 * (`TARGET_TICK_LENGTH`) where it meets the marker and comes to a point at the
 * tip. Returns null when there is nothing to draw.
 */
export const buildTrailGeometry = (deltaRad: number): TrailGeometry | null => {
  if (!Number.isFinite(deltaRad) || deltaRad === 0) {
    return null;
  }

  const outer = TARGET_TICK_OUTER_RADIUS;
  const inner = TARGET_TICK_INNER_RADIUS;
  const tipAngle = -deltaRad;

  const [tipX, tipY] = pointAt(tipAngle, outer);
  const [headOuterX, headOuterY] = pointAt(0, outer);
  const [headInnerX, headInnerY] = pointAt(0, inner);

  const largeArc = Math.abs(deltaRad) > Math.PI ? 1 : 0;
  // The angle grows from -deltaRad to 0, so a positive delta sweeps positively.
  const sweep = deltaRad > 0 ? 1 : 0;

  const segments = Math.max(
    2,
    Math.ceil(Math.abs(deltaRad) / TRAIL_SEGMENT_RAD)
  );

  const taper: string[] = [];
  for (let k = 1; k <= segments; k++) {
    const angle = tipAngle * (k / segments);
    const remaining = 1 - k / segments;
    const radius = outer - (outer - inner) * remaining;
    const [x, y] = pointAt(angle, radius);
    taper.push(`L${fmt(x)} ${fmt(y)}`);
  }

  // The last taper point is the tip back on the outer radius, which closes the
  // shape onto the start of the arc.
  const path = [
    `M${fmt(tipX)} ${fmt(tipY)}`,
    `A${outer} ${outer} 0 ${largeArc} ${sweep} ${fmt(headOuterX)} ${fmt(
      headOuterY
    )}`,
    `L${fmt(headInnerX)} ${fmt(headInnerY)}`,
    ...taper,
    'Z'
  ].join(' ');

  return {
    // A straight chord from tip to head approximates "along the arc". It stays
    // monotone along the arc for every |deltaRad| < pi, which covers any trail
    // the 400 ms trail span can produce, so the fade never doubles back.
    path,
    gradient: { x1: tipX, y1: tipY, x2: headOuterX, y2: headOuterY }
  };
};
