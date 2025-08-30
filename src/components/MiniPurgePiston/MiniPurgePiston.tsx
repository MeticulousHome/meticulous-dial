import { useCallback, useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import piston from './miniPiston.json';
import { useAppDispatch } from '../store/hooks';
import { setScreen } from '../../../src/components/store/features/screens/screens-slice';
import { useSocket } from '../../../src/components/store/SocketManager';

// This is not absolute max but the maximum we choose for the sake of animation
const MAX_POSITION = 74;
const TOTAL_FRAMES = 60.0;
const NO_FRAMES = 1000;

export function MiniPurgePiston(): JSX.Element {
  const socket = useSocket();
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);

  const [initialPosition, setInitialPosition] = useState<number | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const [position, setPosition] = useState<number>(NaN);
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
    socket.on('sensors', (data: { m_pos: number }) => {
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
    if (Number.isNaN(position)) {
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
      pistonContainer.current?.destroy();
      pistonContainer.current = undefined;
    };
  }, []);

  return <div id="piston" ref={pistonAnimator} />;
}
