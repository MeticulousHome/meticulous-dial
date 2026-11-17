import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARC_RADIUS,
  TARGET_TICK_INNER_RADIUS,
  TARGET_TICK_OUTER_RADIUS
} from '../src/components/Barometer/meterGeometry.ts';
import {
  buildTrailGeometry,
  TRAIL_SEGMENT_RAD
} from '../src/components/Barometer/trailGeometry.ts';

const pointAt = (angle: number, radius: number): [number, number] => [
  ARC_RADIUS + Math.cos(angle) * radius,
  ARC_RADIUS + Math.sin(angle) * radius
];

const moveTo = (path: string): [number, number] => {
  const match = /^M(-?[\d.]+) (-?[\d.]+)/.exec(path);
  assert.ok(match, `expected a move command at the start of ${path}`);
  return [Number(match[1]), Number(match[2])];
};

const arcFlags = (path: string): { largeArc: number; sweep: number } => {
  const match = /A[\d.]+ [\d.]+ 0 (\d) (\d) /.exec(path);
  assert.ok(match, `expected an arc command in ${path}`);
  return { largeArc: Number(match[1]), sweep: Number(match[2]) };
};

const lineTos = (path: string): [number, number][] =>
  [...path.matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [
    Number(match[1]),
    Number(match[2])
  ]);

test('buildTrailGeometry returns null when there is nothing to draw', () => {
  assert.equal(buildTrailGeometry(0), null);
  assert.equal(buildTrailGeometry(Number.NaN), null);
  assert.equal(buildTrailGeometry(Number.POSITIVE_INFINITY), null);
});

test('buildTrailGeometry sweeps from the tip round to the marker', () => {
  const delta = 0.2;
  const geometry = buildTrailGeometry(delta);
  assert.ok(geometry);

  assert.ok(geometry.path.startsWith('M'), 'the path starts with a move');
  assert.ok(geometry.path.endsWith('Z'), 'the path is closed');

  // The tip sits on the outer radius, one full sweep behind the marker.
  const [tipX, tipY] = moveTo(geometry.path);
  const [expectedTipX, expectedTipY] = pointAt(
    -delta,
    TARGET_TICK_OUTER_RADIUS
  );
  assert.ok(Math.abs(tipX - expectedTipX) < 0.01, `tip x ${tipX}`);
  assert.ok(Math.abs(tipY - expectedTipY) < 0.01, `tip y ${tipY}`);
  assert.ok(
    Math.abs(Math.hypot(tipX - ARC_RADIUS, tipY - ARC_RADIUS) - 223) < 0.01,
    'the tip is on the outer radius'
  );

  // A positive delta sweeps in the positive (clockwise on screen) direction.
  assert.deepEqual(arcFlags(geometry.path), { largeArc: 0, sweep: 1 });

  // The gradient runs from the tip to the marker, which lies at local angle 0.
  assert.ok(Math.abs(geometry.gradient.x1 - expectedTipX) < 0.01);
  assert.ok(Math.abs(geometry.gradient.y1 - expectedTipY) < 0.01);
  assert.ok(
    Math.abs(geometry.gradient.x2 - (ARC_RADIUS + TARGET_TICK_OUTER_RADIUS)) <
      0.01
  );
  assert.ok(Math.abs(geometry.gradient.y2 - ARC_RADIUS) < 0.01);

  // The first line is the marker's inner corner, then the tapered inner edge.
  const lines = lineTos(geometry.path);
  const [headInnerX, headInnerY] = lines[0];
  assert.ok(
    Math.abs(headInnerX - (ARC_RADIUS + TARGET_TICK_INNER_RADIUS)) < 0.01,
    `head inner x ${headInnerX}`
  );
  assert.ok(
    Math.abs(headInnerY - ARC_RADIUS) < 0.01,
    `head inner y ${headInnerY}`
  );

  const segments = Math.max(2, Math.ceil(delta / TRAIL_SEGMENT_RAD));
  assert.equal(lines.length, 1 + segments);
});

test('buildTrailGeometry mirrors the sweep for a negative delta', () => {
  const delta = -0.2;
  const geometry = buildTrailGeometry(delta);
  assert.ok(geometry);

  assert.deepEqual(arcFlags(geometry.path), { largeArc: 0, sweep: 0 });

  const [tipX, tipY] = moveTo(geometry.path);
  const [expectedTipX, expectedTipY] = pointAt(0.2, TARGET_TICK_OUTER_RADIUS);
  assert.ok(Math.abs(tipX - expectedTipX) < 0.01, `tip x ${tipX}`);
  assert.ok(Math.abs(tipY - expectedTipY) < 0.01, `tip y ${tipY}`);
});

test('buildTrailGeometry sets the large-arc flag past half a turn', () => {
  const wide = buildTrailGeometry(Math.PI + 0.1);
  assert.ok(wide);
  assert.deepEqual(arcFlags(wide.path), { largeArc: 1, sweep: 1 });

  const wideNegative = buildTrailGeometry(-(Math.PI + 0.1));
  assert.ok(wideNegative);
  assert.deepEqual(arcFlags(wideNegative.path), { largeArc: 1, sweep: 0 });

  // Exactly half a turn is still the short form.
  const half = buildTrailGeometry(Math.PI);
  assert.ok(half);
  assert.equal(arcFlags(half.path).largeArc, 0);
});

test('the trail is as wide as the painted tick where it meets the marker', () => {
  const geometry = buildTrailGeometry(0.2);
  assert.ok(geometry);

  const lines = lineTos(geometry.path);
  const radiusOf = ([x, y]: [number, number]): number =>
    Math.hypot(x - ARC_RADIUS, y - ARC_RADIUS);

  // The inner edge starts at the inner radius under the marker and tapers back
  // out to the outer radius at the tip, so the shape comes to a point.
  assert.ok(Math.abs(radiusOf(lines[0]) - TARGET_TICK_INNER_RADIUS) < 0.01);
  assert.ok(
    Math.abs(radiusOf(lines[lines.length - 1]) - TARGET_TICK_OUTER_RADIUS) <
      0.01
  );

  for (let i = 1; i < lines.length; i++) {
    assert.ok(
      radiusOf(lines[i]) >= radiusOf(lines[i - 1]) - 0.01,
      `the taper never doubles back at segment ${i}`
    );
  }
});
