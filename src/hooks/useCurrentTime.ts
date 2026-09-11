import { useState, useEffect } from 'react';
import { subscribeLocalTime } from '../utils/localTime';
import type { LocalTimeSample } from '../utils/localTime';

export function useCurrentTime() {
  const [time, setTime] = useState<LocalTimeSample | null>(null);

  useEffect(() => {
    return subscribeLocalTime({
      onTime: setTime,
      onError: (error) => console.error('Failed to read OS local time', error)
    });
  }, []);

  return {
    hours: time ? time.hour.toString().padStart(2, '0') : '--',
    minutes: time ? time.minute.toString().padStart(2, '0') : '--',
    day: time ? time.day.toString().padStart(2, '0') : '--',
    month: time ? time.month.toString().padStart(2, '0') : '--',
    year: time ? time.year.toString() : '----'
  };
}
