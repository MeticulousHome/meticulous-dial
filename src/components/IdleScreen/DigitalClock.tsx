import { useEffect, useState } from 'react';

import { useNetworkConfig } from '../../hooks/useWifi';
import { useSettings } from '../../hooks/useSettings';

import { MetCatClock } from './MetCatClock';
import { DigitalClockBase } from './DigitalClockBase';
import {
  formatTime,
  startDigitalClock,
  uses24HourClock
} from './digitalClockTime';
import './DigitalClock.css';

export function DigitalClock({
  useMetCat
}: {
  useMetCat: boolean;
}): JSX.Element {
  const [milliseconds, setMilliseconds] = useState<number | null>(null);
  const { data: settings } = useSettings({ idle: true });
  const time =
    milliseconds === null
      ? null
      : formatTime(uses24HourClock(settings), milliseconds);

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig({ idle: true });

  useEffect(() => {
    refetchNetworkConfig();
    const stopClock = startDigitalClock({
      renderTime: setMilliseconds,
      onError: (error) => console.error('Failed to read OS local time', error)
    });

    return () => {
      stopClock();
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
      {time && <ClockComponent time={time} />}
    </div>
  );
}
