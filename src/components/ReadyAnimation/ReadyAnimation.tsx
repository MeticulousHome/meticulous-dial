import Lottie, { AnimationItem } from 'lottie-web';
import { useEffect, useRef } from 'react';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import './ReadyAnimation.css';

import LoadingAnimation from './LoadingAnimation.json';
import ReadyAnimation1Data from './ReadyAnimation1.json';
import ReadyAnimation2Data from './ReadyAnimation2.json';
import { useFetchData } from '../../hooks/useFetchData';
import { useSettings } from '../../hooks/useSettings';
import { resolvePostReadyScreen } from '../ShotDataSharing/postReadyScreen';
import { loadNotifications } from '../store/features/notifications/notification-slice';
import { invoke } from '@tauri-apps/api/core';

export function ReadyAnimation(): JSX.Element {
  const dispatch = useAppDispatch();

  const animation = useRef<AnimationItem | null>(null);
  const animationDiv = useRef<HTMLDivElement | null>(null);
  const destroyedRef = useRef(false);
  const animationStartedRef = useRef(false);
  // Settings are polled while the animation plays so the decision below sees
  // the latest value without waiting on a request.
  const { data: settings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  function handleReadyAnimation2Completed(): void {
    animation.current?.destroy();
    animation.current = undefined;
    if ('__TAURI_INTERNALS__' in window) {
      invoke('home_ready').catch((error) => {
        console.error('Failed to report profile home ready:', error);
      });
    }
    if (destroyedRef.current) return;
    dispatch(setScreen(resolvePostReadyScreen(settingsRef.current)));
    dispatch(loadNotifications());
  }

  function handleReadyAnimation1Completed(): void {
    animation.current?.destroy();
    animation.current = undefined;
    if (destroyedRef.current) return;
    animation.current = Lottie.loadAnimation({
      container: animationDiv.current,
      animationData: ReadyAnimation2Data,
      renderer: 'svg',
      loop: false,
      autoplay: true
    });
    animation.current.setSubframe(true);
    animation.current.addEventListener(
      'complete',
      handleReadyAnimation2Completed
    );
  }

  function finishLoadingAnimation(): void {
    if (animationStartedRef.current) return;
    animationStartedRef.current = true;
    animation.current?.destroy();
    animation.current = undefined;
    if (destroyedRef.current) return;
    animation.current = Lottie.loadAnimation({
      container: animationDiv.current,
      animationData: ReadyAnimation1Data,
      renderer: 'svg',
      loop: false,
      autoplay: true
    });
    animation.current.setSubframe(true);
    animation.current.addEventListener(
      'complete',
      handleReadyAnimation1Completed
    );
  }

  useFetchData(() => {
    finishLoadingAnimation();
  });

  useEffect(() => {
    if (!animationDiv.current) {
      return;
    }

    if (!animation.current) {
      animation.current = Lottie.loadAnimation({
        container: animationDiv.current,
        animationData: LoadingAnimation,
        renderer: 'svg',
        loop: true,
        autoplay: false
      });
      animation.current.firstFrame = 380;
      animation.current.totalFrames = 150;

      animation.current.goToAndPlay(3, true);
    }
    return () => {
      destroyedRef.current = true;
      animation.current?.destroy();
      animation.current = undefined;
    };
  }, [animationDiv]);

  return (
    <div className="ready-container center">
      <div id="animation" ref={animationDiv} className="animation" />
    </div>
  );
}
