import { useCallback, useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import piston from './miniPiston.json';
import { CSSTransition } from 'react-transition-group';
import './pistonTransitions.css';

import { usePistonPosContext } from '../../context/PistonPositionContext';

// This is not absolute max but the maximum we choose for the sake of animation
const MAX_POSITION = 74;
const TOTAL_FRAMES = 60.0;
const NO_FRAMES = 1000;

export function MiniPurgePiston({ show }): JSX.Element {
  const pistonContainer = useRef<AnimationItem | null>(null);
  const pistonAnimator = useRef(null);

  const [initialPosition, setInitialPosition] = useState<number | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [prevTime, setPrevTime] = useState<number | null>(null);
  const { PistonPos: position } = usePistonPosContext();
  const [showPiston, setShowPiston] = useState<boolean>(show);

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
    if (show) {
      setTimeout(() => {
        setShowPiston(true);
      }, 500);
    } else {
      setShowPiston(false);
    }
  }, [show]);

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
    return () => {
      pistonContainer.current?.destroy();
      pistonContainer.current = undefined;
    };
  }, []);

  const transitionRef = useRef(null);

  return (
    <CSSTransition
      classNames="piston-fade"
      timeout={500}
      in={showPiston}
      nodeRef={transitionRef}
    >
      <div
        ref={transitionRef}
        className={showPiston ? '' : 'piston-fade-enter'}
      >
        <div id="piston" ref={pistonAnimator} />
      </div>
    </CSSTransition>
  );
}
