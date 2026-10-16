export const BREWER_REMOVAL_CONFIRM_MS = 3000;
export const BREWER_REMOVAL_STABLE_MS = 700;

const BREWER_REMOVAL_STABLE_RANGE_G = 1.5;

const MAX_PLAUSIBLE_WATER_RISE_GPS = 15;
const MAX_FILTER_INTERVAL_MS = 250;

/**
 * Removing the brewer takes away the brewer, dry coffee, and retained water.
 * A threshold tied to more than half of the measured setup weight prevents a
 * vigorous swirl from looking like a removal while remaining comfortably
 * below a real lift. The floor preserves detection for very light brewers.
 */
export const brewerRemovalThreshold = (setupWeightG: number) =>
  Math.max(28, Math.max(0, setupWeightG) * 0.55);

export type BrewWeightCandidate =
  | { type: 'plausible'; beverageG: number }
  | { type: 'server-missing'; beverageG: number }
  | { type: 'setup-still-on-scale'; beverageG: number };

/** Classifies a stable post-lift scale reading before changing the UI. */
export const classifyBrewWeightCandidate = (
  scaleWeightG: number,
  setupWeightG: number,
  waterWeightG: number
): BrewWeightCandidate => {
  const beverageG = scaleWeightG + setupWeightG;
  if (beverageG > waterWeightG + 8) {
    return { type: 'setup-still-on-scale', beverageG };
  }
  if (beverageG < Math.max(8, waterWeightG * 0.2)) {
    return { type: 'server-missing', beverageG };
  }
  return { type: 'plausible', beverageG };
};

/**
 * Advances a high-water mark no faster than a real pour can plausibly add
 * water. A brief upward scale spike therefore cannot become the new brew peak.
 */
export const updatePlausiblePeakWeight = (
  previousPeakG: number,
  sampleWeightG: number,
  elapsedMs: number
) => {
  if (sampleWeightG <= previousPeakG) return previousPeakG;

  const boundedElapsedMs = Math.max(
    0,
    Math.min(elapsedMs, MAX_FILTER_INTERVAL_MS)
  );
  const allowedRiseG = (MAX_PLAUSIBLE_WATER_RISE_GPS * boundedElapsedMs) / 1000;
  return Math.min(sampleWeightG, previousPeakG + allowedRiseG);
};

export type BrewerRemovalState =
  | { type: 'idle' }
  | { type: 'started'; startedAtMs: number }
  | { type: 'pending'; startedAtMs: number; heldMs: number }
  | { type: 'cancelled'; startedAtMs: number; heldMs: number }
  | { type: 'confirmed'; startedAtMs: number; heldMs: number };

/** Requires a removal-sized weight drop to persist before accepting it. */
export class BrewerRemovalConfirmation {
  private startedAtMs: number | null = null;
  private stableSinceMs: number | null = null;
  private stableMinimumG = 0;
  private stableMaximumG = 0;

  reset() {
    this.startedAtMs = null;
    this.stableSinceMs = null;
    this.stableMinimumG = 0;
    this.stableMaximumG = 0;
  }

  update(
    isBelowRemovalThreshold: boolean,
    nowMs: number,
    weightG: number
  ): BrewerRemovalState {
    if (!isBelowRemovalThreshold) {
      if (this.startedAtMs === null) return { type: 'idle' };

      const startedAtMs = this.startedAtMs;
      this.reset();
      return {
        type: 'cancelled',
        startedAtMs,
        heldMs: Math.max(0, nowMs - startedAtMs)
      };
    }

    if (this.startedAtMs === null) {
      this.startedAtMs = nowMs;
      this.stableSinceMs = nowMs;
      this.stableMinimumG = weightG;
      this.stableMaximumG = weightG;
      return { type: 'started', startedAtMs: nowMs };
    }

    this.stableMinimumG = Math.min(this.stableMinimumG, weightG);
    this.stableMaximumG = Math.max(this.stableMaximumG, weightG);
    if (
      this.stableMaximumG - this.stableMinimumG >
      BREWER_REMOVAL_STABLE_RANGE_G
    ) {
      this.stableSinceMs = nowMs;
      this.stableMinimumG = weightG;
      this.stableMaximumG = weightG;
    }

    const heldMs = Math.max(0, nowMs - this.startedAtMs);
    const stableHeldMs = Math.max(0, nowMs - (this.stableSinceMs ?? nowMs));
    if (
      heldMs < BREWER_REMOVAL_CONFIRM_MS ||
      stableHeldMs < BREWER_REMOVAL_STABLE_MS
    ) {
      return { type: 'pending', startedAtMs: this.startedAtMs, heldMs };
    }

    const startedAtMs = this.startedAtMs;
    this.startedAtMs = null;
    return { type: 'confirmed', startedAtMs, heldMs };
  }
}
