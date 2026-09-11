import { subscribeLocalTime } from '../../utils/localTime.ts';
import type {
  LocalTimeSample,
  TimeSourceOptions
} from '../../utils/localTime.ts';

const MILLISECONDS_PER_DAY = 86_400_000;

export function millisecondsSinceMidnight(sample: LocalTimeSample): number {
  return (
    sample.hour * 3_600_000 +
    sample.minute * 60_000 +
    sample.second * 1000 +
    sample.millisecond
  );
}

export function advanceLocalTime(sampleMs: number, elapsedMs: number): number {
  return (
    (((sampleMs + elapsedMs) % MILLISECONDS_PER_DAY) + MILLISECONDS_PER_DAY) %
    MILLISECONDS_PER_DAY
  );
}

// Each frame uses only numeric arithmetic and the caller's cached transforms,
// without allocating Date or time objects.
export function startAnalogClock({
  renderTime,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
  ...source
}: TimeSourceOptions & {
  renderTime: (milliseconds: number) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}): () => void {
  let active = true;
  let sampleMs: number | null = null;
  let sampledAt = 0;
  let frameId: number;

  const unsubscribe = subscribeLocalTime({
    ...source,
    now,
    onTime: (sample, timestamp) => {
      sampleMs = millisecondsSinceMidnight(sample);
      sampledAt = timestamp;
    }
  });

  const animate = () => {
    if (!active) return;
    if (sampleMs !== null)
      renderTime(advanceLocalTime(sampleMs, now() - sampledAt));
    frameId = requestFrame(animate);
  };
  frameId = requestFrame(animate);
  return () => {
    active = false;
    cancelFrame(frameId);
    unsubscribe();
  };
}
