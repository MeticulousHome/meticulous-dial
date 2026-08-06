import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SLOWDOWN_MONITOR_CONFIG,
  SlowdownEpisodeDetector,
  summarizeFrameWindow
} from '../src/performance/slowdownDetector.ts';

const healthyWindow = summarizeFrameWindow(Array(600).fill(16.67), 10_000);
const degradedWindow = summarizeFrameWindow(
  [...Array(540).fill(16.67), ...Array(60).fill(80)],
  10_000
);

test('summarizes healthy and degraded frame windows', () => {
  assert.equal(healthyWindow.degraded, false);
  assert.equal(healthyWindow.framesOver50Ms, 0);
  assert.equal(degradedWindow.degraded, true);
  assert.equal(degradedWindow.framesOver50Ms, 60);
  assert.equal(degradedWindow.frameIntervalP95Ms, 80);
});

test('reports once after sustained degradation and rearms after recovery', () => {
  const detector = new SlowdownEpisodeDetector();

  assert.equal(detector.evaluate(degradedWindow, 0), false);
  assert.equal(detector.evaluate(degradedWindow, 10_000), false);
  assert.equal(detector.evaluate(degradedWindow, 20_000), true);
  assert.equal(detector.evaluate(degradedWindow, 30_000), false);

  detector.evaluate(healthyWindow, 40_000);
  detector.evaluate(healthyWindow, 50_000);
  detector.evaluate(healthyWindow, 60_000);

  const afterCooldown = SLOWDOWN_MONITOR_CONFIG.reportCooldownMs + 70_000;
  assert.equal(detector.evaluate(degradedWindow, afterCooldown), false);
  assert.equal(
    detector.evaluate(degradedWindow, afterCooldown + 10_000),
    false
  );
  assert.equal(detector.evaluate(degradedWindow, afterCooldown + 20_000), true);
});

test('treats a one-second UI-thread stall as degraded', () => {
  const summary = summarizeFrameWindow(
    [...Array(540).fill(16.67), 1_000],
    10_000
  );

  assert.equal(summary.degraded, true);
  assert.equal(summary.framesOver1000Ms, 1);
  assert.equal(summary.maxFrameGapMs, 1_000);
});

test('reports a severe single-window stall immediately', () => {
  const detector = new SlowdownEpisodeDetector();
  const severeWindow = summarizeFrameWindow(
    [...Array(300).fill(16.67), 5_000],
    10_000
  );

  assert.equal(detector.evaluate(severeWindow, 0), true);
  assert.equal(detector.evaluate(severeWindow, 10_000), false);
});

test('reports persistent degradation when cooldown expires', () => {
  const detector = new SlowdownEpisodeDetector();

  detector.evaluate(degradedWindow, 0);
  detector.evaluate(degradedWindow, 10_000);
  assert.equal(detector.evaluate(degradedWindow, 20_000), true);

  detector.evaluate(healthyWindow, 30_000);
  detector.evaluate(healthyWindow, 40_000);
  detector.evaluate(healthyWindow, 50_000);

  assert.equal(detector.evaluate(degradedWindow, 60_000), false);
  assert.equal(detector.evaluate(degradedWindow, 70_000), false);
  assert.equal(detector.evaluate(degradedWindow, 80_000), false);

  const cooldownExpiredAt = 20_000 + SLOWDOWN_MONITOR_CONFIG.reportCooldownMs;
  assert.equal(detector.evaluate(degradedWindow, cooldownExpiredAt), true);
  assert.equal(
    detector.evaluate(degradedWindow, cooldownExpiredAt + 10_000),
    false
  );
});
