import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { useAppSelector } from '../store/hooks';
import './scale.css';
import { Fragment } from 'react/jsx-runtime';
import {
  motion,
  useAnimationControls,
  useMotionValue,
  Variants
} from 'framer-motion';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useRef, useState, useEffect, memo } from 'react';
import { RootState } from '../store/store';
import { useStore } from 'react-redux';
import { useSocket } from '../store/SocketManager';
import { ScreenType } from '../store/features/screens/screens-slice';

export interface scaleState {
  status: 'closed_cold' | 'closed_hot' | 'open';
  size: 'small' | 'full' | undefined;
}

const noScalePopUpScreens: ScreenType[] = [
  'calibrateScale',
  'freePour',
  'freePourHistory'
];

const Weight = () => {
  const weight = useAppSelector((state) => state.stats.sensors.w || 0);
  const scaleConnected = !isNaN(weight);
  const formatted = scaleConnected ? weight.toFixed(1) : '';
  const padded = formatted.padStart(5, '0');

  return (
    <div className="scale-weight">
      {scaleConnected ? (
        <div>
          <span className="weight">
            {padded.split('').map((char, i) => (
              <span
                key={i}
                className={
                  i < padded.length - formatted.length ? 'dimmed' : undefined
                }
              >
                {char}
              </span>
            ))}
          </span>
          <div className="weight-unit">g</div>
        </div>
      ) : (
        <div style={{ fontSize: '30px', color: '#f44336' }}>
          Scale not connected
        </div>
      )}
    </div>
  );
};

const LARGE_SCALE_PRESS_THRESHOLD = 0.7; // seconds

export const Scale = memo(
  ({
    updateScaleVisibility
  }: {
    updateScaleVisibility: (new_state: 'small' | 'full' | 'closed') => void;
  }) => {
    const store = useStore<RootState>();
    const isExtracting = useAppSelector((state) => state.stats?.extracting);
    const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
    const currentScreen = useAppSelector((state) => state.screen.value);

    const socket = useSocket();

    const coolDownTimeMS = 1 * 60 * 1000; // 1 minute
    const coolScaleTimer = useRef<NodeJS.Timeout | null>(null);
    const tareHoldThreshold = 250;
    const tareHoldThresholdTimer = useRef<NodeJS.Timeout | null>(null);

    const currentAnimation = useRef<'pull' | 'springMini' | null>(null);
    const scaleHideTimer = useRef<NodeJS.Timeout | null>(null);
    const [scaleState, setScaleState] = useState<scaleState>({
      status: 'closed_cold',
      size: undefined
    });

    const closeScale = () => {
      // avoid setting the state to closed_hot if called from closed_*
      if (scaleState.status === 'open') {
        coolScaleTimer.current = setTimeout(() => {
          setScaleState((prev) => ({
            ...prev,
            status: 'closed_cold'
          }));
        }, coolDownTimeMS);
        setScaleState({
          status: 'closed_hot',
          size: undefined
        });
        y.set(0);
      }
    };

    const openScale = (size: 'full' | 'small') => {
      clearTimeout(coolScaleTimer.current);
      setScaleState({
        status: 'open',
        size: size
      });
    };

    const controls = useAnimationControls();
    const y = useMotionValue(0);

    const animationVariants = {
      pull: {
        y: -20,
        transition: { duration: LARGE_SCALE_PRESS_THRESHOLD, ease: 'easeIn' }
      },
      springMini: {
        y: 0,
        transition: { type: 'spring', stiffness: 320, damping: 15 }
      }
    } as const satisfies Variants;

    const startAnimation = (animation: 'pull' | 'springMini' | null) => {
      controls.stop();
      console.log(`animation: ${animation} has started`);
      currentAnimation.current = animation;
      if (animation !== null) {
        controls.start(animation);
      }
    };

    const handleAnimationComplete = () => {
      console.log(`animation: ${currentAnimation.current} has ended`);
      y.set(0);
      switch (currentAnimation.current) {
        case 'pull':
          openScale('full');
          currentAnimation.current = null;
          break;
      }
    };

    useEffect(() => {
      const hide_timer = scaleState.size === 'small' ? 10000 : 2 * 60 * 10000;
      updateScaleVisibility(
        scaleState.status === 'open' ? scaleState.size : 'closed'
      );

      const scheduleHide = () => setTimeout(() => closeScale(), hide_timer);
      scaleHideTimer.current = scheduleHide();

      let lastSignificantWeight = store.getState().stats.sensors.w;
      const subscription = store.subscribe(() => {
        const weight = store.getState().stats.sensors.w;
        if (Math.abs(weight - lastSignificantWeight) > 2) {
          lastSignificantWeight = weight;
          clearTimeout(scaleHideTimer.current);
          scaleHideTimer.current = scheduleHide();
        }
      });

      return () => {
        clearTimeout(scaleHideTimer.current);
        subscription();
      };
    }, [scaleState]);

    useHandleGestures(
      {
        pressDown() {
          closeScale();
        },
        tareDown() {
          if (scaleHideTimer.current) {
            clearTimeout(scaleHideTimer.current);
          }
          tareHoldThresholdTimer.current = setTimeout(() => {
            if (scaleState.status !== 'open') {
              openScale('small');
            }
            if (scaleState.status !== 'open' || scaleState.size === 'small') {
              startAnimation('pull');
            }
          }, tareHoldThreshold);
        },
        tareUp() {
          if (tareHoldThresholdTimer.current) {
            clearTimeout(tareHoldThresholdTimer.current);
            tareHoldThresholdTimer.current = null;
          }
          // if we cancel the pull
          if (currentAnimation.current === 'pull') {
            controls.stop();
            startAnimation('springMini');
          }
        },
        singleTare() {
          switch (scaleState.status) {
            case 'closed_cold':
              openScale('small');
              socket.emit('action', 'tare');
              break;
            case 'open':
              socket.emit('action', 'tare');
              break;
            case 'closed_hot':
              console.log('from from hot, opening mini scale');
              openScale('small');
              break;
          }
        },
        doubleTare() {
          closeScale();
        },
        context() {
          closeScale();
        }
      },
      isExtracting ||
        bubbleDisplay.interceptsGesture ||
        noScalePopUpScreens.includes(currentScreen)
    );

    useHandleGestures(
      {
        tareDown() {
          socket.emit('action', 'tare');
        }
      },
      isExtracting ||
        bubbleDisplay.interceptsGesture ||
        !noScalePopUpScreens.includes(currentScreen)
    );

    useEffect(() => {
      if (isExtracting && scaleState.status === 'open') {
        closeScale();
      }
    }, [isExtracting]);

    return (
      <motion.div
        variants={animationVariants}
        style={{ y }}
        animate={controls}
        onAnimationComplete={handleAnimationComplete}
      >
        <SwitchTransition>
          <CSSTransition
            key={scaleState.status === 'open' ? 'off' : 'on'}
            in={scaleState.status === 'open'}
            timeout={300}
            classNames="animate"
          >
            {scaleState.status === 'open' ? (
              <div
                className={`scale-container scale-container--${scaleState.size}`}
              >
                <div className="main-layout-content">
                  <Weight />
                </div>
              </div>
            ) : (
              <Fragment />
            )}
          </CSSTransition>
        </SwitchTransition>
      </motion.div>
    );
  }
);
