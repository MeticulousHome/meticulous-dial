export const SLOWDOWN_MONITOR_CONFIG = {
  windowMs: 10_000,
  warmupMs: 30_000,
  degradedP95Ms: 45,
  severeFrameGapMs: 1_000,
  immediateReportFrameGapMs: 5_000,
  consecutiveDegradedWindows: 3,
  consecutiveHealthyWindowsToRecover: 3,
  reportCooldownMs: 30 * 60 * 1_000
} as const;

export interface FrameWindowSummary {
  windowMs: number;
  observedFps: number;
  frameIntervalP50Ms: number;
  frameIntervalP95Ms: number;
  frameIntervalP99Ms: number;
  framesOver50Ms: number;
  framesOver100Ms: number;
  framesOver250Ms: number;
  framesOver1000Ms: number;
  maxFrameGapMs: number;
  degraded: boolean;
}

const percentile = (sortedValues: number[], quantile: number): number => {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * quantile) - 1)
  );
  return sortedValues[index];
};

export const summarizeFrameWindow = (
  frameIntervals: number[],
  windowMs: number
): FrameWindowSummary => {
  const sortedIntervals = [...frameIntervals].sort((a, b) => a - b);
  const maxFrameGapMs =
    sortedIntervals.length > 0
      ? sortedIntervals[sortedIntervals.length - 1]
      : 0;
  const frameIntervalP95Ms = percentile(sortedIntervals, 0.95);

  return {
    windowMs,
    observedFps: windowMs > 0 ? (frameIntervals.length * 1_000) / windowMs : 0,
    frameIntervalP50Ms: percentile(sortedIntervals, 0.5),
    frameIntervalP95Ms,
    frameIntervalP99Ms: percentile(sortedIntervals, 0.99),
    framesOver50Ms: frameIntervals.filter((interval) => interval >= 50).length,
    framesOver100Ms: frameIntervals.filter((interval) => interval >= 100)
      .length,
    framesOver250Ms: frameIntervals.filter((interval) => interval >= 250)
      .length,
    framesOver1000Ms: frameIntervals.filter((interval) => interval >= 1_000)
      .length,
    maxFrameGapMs,
    degraded:
      frameIntervalP95Ms >= SLOWDOWN_MONITOR_CONFIG.degradedP95Ms ||
      maxFrameGapMs >= SLOWDOWN_MONITOR_CONFIG.severeFrameGapMs
  };
};

export class SlowdownEpisodeDetector {
  private consecutiveDegradedWindows = 0;
  private consecutiveHealthyWindows = 0;
  private episodeActive = false;
  private lastReportAt = Number.NEGATIVE_INFINITY;

  evaluate(summary: FrameWindowSummary, now: number): boolean {
    if (summary.degraded) {
      this.consecutiveHealthyWindows = 0;
      this.consecutiveDegradedWindows += 1;

      const immediateReport =
        summary.maxFrameGapMs >=
        SLOWDOWN_MONITOR_CONFIG.immediateReportFrameGapMs;
      if (
        !this.episodeActive &&
        (immediateReport ||
          this.consecutiveDegradedWindows >=
            SLOWDOWN_MONITOR_CONFIG.consecutiveDegradedWindows) &&
        now - this.lastReportAt >= SLOWDOWN_MONITOR_CONFIG.reportCooldownMs
      ) {
        this.episodeActive = true;
        this.lastReportAt = now;
        return true;
      }

      return false;
    }

    this.consecutiveDegradedWindows = 0;
    this.consecutiveHealthyWindows += 1;
    if (
      this.consecutiveHealthyWindows >=
      SLOWDOWN_MONITOR_CONFIG.consecutiveHealthyWindowsToRecover
    ) {
      this.episodeActive = false;
    }
    return false;
  }
}
