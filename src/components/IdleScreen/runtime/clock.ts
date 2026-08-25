import type { IdleDigitalTimeLayer } from './types';

export function computeAnalogRotation(
  date: Date,
  unit: 'hour' | 'minute' | 'second',
  smooth: boolean
): number {
  const milliseconds = smooth ? date.getMilliseconds() : 0;
  const seconds = date.getSeconds() + milliseconds / 1000;
  const minutes = date.getMinutes() + (smooth ? seconds / 60 : 0);
  const hours = (date.getHours() % 12) + minutes / 60;
  if (unit === 'hour') return hours * 30;
  if (unit === 'minute') return minutes * 6;
  return (smooth ? seconds : Math.floor(seconds)) * 6;
}

export function formatDigitalTime(
  date: Date,
  template: IdleDigitalTimeLayer['template'],
  hourMode: IdleDigitalTimeLayer['hourMode']
): string {
  const use12 =
    hourMode === '12' || (hourMode === 'locale' && localeUses12Hour(date));
  const rawHour = date.getHours();
  const hour = use12 ? ((rawHour + 11) % 12) + 1 : rawHour;
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');
  const hourText = hour.toString().padStart(2, '0');
  const midday = rawHour < 12 ? 'AM' : 'PM';

  if (template === 'stackedHM') {
    return `${hourText}\n${minute}${use12 ? `\n${midday}` : ''}`;
  }
  if (template === 'HH:mm') {
    return `${rawHour.toString().padStart(2, '0')}:${minute}`;
  }
  if (template === 'HH:mm:ss') {
    return `${rawHour.toString().padStart(2, '0')}:${minute}:${second}`;
  }
  if (template === 'hh:mm a') return `${hourText}:${minute} ${midday}`;
  return `${hourText}:${minute}:${second} ${midday}`;
}

function localeUses12Hour(date: Date): boolean {
  return /AM|PM/i.test(date.toLocaleTimeString());
}
