export interface DetectorSample {
  timeMs: number;
  weightG: number;
  flowGps: number;
}

export type PourDetectorEvent =
  | { type: 'pour-start'; sample: DetectorSample }
  | { type: 'pour-end'; sample: DetectorSample };

const START_FLOW_GPS = 0.65;
const STOP_FLOW_GPS = 0.28;
const START_CONFIRM_MS = 1000;
const START_MIN_RETAINED_G = 2;
const START_RETURN_TOLERANCE_G = 0.7;
const START_MAX_NEGATIVE_TRAVEL_G = 1;
const START_CANDIDATE_TIMEOUT_MS = 4000;
const MAX_START_RATE_GPS = 18;
const MOTION_SPIKE_RATE_GPS = 25;
const MOTION_SETTLE_MS = 1200;
const STOP_HOLD_MS = 950;

export const MIN_RETAINED_POUR_G = 1.5;
export const MAX_REPORTED_POUR_FLOW_GPS = 15;

interface StartCandidate {
  sample: DetectorSample;
  baselineWeightG: number;
  negativeTravelG: number;
}

/**
 * Returns true only when movement left real water behind. This second check is
 * intentionally independent of flow because a table impact or dripper shake
 * can produce a large, slowly decaying gravimetric-flow signal.
 */
export const hasRetainedPourWeight = (
  startWeightG: number,
  settledWeightG: number
) => settledWeightG - startWeightG >= MIN_RETAINED_POUR_G;

/**
 * Prefer the settled scale reading over a transient high-water mark. Returning
 * null tells the caller to roll the candidate back as movement.
 */
export const resolvedPourEndWeight = (
  startWeightG: number,
  peakWeightG: number,
  settledWeightG?: number
) => {
  if (settledWeightG === undefined) {
    return Math.max(startWeightG, peakWeightG);
  }
  if (!hasRetainedPourWeight(startWeightG, settledWeightG)) return null;
  return Math.max(startWeightG, settledWeightG);
};

/** Never allow a scale-motion spike to become the reported peak pour rate. */
export const plausiblePeakFlow = (flowGps: number) =>
  Number.isFinite(flowGps) &&
  flowGps >= 0 &&
  flowGps <= MAX_REPORTED_POUR_FLOW_GPS
    ? flowGps
    : 0;

/**
 * Motion-aware pour detector with no hot-path allocations.
 *
 * Starting a pour is based on a sustained, mostly monotonic weight increase,
 * not the scale's filtered flow alone. Filtered flow can remain high for
 * seconds after an impact. The confirmed event is backdated to the first
 * credible rising sample so the one-second confirmation does not shorten the
 * recorded pour.
 */
export class PourDetector {
  private pouring = false;
  private startCandidate: StartCandidate | null = null;
  private stopCandidate: DetectorSample | null = null;
  private previous: DetectorSample | null = null;
  private motionSuppressedUntilMs = 0;

  get isPouring() {
    return this.pouring;
  }

  reset() {
    this.pouring = false;
    this.startCandidate = null;
    this.stopCandidate = null;
    this.previous = null;
    this.motionSuppressedUntilMs = 0;
  }

  process(sample: DetectorSample): PourDetectorEvent | null {
    const previous = this.previous;
    let derivedFlow = 0;
    let weightDelta = 0;
    let elapsedSeconds = 0;
    if (previous) {
      elapsedSeconds = (sample.timeMs - previous.timeMs) / 1000;
      if (elapsedSeconds > 0) {
        weightDelta = sample.weightG - previous.weightG;
        derivedFlow = weightDelta / elapsedSeconds;
      }
    }
    this.previous = sample;

    if (!this.pouring) {
      if (!previous || elapsedSeconds <= 0) return null;

      // Impacts and vigorous leveling create rates far beyond a plausible
      // hand pour. Clear any candidate and wait for a fresh, clean rise.
      if (Math.abs(derivedFlow) > MOTION_SPIKE_RATE_GPS) {
        this.startCandidate = null;
        this.motionSuppressedUntilMs = sample.timeMs + MOTION_SETTLE_MS;
        return null;
      }
      if (sample.timeMs < this.motionSuppressedUntilMs) return null;

      if (!this.startCandidate) {
        if (
          derivedFlow >= START_FLOW_GPS &&
          derivedFlow <= MAX_START_RATE_GPS
        ) {
          this.startCandidate = {
            sample,
            baselineWeightG: previous.weightG,
            negativeTravelG: 0
          };
        }
        return null;
      }

      const candidate = this.startCandidate;
      if (weightDelta < 0) {
        candidate.negativeTravelG += -weightDelta;
      }
      if (candidate.negativeTravelG > START_MAX_NEGATIVE_TRAVEL_G) {
        this.startCandidate = null;
        return null;
      }

      const candidateAgeMs = sample.timeMs - candidate.sample.timeMs;
      const retainedWeightG = sample.weightG - candidate.baselineWeightG;
      if (
        candidateAgeMs >= 300 &&
        retainedWeightG <= START_RETURN_TOLERANCE_G &&
        derivedFlow <= 0
      ) {
        this.startCandidate = null;
        return null;
      }
      if (
        candidateAgeMs >= START_CANDIDATE_TIMEOUT_MS &&
        retainedWeightG < START_MIN_RETAINED_G
      ) {
        this.startCandidate = null;
        return null;
      }

      const averageRiseGps =
        candidateAgeMs > 0 ? retainedWeightG / (candidateAgeMs / 1000) : 0;
      if (
        candidateAgeMs >= START_CONFIRM_MS &&
        retainedWeightG >= START_MIN_RETAINED_G &&
        averageRiseGps >= START_FLOW_GPS &&
        averageRiseGps <= MAX_START_RATE_GPS
      ) {
        this.pouring = true;
        const startedAt = candidate.sample;
        this.startCandidate = null;
        this.stopCandidate = null;
        return { type: 'pour-start', sample: startedAt };
      }
      return null;
    }

    // Once a pour is established, retain the existing hysteresis so natural
    // scale lag and final drips do not split one pour into several pours.
    const effectiveFlow = Math.max(sample.flowGps, derivedFlow);
    if (effectiveFlow <= STOP_FLOW_GPS) {
      this.stopCandidate ??= sample;
      if (sample.timeMs - this.stopCandidate.timeMs >= STOP_HOLD_MS) {
        this.pouring = false;
        const endedAt = this.stopCandidate;
        this.stopCandidate = null;
        return { type: 'pour-end', sample: endedAt };
      }
    } else {
      this.stopCandidate = null;
    }
    return null;
  }
}
