import assert from 'node:assert/strict';
import test from 'node:test';

import {
  valueToAngleRad,
  ARC_END_ANGLE,
  ARC_RADIUS,
  ARC_SIZE,
  ARC_START_ANGLE,
  TARGET_TICK_INNER_RADIUS,
  TARGET_TICK_LENGTH,
  TARGET_TICK_OUTER_RADIUS
} from '../src/components/Barometer/meterGeometry.ts';

const MIN = 0;
const MAX = 12;

test('valueToAngleRad maps the ends of the range onto the ends of the arc', () => {
  assert.equal(valueToAngleRad(MIN, MIN, MAX), ARC_START_ANGLE);
  assert.equal(valueToAngleRad(MAX, MIN, MAX), ARC_END_ANGLE);
});

test('valueToAngleRad clamps values outside the range', () => {
  assert.equal(valueToAngleRad(MIN - 1, MIN, MAX), ARC_START_ANGLE);
  assert.equal(valueToAngleRad(MIN - 100, MIN, MAX), ARC_START_ANGLE);
  assert.equal(valueToAngleRad(MAX + 1, MIN, MAX), ARC_END_ANGLE);
  assert.equal(valueToAngleRad(MAX + 100, MIN, MAX), ARC_END_ANGLE);
});

test('valueToAngleRad is monotonic across the range', () => {
  let previous = valueToAngleRad(MIN, MIN, MAX);

  for (let value = MIN + 0.1; value <= MAX; value += 0.1) {
    const angle = valueToAngleRad(value, MIN, MAX);
    assert.ok(
      angle > previous,
      `expected the angle at ${value} to exceed the angle at the previous step`
    );
    previous = angle;
  }
});

test('valueToAngleRad puts the midpoint halfway along the arc', () => {
  const middle = valueToAngleRad((MIN + MAX) / 2, MIN, MAX);
  assert.equal(middle, (ARC_START_ANGLE + ARC_END_ANGLE) / 2);
});

test('the arc radius is half the arc size', () => {
  assert.equal(ARC_RADIUS, ARC_SIZE / 2);
});

test('the target tick spans the outer end of the tick ring', () => {
  assert.equal(TARGET_TICK_OUTER_RADIUS, 223);
  assert.equal(TARGET_TICK_LENGTH, 19);
  assert.equal(TARGET_TICK_INNER_RADIUS, 204);
  assert.equal(
    TARGET_TICK_OUTER_RADIUS - TARGET_TICK_INNER_RADIUS,
    TARGET_TICK_LENGTH
  );
});
