export const BREWER_REMOVAL_CONFIRM_MS = 2000;

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

  reset() {
    this.startedAtMs = null;
  }

  update(isBelowRemovalThreshold: boolean, nowMs: number): BrewerRemovalState {
    if (!isBelowRemovalThreshold) {
      if (this.startedAtMs === null) return { type: 'idle' };

      const startedAtMs = this.startedAtMs;
      this.startedAtMs = null;
      return {
        type: 'cancelled',
        startedAtMs,
        heldMs: Math.max(0, nowMs - startedAtMs)
      };
    }

    if (this.startedAtMs === null) {
      this.startedAtMs = nowMs;
      return { type: 'started', startedAtMs: nowMs };
    }

    const heldMs = Math.max(0, nowMs - this.startedAtMs);
    if (heldMs < BREWER_REMOVAL_CONFIRM_MS) {
      return { type: 'pending', startedAtMs: this.startedAtMs, heldMs };
    }

    const startedAtMs = this.startedAtMs;
    this.startedAtMs = null;
    return { type: 'confirmed', startedAtMs, heldMs };
  }
}
