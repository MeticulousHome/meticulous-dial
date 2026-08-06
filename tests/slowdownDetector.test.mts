import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SLOWDOWN_MONITOR_CONFIG,
  SlowdownEpisodeDetector,
  summarizeFrameWindow
} from '../src/performance/slowdownDetector.ts';
import { resolveDialPerformanceMonitorEnabled } from '../src/performance/slowdownMonitorConfig.ts';

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

  assert.equal(detector.evaluate(degradedWindow, 0), null);
  assert.equal(detector.evaluate(degradedWindow, 10_000), null);
  assert.deepEqual(detector.evaluate(degradedWindow, 20_000), {
    episodeWindowCount: 3,
    kind: 'sustained'
  });
  assert.equal(detector.evaluate(degradedWindow, 30_000), null);

  detector.evaluate(healthyWindow, 40_000);
  detector.evaluate(healthyWindow, 50_000);
  detector.evaluate(healthyWindow, 60_000);

  const afterCooldown = SLOWDOWN_MONITOR_CONFIG.reportCooldownMs + 70_000;
  assert.equal(detector.evaluate(degradedWindow, afterCooldown), null);
  assert.equal(detector.evaluate(degradedWindow, afterCooldown + 10_000), null);
  assert.deepEqual(detector.evaluate(degradedWindow, afterCooldown + 20_000), {
    episodeWindowCount: 3,
    kind: 'sustained'
  });
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

test('does not treat a wake or DPMS-like rAF pause as an immediate UI-thread stall', () => {
  const detector = new SlowdownEpisodeDetector();
  const rafPauseWindow = summarizeFrameWindow(
    [...Array(300).fill(16.67), 5_000],
    10_000,
    10
  );

  assert.equal(rafPauseWindow.degraded, true);
  assert.equal(detector.evaluate(rafPauseWindow, 0), null);
});

test('reports an immediate stall only when the timer heartbeat corroborates it', () => {
  const detector = new SlowdownEpisodeDetector();
  const corroboratedStall = summarizeFrameWindow(
    [...Array(300).fill(16.67), 5_000],
    10_000,
    4_750
  );

  assert.deepEqual(detector.evaluate(corroboratedStall, 0), {
    episodeWindowCount: 1,
    kind: 'immediate'
  });
  assert.equal(detector.evaluate(corroboratedStall, 10_000), null);
});

test('reports a low-frequency heartbeat during persistent degradation', () => {
  const detector = new SlowdownEpisodeDetector();

  detector.evaluate(degradedWindow, 0);
  detector.evaluate(degradedWindow, 10_000);
  assert.deepEqual(detector.evaluate(degradedWindow, 20_000), {
    episodeWindowCount: 3,
    kind: 'sustained'
  });
  assert.equal(detector.evaluate(degradedWindow, 30_000), null);

  const cooldownExpiredAt = 20_000 + SLOWDOWN_MONITOR_CONFIG.reportCooldownMs;
  assert.deepEqual(detector.evaluate(degradedWindow, cooldownExpiredAt), {
    episodeWindowCount: 5,
    kind: 'heartbeat'
  });
  assert.equal(
    detector.evaluate(degradedWindow, cooldownExpiredAt + 10_000),
    null
  );
});

test('an immediate blip does not silence a later sustained degradation report', () => {
  const detector = new SlowdownEpisodeDetector();
  const corroboratedStall = summarizeFrameWindow(
    [...Array(300).fill(16.67), 5_000],
    10_000,
    4_750
  );

  assert.deepEqual(detector.evaluate(corroboratedStall, 0), {
    episodeWindowCount: 1,
    kind: 'immediate'
  });
  assert.equal(detector.evaluate(healthyWindow, 10_000), null);
  assert.equal(detector.evaluate(degradedWindow, 20_000), null);
  assert.equal(detector.evaluate(degradedWindow, 30_000), null);
  assert.deepEqual(detector.evaluate(degradedWindow, 40_000), {
    episodeWindowCount: 3,
    kind: 'sustained'
  });
});

test('monitor configuration fails open because the native kill switch is fail-safe', () => {
  assert.equal(resolveDialPerformanceMonitorEnabled(false), false);
  assert.equal(resolveDialPerformanceMonitorEnabled(true), true);
  assert.equal(resolveDialPerformanceMonitorEnabled(undefined), true);
});
