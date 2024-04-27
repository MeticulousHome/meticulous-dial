import { useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import './piston.css';
import piston from './piston.json';
import blink from './blink.json';
import { useAppSelector } from '../../store/hooks';
import { formatStatValue } from '../../../utils';

const TOTAL_FRAMES = 59;
const MAX_POSITION = 78.63;
const TRANSITION_DURATION = 500;

export function PurgePiston(): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const { actuators } = stats;
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);
  const blinkContainer = useRef<AnimationItem | null>(null);
  const blinkAnimator = useRef(null);
  const [currentPosition, setCurrentPosition] = useState(0);

  useEffect(() => {
    blinkContainer.current = lottie.loadAnimation({
      container: blinkAnimator.current,
      animationData: blink,
      renderer: 'svg',
      loop: true,
      autoplay: true
    });
  }, []);

  useEffect(() => {
    pistonContainer.current = lottie.loadAnimation({
      container: pistonAnimator.current,
      animationData: piston,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      rendererSettings: {
        progressiveLoad: true
      }
    });
  }, []);

  useEffect(() => {
    const targetPosition = (actuators.m_pos / MAX_POSITION) * TOTAL_FRAMES;
    const startPosition = currentPosition;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / TRANSITION_DURATION, 1);
      const interpolatedPosition =
        startPosition + (targetPosition - startPosition) * progress;

      pistonContainer.current.goToAndStop(interpolatedPosition, true);
      setCurrentPosition(interpolatedPosition);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [actuators]);

  return (
    <div className="piston-purge-container center">
      <div className="values">
        <div className="value">
          {formatStatValue(stats.sensors.p, 1)}
          <span>bar</span>
        </div>
        <div
          id="blink"
          ref={blinkAnimator}
          className="lottie"
          style={{ top: -3 }}
        />
        <div id="piston" ref={pistonAnimator} className="lottie" />
        <div className="value">
          {formatStatValue(stats.sensors.f, 1)}
          <span>ml/s</span>
        </div>
        <div style={{ position: 'absolute', bottom: 10, color: 'red' }}>
          {stats.actuators.m_pos}
        </div>
      </div>
    </div>
  );
}
