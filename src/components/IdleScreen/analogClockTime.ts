const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getTimezoneOffsetMs(timestampMs: number): number {
  return new Date(timestampMs).getTimezoneOffset() * MILLISECONDS_PER_MINUTE;
}

export function getLocalClockTime(
  timestampMs: number,
  timezoneOffsetMs: number
) {
  const unwrappedLocalTimeMs = timestampMs - timezoneOffsetMs;
  const localTimeMs =
    ((unwrappedLocalTimeMs % MILLISECONDS_PER_DAY) + MILLISECONDS_PER_DAY) %
    MILLISECONDS_PER_DAY;
  const totalSeconds = localTimeMs / 1000;
  const totalMinutes = totalSeconds / 60;

  return {
    seconds: totalSeconds % 60,
    minutes: totalMinutes % 60,
    hours: (totalMinutes / 60) % 12
  };
}
