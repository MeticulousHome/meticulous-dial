import Lottie, { AnimationItem } from 'lottie-web';
import { useEffect, useRef } from 'react';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import './ReadyAnimation.css';
import ReadyAnimationData from './ReadyAnimation.json';

export function ReadyAnimation(): JSX.Element {
  const dispatch = useAppDispatch();

  const readyAnimation = useRef<AnimationItem | null>(null);
  const readyDiv = useRef<HTMLDivElement | null>(null);

  function handleAnimationCompleted(): void {
    dispatch(setScreen('pressets'));
  }

  useEffect(() => {
    if (!readyAnimation.current) {
      readyAnimation.current = Lottie.loadAnimation({
        container: readyDiv.current,
        animationData: ReadyAnimationData,
        renderer: 'svg',
        loop: false,
        autoplay: true
      });
      readyAnimation.current.setSubframe(true);
      readyAnimation.current.addEventListener(
        'complete',
        handleAnimationCompleted
      );
    }
  }, [readyDiv]);

  return (
    <div className="ready-container center">
      <div id="animation" ref={readyDiv} className="animation" />
    </div>
  );
}
