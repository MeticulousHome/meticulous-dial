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
const START_HOLD_MS = 240;
const STOP_HOLD_MS = 950;

/** Small hysteresis-based detector; it allocates nothing in the hot path. */
export class PourDetector {
  private pouring = false;
  private startCandidate: DetectorSample | null = null;
  private stopCandidate: DetectorSample | null = null;
  private previous: DetectorSample | null = null;

  get isPouring() {
    return this.pouring;
  }

  reset() {
    this.pouring = false;
    this.startCandidate = null;
    this.stopCandidate = null;
    this.previous = null;
  }

  process(sample: DetectorSample): PourDetectorEvent | null {
    let derivedFlow = 0;
    if (this.previous) {
      const elapsedSeconds = (sample.timeMs - this.previous.timeMs) / 1000;
      if (elapsedSeconds > 0) {
        derivedFlow = (sample.weightG - this.previous.weightG) / elapsedSeconds;
      }
    }
    this.previous = sample;

    const effectiveFlow = Math.max(sample.flowGps, derivedFlow);
    if (!this.pouring) {
      if (effectiveFlow >= START_FLOW_GPS) {
        this.startCandidate ??= sample;
        if (sample.timeMs - this.startCandidate.timeMs >= START_HOLD_MS) {
          this.pouring = true;
          const startedAt = this.startCandidate;
          this.startCandidate = null;
          this.stopCandidate = null;
          return { type: 'pour-start', sample: startedAt };
        }
      } else {
        this.startCandidate = null;
      }
      return null;
    }

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
