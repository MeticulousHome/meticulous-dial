import { startAnalogClock } from './analogClockTime.ts';

// Often enough for the shown minute to turn over on time between native reads.
const REFRESH_MS = 250;

// Until the settings load, or with a backend that does not send it, the clock
// follows the backend's default for clock_format_24_hour: 24-hour.
export function uses24HourClock(
  settings?: { clock_format_24_hour?: boolean } | null
): boolean {
  return settings?.clock_format_24_hour ?? true;
}

// Takes the milliseconds since local midnight of the OS time rather than a
// Date, whose timezone can be stale in the machine's JavaScriptCore.
export function formatTime(use24Hour: boolean, milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  return {
    hours: use24Hour ? hours : ((hours + 11) % 12) + 1,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
    midday: use24Hour ? '' : hours < 12 ? 'AM' : 'PM'
  };
}

// The analog clock's OS local time, redrawn on a timer instead of on every
// animation frame because the digital clock only changes once per second.
export function startDigitalClock(
  options: Parameters<typeof startAnalogClock>[0]
): () => void {
  return startAnalogClock({
    requestFrame: (callback) => window.setTimeout(callback, REFRESH_MS),
    cancelFrame: (id) => window.clearTimeout(id),
    ...options
  });
}
