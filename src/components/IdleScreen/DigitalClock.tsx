import { useEffect, useState } from 'react';

import { setBrightness } from '../../api/api';
import { useNetworkConfig } from '../../hooks/useWifi';
import { useSettings } from '../../hooks/useSettings';

import { MetCatClock } from './MetCatClock';
import { DigitalClockBase } from './DigitalClockBase';
import './DigitalClock.css';

export function formatTime(use24Hour = true, time = new Date()) {
  const hours = time.getHours();
  return {
    hours: use24Hour ? hours : ((hours + 11) % 12) + 1,
    minutes: time.getMinutes(),
    seconds: time.getSeconds(),
    midday: use24Hour ? '' : hours < 12 ? 'AM' : 'PM'
  };
}

export function DigitalClock({
  useMetCat
}: {
  useMetCat: boolean;
}): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  const { data: settings } = useSettings({ idle: true });
  const time = formatTime(settings?.clock_format_24_hour ?? true, now);

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig({ idle: true });

  useEffect(() => {
    refetchNetworkConfig();
    setBrightness({ brightness: 0 });
    const intervalId = setInterval(() => setNow(new Date()), 250);

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
