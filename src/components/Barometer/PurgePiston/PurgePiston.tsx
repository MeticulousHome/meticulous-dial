import { useEffect, useRef } from 'react';
import lottie, { AnimationItem, AnimationSegment } from 'lottie-web';
import './piston.css';
import piston from './piston.json';
import blink from './blink.json';
import { useAppSelector } from '../../store/hooks';
import { formatStatValue } from '../../../utils';

const TOTAL_FRAMES = 59;
const MAX_POSITION = 78.63;

export function PurgePiston(): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const { actuators } = stats;
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);
  const blinkContainer = useRef<AnimationItem | null>(null);
  const blinkAnimator = useRef(null);

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
    const total = (actuators.m_pos / MAX_POSITION) * TOTAL_FRAMES;
    const segments: AnimationSegment = [
      total,
      total > TOTAL_FRAMES ? TOTAL_FRAMES : total + 1
    ];

    pistonContainer.current.playSegments(segments, true);
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
