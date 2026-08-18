export const BREWER_REMOVAL_CONFIRM_MS = 3000;
export const BREWER_REMOVAL_STABLE_MS = 700;

const BREWER_REMOVAL_STABLE_RANGE_G = 1.5;

const MAX_PLAUSIBLE_WATER_RISE_GPS = 15;
const MAX_FILTER_INTERVAL_MS = 250;

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
