import { useEffect, useState } from 'react';

import { setBrightness } from '../../api/api';
import { useNetworkConfig } from '../../hooks/useWifi';

import { MetCatClock } from './MetCatClock';
import { DigitalClockBase } from './DigitalClockBase';
import './DigitalClock.css';

export function formatTime() {
  const time = new Date();
  const localeString = time.toLocaleTimeString().toUpperCase();
  // This would be the perfect usecase for a regex. But it is somehow significantly slower :C
  const am = localeString.includes('AM') && 'AM';
  const pm = localeString.includes('PM') && 'PM';
  const midday = am || pm;
  return {
    hours: midday ? ((time.getHours() + 11) % 12) + 1 : time.getHours(),
    minutes: time.getMinutes(),
    seconds: time.getSeconds(),
    midday: midday
  };
}

export function DigitalClock({
  useMetCat
}: {
  useMetCat: boolean;
}): JSX.Element {
  const [time, setTime] = useState(formatTime());

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig({ idle: true });

  useEffect(() => {
    refetchNetworkConfig();
    setBrightness({ brightness: 0 });
    const intervalId = setInterval(() => setTime(formatTime()), 250);

    return () => {
      setBrightness({ brightness: 1 });
      clearInterval(intervalId);
    };
  }, []);

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
