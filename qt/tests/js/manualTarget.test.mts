import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampTenths,
  computeTrail,
  pushSample,
  toBar,
  toTenths,
  MANUAL_MAX_TENTHS,
  MANUAL_MIN_TENTHS,
  TRAIL_HISTORY_MS,
  TRAIL_WINDOW_MS,
  type TargetSample
} from '../src/components/Barometer/manualTarget.ts';

test('clampTenths holds the target inside the manual range', () => {
  assert.equal(clampTenths(-1), MANUAL_MIN_TENTHS);
  assert.equal(clampTenths(0), 0);
  assert.equal(clampTenths(64), 64);
  assert.equal(clampTenths(MANUAL_MAX_TENTHS), MANUAL_MAX_TENTHS);
  assert.equal(clampTenths(MANUAL_MAX_TENTHS + 25), MANUAL_MAX_TENTHS);
});

test('bar and tenths conversions round trip', () => {
  assert.equal(toTenths(6.4), 64);
  assert.equal(toTenths(0), 0);
  assert.equal(toTenths(12), MANUAL_MAX_TENTHS);
  assert.equal(toBar(64), 6.4);
  assert.equal(toBar(toTenths(9.3)), 9.3);
});

test('pushSample ignores repeated values', () => {
  const history: TargetSample[] = [{ tenths: 64, t: 1_000 }];
  const next = pushSample(history, 64, 1_050);

  assert.deepEqual(next, [{ tenths: 64, t: 1_000 }]);
  assert.notEqual(next, history, 'returns a new array');
});

test('pushSample appends changed values and trims to the history window', () => {
  const now = 10_000;
  const history: TargetSample[] = [
    { tenths: 60, t: now - TRAIL_HISTORY_MS - 500 },
    { tenths: 61, t: now - TRAIL_HISTORY_MS - 1 },
    { tenths: 62, t: now - 100 }
  ];

  const next = pushSample(history, 63, now);

  assert.deepEqual(next, [
    { tenths: 62, t: now - 100 },
    { tenths: 63, t: now }
  ]);
});

test('pushSample always keeps the last sample, however old', () => {
  const now = 10_000;
  const history: TargetSample[] = [
    { tenths: 60, t: now - TRAIL_HISTORY_MS - 900 },
    { tenths: 61, t: now - TRAIL_HISTORY_MS - 800 }
  ];

  // Same value as the last sample, so nothing is appended and everything in
  // history is already outside the window.
  const next = pushSample(history, 61, now);

  assert.deepEqual(next, [{ tenths: 61, t: now - TRAIL_HISTORY_MS - 800 }]);
});

test('computeTrail returns null for empty or static history', () => {
  assert.equal(computeTrail([], 1_000), null);
  assert.equal(computeTrail([{ tenths: 64, t: 1_000 }], 1_000), null);
});

test('computeTrail grows the arc the faster the target is turned', () => {
  const now = 5_000;

  const slow = computeTrail(
    [
      { tenths: 60, t: now - TRAIL_WINDOW_MS - 10 },
      { tenths: 61, t: now - 200 },
      { tenths: 62, t: now }
    ],
    now
  );

  const fast = computeTrail(
    [
      { tenths: 60, t: now - TRAIL_WINDOW_MS - 10 },
      { tenths: 63, t: now - 200 },
      { tenths: 68, t: now }
    ],
    now
  );

  assert.ok(slow, 'slow turn still produces a trail');
  assert.ok(fast, 'fast turn produces a trail');

  const slowSpan = Math.abs(slow.toTenths - slow.fromTenths);
  const fastSpan = Math.abs(fast.toTenths - fast.fromTenths);

  assert.equal(slowSpan, 2);
  assert.equal(fastSpan, 8);
  assert.ok(
    fastSpan > slowSpan,
    'more detents inside the window draw a longer arc'
  );
});

test('computeTrail falls back to the oldest sample inside the window', () => {
  const now = 5_000;
  const trail = computeTrail(
    [
      { tenths: 60, t: now - 300 },
      { tenths: 64, t: now }
    ],
    now
  );

  assert.deepEqual(trail, { fromTenths: 60, toTenths: 64 });
});

test('computeTrail retracts the tail once the window slides past the last change', () => {
  const now = 5_000;
  const history: TargetSample[] = [
    { tenths: 60, t: now - TRAIL_WINDOW_MS - 10 },
    { tenths: 64, t: now }
  ];

  // The trail does not fade; it shortens as `from` catches up with `to`.
  assert.deepEqual(computeTrail(history, now), {
    fromTenths: 60,
    toTenths: 64
  });
  assert.deepEqual(computeTrail(history, now + TRAIL_WINDOW_MS - 1), {
    fromTenths: 60,
    toTenths: 64
  });

  // The last change is now outside the window, so it becomes the `from` sample
  // too and there is nothing left to draw.
  assert.equal(computeTrail(history, now + TRAIL_WINDOW_MS), null);
  assert.equal(computeTrail(history, now + TRAIL_WINDOW_MS + 500), null);
});
