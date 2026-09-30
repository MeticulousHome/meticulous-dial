/**
 * Pure geometry of the barometer meter arc.
 *
 * This module holds no React and no DOM so that every component sitting on the
 * ring - the needle in `Meter`, the manual target tick in `TargetTick` - can
 * depend on one definition of the geometry without importing each other. Those
 * two components used to share the constants through `Meter`, which made
 * `TargetTick` and `Meter` a module cycle: `TargetTick` read `ARC_RADIUS` in a
 * top-level `const` while `Meter` was still evaluating, so the bundled build
 * hit the temporal dead zone and threw.
 */

// Basic trigonometry constants
export const CIRCLE = Math.PI * 2;
export const CIRCLE_DEG = 360;
export const CIRCLE_BOTTOM_ANGLE = 0.25 * CIRCLE;

// For the steps/needle we don't want a full circle, but 300 deg
export const ARC_FILL_RATIO = (CIRCLE_DEG - 60) / CIRCLE_DEG;
export const ARC_START_ANGLE =
  CIRCLE_BOTTOM_ANGLE + ((1 - ARC_FILL_RATIO) * CIRCLE) / 2;
export const ARC_END_ANGLE = ARC_START_ANGLE + ARC_FILL_RATIO * CIRCLE;

// Sizing
export const ARC_SIZE = 478; // Basically the display size, but can be anything as long as svg is sized properly
export const ARC_RADIUS = ARC_SIZE / 2;
export const STEP_LENGTH = 13;
export const STEP_EDGE_OFFSET = 19;
export const NEEDLE_LENGTH = ARC_RADIUS - STEP_LENGTH - STEP_EDGE_OFFSET - 10;

// The manual target marker. It reaches just past the outer end of the tick ring
// and only its last `TARGET_TICK_LENGTH` px are painted, so the marker lines up
// with the printed steps. The trail behind it is drawn between exactly these two
// radii, which is why they live here rather than inside the component.
export const TARGET_TICK_OUTER_RADIUS = ARC_RADIUS - STEP_EDGE_OFFSET + 3;
export const TARGET_TICK_LENGTH = STEP_LENGTH + 6;
export const TARGET_TICK_INNER_RADIUS =
  TARGET_TICK_OUTER_RADIUS - TARGET_TICK_LENGTH;

/**
 * Maps a value onto the meter arc, in radians. Shared by the needle and by
 * anything else that has to sit on the same ring, such as the manual target
 * tick, so that both use exactly one definition of the geometry.
 */
export const valueToAngleRad = (
  value: number,
  min: number,
  max: number
): number => {
  const range = max - min;
  const clampedValue = Math.max(min, Math.min(value, max));
  const relativeValue = (clampedValue - min) / range;
  return ARC_START_ANGLE + relativeValue * (ARC_END_ANGLE - ARC_START_ANGLE);
};
