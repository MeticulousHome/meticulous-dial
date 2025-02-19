import Lottie, { AnimationItem } from 'lottie-web';
import { useEffect, useRef } from 'react';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import './ReadyAnimation.css';

import LoadingAnimation from './LoadingAnimation.json';
import ReadyAnimation1Data from './ReadyAnimation1.json';
import ReadyAnimation2Data from './ReadyAnimation2.json';
import { useFetchData } from '../../hooks/useFetchData';

export function ReadyAnimation(): JSX.Element {
  const dispatch = useAppDispatch();

  const animation = useRef<AnimationItem | null>(null);
  const animationDiv = useRef<HTMLDivElement | null>(null);

  function handleReadyAnimation2Completed(): void {
    animation.current?.destroy();
    dispatch(setScreen('profileHome'));
  }

  function handleReadyAnimation1Completed(): void {
    animation.current?.destroy();
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
    animation.current?.destroy();
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
      animation.current?.destroy();
    };
  }, [animationDiv]);

  return (
    <div className="ready-container center">
      <div id="animation" ref={animationDiv} className="animation" />
    </div>
  );
}
