import { useState, useEffect } from 'react';

export function useCurrentTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    hours: time.getHours().toString().padStart(2, '0'),
    minutes: time.getMinutes().toString().padStart(2, '0'),
    day: time.getDate().toString().padStart(2, '0'),
    month: (time.getMonth() + 1).toString().padStart(2, '0'),
    year: time.getFullYear().toString()
  };
}
