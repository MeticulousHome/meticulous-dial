/**
 * Pure target logic for the manual brew barometer.
 *
 * The target is the machine's streamed setpoint, held in integer tenths of a
 * bar so that repeated frames compare exactly and the trail only records real
 * changes. Nothing in this module touches React or the DOM, which keeps it
 * directly testable from `tests/manualTarget.test.mts`.
 */

export const MANUAL_MIN_TENTHS = 0;
export const MANUAL_MAX_TENTHS = 120;
export const TRAIL_WINDOW_MS = 400;
export const TRAIL_HISTORY_MS = 2000;

export const clampTenths = (tenths: number): number =>
  Math.max(MANUAL_MIN_TENTHS, Math.min(MANUAL_MAX_TENTHS, tenths));

export const toTenths = (bar: number): number => Math.round(bar * 10);

export const toBar = (tenths: number): number => tenths / 10;

export interface TargetSample {
  tenths: number;
  t: number;
}

/**
 * Appends a target sample, ignoring repeats, and trims history older than
 * `TRAIL_HISTORY_MS`. The most recent sample is always retained so the trail
 * still knows where the target currently sits after a long idle period.
 */
export const pushSample = (
  history: TargetSample[],
  tenths: number,
  now: number
): TargetSample[] => {
  const last = history[history.length - 1];
  const next =
    last && last.tenths === tenths
      ? history.slice()
      : [...history, { tenths, t: now }];

  const cutoff = now - TRAIL_HISTORY_MS;
  const trimmed = next.filter((sample) => sample.t >= cutoff);

  return trimmed.length > 0 ? trimmed : next.slice(-1);
};

export interface Trail {
  fromTenths: number;
  toTenths: number;
}

/**
 * Describes the sweep to paint behind the target tick. The faster the user
 * turns, the further back `from` sits inside the trail window, so the trail
 * lengthens with speed. It does not fade: once turning stops the window slides
 * forward and `from` catches up with `to`, so the tail retracts into the marker
 * and this returns null.
 */
export const computeTrail = (
  history: TargetSample[],
  now: number
): Trail | null => {
  if (history.length === 0) {
    return null;
  }

  const last = history[history.length - 1];
  const toTenths = last.tenths;
  const windowStart = now - TRAIL_WINDOW_MS;

  let fromTenths = history[0].tenths;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t <= windowStart) {
      fromTenths = history[i].tenths;
      break;
    }
  }

  if (fromTenths === toTenths) {
    return null;
  }

  return { fromTenths, toTenths };
};
