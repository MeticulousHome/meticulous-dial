import { useEffect, useRef, useState } from 'react';

import { setBrightness } from '../../api/api';
import { useNetworkConfig } from '../../hooks/useWifi';
import Lottie, { AnimationItem } from 'lottie-web';
import './DigitalClock.css';
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

export function DigitalClock({
  useMetCat
}: {
  useMetCat: boolean;
}): JSX.Element {
  const [time, setTime] = useState(formatTime());

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig();

  const animation = useRef<AnimationItem | null>(null);
  const animationDiv = useRef<HTMLDivElement | null>(null);

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
    </div>
  );
}
