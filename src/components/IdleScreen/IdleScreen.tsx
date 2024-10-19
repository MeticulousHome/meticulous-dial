import { useEffect, useState } from 'react';

import './IdleScreen.css';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useUpdateNetworkConfig, useNetworkConfig } from '../../hooks/useWifi';

function formatTime() {
  const time = new Date();
  const localeString = time.toLocaleTimeString().toUpperCase();
  // This would be the perfect usecase for a regenx. But it is somehow significantly slower :C
  const am = localeString.includes('AM') && 'AM';
  const pm = localeString.includes('PM') && 'PM';
  const midday = am || pm || 'PM';
  return {
    hours: midday ? time.getHours() % 12 : time.getHours(),
    minutes: time.getMinutes(),
    seconds: time.getSeconds(),
    midday: midday
  };
}

export function IdleScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const [time, setTime] = useState(formatTime());
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const temperature = useAppSelector((state) => state.stats.sensors.t);

  const { data: networkConfig, refetch } = useNetworkConfig();
  const updateNetworkConfigMutation = useUpdateNetworkConfig();

  useEffect(() => {
    refetch();
  }, [updateNetworkConfigMutation.status]);

  const isWifiConnected = networkConfig?.status.connected;

  const UpdateTime = () => {
    setTime(formatTime());
  };
  setInterval(UpdateTime, 250);

  useEffect(() => {
    if (shouldGoToIdle) {
      return;
    }
    dispatch(setScreen(prevScreen || 'pressets'));
  }, [shouldGoToIdle]);

  return (
    <div className="idle-wrapper">
      <div className="indicators indicators-top">
        {isWifiConnected ? (
          <img className="indicators-icon" src={'assets/wifi.png'} alt="wifi" />
        ) : (
          <img
            className="indicators-icon"
            src={'assets/no-wifi.png'}
            alt="wifi"
          />
        )}
        {isWifiConnected ? 'Ready' : 'Not connected'}
      </div>
      <div className="clock-wrapper">
        <div className="clock">{time.hours.toString().padStart(2, '0')}</div>
        <div className="clock"> {time.minutes.toString().padStart(2, '0')}</div>
        <div className="clock midday">{time.midday}</div>
      </div>
      <div className="indicators indicators-bottom">
        <img
          className="indicators-icon"
          src={'assets/temperature.png'}
          alt="temperature"
        />
        {parseInt(temperature).toString().padStart(2, '0')}°C
      </div>
    </div>
  );
}
