import { useEffect, useRef } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import './piston.css';
import piston from './piston-2.json';
import { useAppSelector } from '../../store/hooks';
import { formatStatValue } from '../../../utils';

export function PurgePiston(): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);

  useEffect(() => {
    pistonContainer.current = lottie.loadAnimation({
      container: pistonAnimator.current,
      animationData: piston,
      renderer: 'svg',
      loop: false,
      autoplay: false
    });

    pistonContainer.current.addEventListener('enterFrame', (e) => {
      if (e.currentTime >= 52) {
        pistonContainer.current.setDirection(-1);
      }

      if (e.direction < 0 && e.currentTime <= 30) {
        pistonContainer.current.pause();
      }
    });

    pistonContainer.current.setSpeed(0.06);
    pistonContainer.current.play();
  }, []);

  return (
    <div className="piston-purge-container center">
      <div className="values">
        <div className="value">
          {formatStatValue(stats.sensors.p, 1)}
          <span>bar</span>
        </div>
        <div id="piston" ref={pistonAnimator} className="lottie" />
        <div className="value">
          {formatStatValue(stats.sensors.f, 1)}
          <span>ml/s</span>
        </div>
      </div>
    </div>
  );
}
