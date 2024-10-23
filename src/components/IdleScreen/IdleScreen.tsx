import { useEffect, useRef, useState } from 'react';

import { setBrightness } from '../../api/api';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useNetworkConfig, useUpdateNetworkConfig } from '../../hooks/useWifi';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './IdleScreen.css';
import Lottie, { AnimationItem } from 'lottie-web';

import MetCat from './MetCat.json';

function formatTime() {
  const time = new Date();
  const localeString = time.toLocaleTimeString().toUpperCase();
  // This would be the perfect usecase for a regex. But it is somehow significantly slower :C
  const am = localeString.includes('AM') && 'AM';
  const pm = localeString.includes('PM') && 'PM';
  const midday = am || pm;
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

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig();

  const animation = useRef<AnimationItem | null>(null);
  const animationDiv = useRef<HTMLDivElement | null>(null);

  const useMetCat = true;

  useEffect(() => {
    refetchNetworkConfig();
    setBrightness({ brightness: 0 });
    const intervalId = setInterval(() => setTime(formatTime()), 250);

    return () => {
      setBrightness({ brightness: 1 });
      clearInterval(intervalId);
      animation.current?.destroy();
    };
  }, []);

  const isWifiConnected = networkConfig?.status.connected;

  useEffect(() => {
    if (shouldGoToIdle) {
      return;
    }
    setBrightness({ brightness: 1 });
    dispatch(setScreen(prevScreen || 'pressets'));
  }, [shouldGoToIdle]);

  useEffect(() => {
    if (!animation.current) {
      animation.current = Lottie.loadAnimation({
        container: animationDiv.current,
        animationData: MetCat,
        renderer: 'svg',
        loop: false,
        autoplay: false
      });
      animation.current.playSegments(
        [
          [0, 120],
          [120, 313]
        ],
        true
      );

      animation.current.addEventListener('segmentStart', () => {
        animation.current.setSegment(120, 313);
        animation.current.loop = true;
      });
    }
  }, [animationDiv]);

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
      {useMetCat ? (
        <div className="clock-wrapper">
          <div className="clock miniclock">
            {time.hours.toString().padStart(2, '0')}:
            {time.minutes.toString().padStart(2, '0')}
          </div>
          <div className="metcat" ref={animationDiv} />
        </div>
      ) : (
        <div className="clock-wrapper">
          <div className="clock">{time.hours.toString().padStart(2, '0')}</div>
          <div className="clock">
            {' '}
            {time.minutes.toString().padStart(2, '0')}
          </div>
          <div className="clock midday">{time.midday}</div>
        </div>
      )}
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
