import { useCallback, useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import piston from './piston.json';
import blink from './blink.json';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../../../src/components/store/features/screens/screens-slice';

// This is not absolute max but the maximum we choose for the sake of animation
const MAX_POSITION = 74;
const TOTAL_FRAMES = 60.0;
const NO_FRAMES = 1000;

export function PurgePiston(): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const position = useAppSelector((state) => state.stats.sensorData.m_pos);
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);
  const blinkContainer = useRef<AnimationItem | null>(null);
  const blinkAnimator = useRef(null);

  const [initialPosition, setInitialPosition] = useState<number | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const intervalRef = useRef(null);
  const rafIdRef = useRef<number | null>(null);

  const dispatch = useAppDispatch();

  const animateToPosition = useCallback((targetPosition: number) => {
    if (pistonContainer.current) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

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
          rafIdRef.current = null;
          return;
        }

        pistonContainer.current?.goToAndStop(clampedPosition, true);

        if (progress < 1) {
          rafIdRef.current = requestAnimationFrame(animate);
        } else {
          rafIdRef.current = null;
        }
      };

      rafIdRef.current = requestAnimationFrame(animate);
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

    if (stats.name === 'home') {
      blinkAnimator.current.style.top = '-206.5px';
    }
  }, []);

  const initAnimation = (initial: number) => {
    setInitialPosition(initial);
    pistonContainer.current = lottie.loadAnimation({
      container: pistonAnimator.current,
      animationData: piston,
      renderer: 'canvas',
      loop: false,
      autoplay: false
    });

    pistonContainer.current.goToAndStop(
      (initial / TOTAL_FRAMES) * NO_FRAMES,
      false
    );
  };

  useEffect(() => {
    if (Number.isNaN(position) || position < 0) {
      return;
    }

    let myPosition = position;

    if (myPosition > MAX_POSITION) {
      myPosition = MAX_POSITION;
    }

    const currentPosition = (myPosition / MAX_POSITION) * TOTAL_FRAMES;

    if (!pistonContainer.current) {
      initAnimation(currentPosition);
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
    // If we didnt get a position within 2 seconds we exit the animation
    intervalRef.current = setInterval(() => {
      if (Number.isNaN(position)) {
        dispatch(setScreen('profileHome'));
      }
    }, 2000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [position]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pistonContainer.current?.destroy();
      pistonContainer.current = undefined;
      blinkContainer.current?.destroy();
      blinkContainer.current = undefined;
    };
  }, []);

  return (
    <div>
      <div id="blink" ref={blinkAnimator} className="lottie" />
      <div id="piston" ref={pistonAnimator} className="lottie" />
    </div>
  );
}
