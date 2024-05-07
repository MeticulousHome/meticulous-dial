import { useCallback, useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web-light';
import './piston.css';
import piston from './piston.json';
import blink from './blink.json';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { formatStatValue } from '../../../utils';
import { setScreen } from '../../../../src/components/store/features/screens/screens-slice';
import { useSocket } from '../../../../src/components/store/SocketManager';

const MAX_POSITION = 83;
const TOTAL_FRAMES = 60.0;
const NO_FRAMES = 1000;

export function PurgePiston(): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const socket = useSocket();
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);
  const blinkContainer = useRef<AnimationItem | null>(null);
  const blinkAnimator = useRef(null);

  const [initialPosition, setInitialPosition] = useState<number | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const firstTime = useRef<boolean>(true);
  const statusFirstName = useRef<boolean>(true);
  const prevStatus = useRef<string>('');
  const [position, setPosition] = useState<number>(-1);
  const intervalRef = useRef(null);

  const dispatch = useAppDispatch();

  const animateToPosition = useCallback((targetPosition: number) => {
    if (pistonContainer.current) {
      const startPosition = pistonContainer.current.currentRawFrame;
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / 200, 1);

        const newPosition =
          startPosition + (targetPosition - startPosition) * progress;

        const clampedPosition = Math.max(
          0,
          Math.min(newPosition, TOTAL_FRAMES)
        );

        if (clampedPosition > TOTAL_FRAMES) {
          return;
        }

        pistonContainer.current?.goToAndStop(clampedPosition, true);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, []);

  useEffect(() => {
    blinkContainer.current = lottie.loadAnimation({
      container: blinkAnimator.current,
      animationData: blink,
      renderer: 'svg',
      loop: true,
      autoplay: true
    });

    socket.on('actuators', (data: { m_pos: number }) => {
      if (data.m_pos < 0) {
        return;
      }
      setPosition(data.m_pos);
    });
  }, []);

  const initAnimation = (initial: number) => {
    setInitialPosition(initial);
    pistonContainer.current = lottie.loadAnimation({
      container: pistonAnimator.current,
      animationData: piston,
      renderer: 'svg',
      loop: false,
      autoplay: false
    });

    pistonContainer.current.goToAndStop(
      (initial / TOTAL_FRAMES) * NO_FRAMES,
      false
    );
  };

  useEffect(() => {
    if (position === -1) {
      return;
    }

    let myPosition = position;

    if (myPosition <= 0) {
      statusFirstName.current = false;
      intervalRef.current = setInterval(() => {
        if (pistonContainer.current) {
          clearInterval(intervalRef.current);
        }

        if (!pistonContainer.current) {
          initAnimation(0);
        }
      }, 100);

      return;
    }

    if (myPosition > MAX_POSITION) {
      myPosition = MAX_POSITION;
    }

    const currentPosition = (myPosition / MAX_POSITION) * TOTAL_FRAMES;

    if (firstTime.current) {
      firstTime.current = false;
      statusFirstName.current = false;

      if (!pistonContainer.current) {
        initAnimation(currentPosition);
      }

      return;
    }

    if (
      initialPosition !== null &&
      prevPosition !== null &&
      prevTime !== null
    ) {
      animateToPosition(currentPosition);
    }

    setPrevPosition(currentPosition);
    setPrevTime(Date.now());
  }, [position, animateToPosition, initialPosition]);

  useEffect(() => {
    if (!statusFirstName.current) {
      if (prevStatus.current === 'home' || prevStatus.current === 'purge') {
        if (stats.name === 'idle') {
          dispatch(setScreen('pressets'));
        }
      }

      prevStatus.current = stats.name;
    }
  }, [stats.name]);

  return (
    <div className="piston-container">
      <div className="piston-purge-container center">
        <div className="values">
          <div className="value">
            {formatStatValue(stats.sensors.p, 1)}
            <span>bar</span>
          </div>
          <div id="blink" ref={blinkAnimator} className="lottie" />
          <div id="piston" ref={pistonAnimator} className="lottie" />
          <div className="value">
            {formatStatValue(stats.sensors.f, 1)}
            <span>ml/s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
