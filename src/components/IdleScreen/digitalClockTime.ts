// Until the settings load, or with a backend that does not send it, the clock
// follows the backend's default for clock_format_24_hour: 24-hour.
export function uses24HourClock(
  settings?: { clock_format_24_hour?: boolean } | null
): boolean {
  return settings?.clock_format_24_hour ?? true;
}

export function formatTime(use24Hour = true, time = new Date()) {
  const hours = time.getHours();
  return {
    hours: use24Hour ? hours : ((hours + 11) % 12) + 1,
    minutes: time.getMinutes(),
    seconds: time.getSeconds(),
    midday: use24Hour ? '' : hours < 12 ? 'AM' : 'PM'
  };
}
