import { useEffect, useState } from 'react';

import { setBrightness } from '../../api/api';
import { useNetworkConfig } from '../../hooks/useWifi';
import { useSettings } from '../../hooks/useSettings';

import { MetCatClock } from './MetCatClock';
import { DigitalClockBase } from './DigitalClockBase';
import './DigitalClock.css';

export function formatTime(use24Hour?: boolean) {
  const time = new Date();
  const hours24 = time.getHours();
  
  let hours: number;
  let midday: string | undefined;
  
  if (use24Hour) {
    hours = hours24;
    midday = undefined;
  } else {
    const localeString = time.toLocaleTimeString().toUpperCase();
    // This would be the perfect usecase for a regex. But it is somehow significantly slower :C
    const am = localeString.includes('AM') && 'AM';
    const pm = localeString.includes('PM') && 'PM';
    midday = am || pm;
    hours = midday ? ((hours24 + 11) % 12) + 1 : hours24;
  }
  
  return {
    hours,
    minutes: time.getMinutes(),
    seconds: time.getSeconds(),
    midday
  };
}

export function DigitalClock({
  useMetCat
}: {
  useMetCat: boolean;
}): JSX.Element {
  const { data: globalSettings } = useSettings();
  const use24Hour = (globalSettings as any)?.clock_format_24_hour === true;
  const [time, setTime] = useState(formatTime(use24Hour));

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig();

  useEffect(() => {
    refetchNetworkConfig();
    setBrightness({ brightness: 0 });
    const intervalId = setInterval(() => setTime(formatTime(use24Hour)), 250);

    return () => {
      setBrightness({ brightness: 1 });
      clearInterval(intervalId);
    };
  }, [use24Hour]);

  const isWifiConnected = networkConfig?.status.connected;
  const ClockComponent = useMetCat ? MetCatClock : DigitalClockBase;

  return (
    <div className="idle-wrapper">
      <div className="indicators indicators-top">
        {isWifiConnected ? (
          <img className="indicators-icon" src={'/wifi.png'} alt="wifi" />
        ) : (
          <img className="indicators-icon" src={'/no-wifi.png'} alt="wifi" />
        )}
        {isWifiConnected ? 'Ready' : 'Not connected'}
      </div>
      {<ClockComponent time={time} />}
    </div>
  );
}
