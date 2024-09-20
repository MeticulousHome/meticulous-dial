import { useEffect, useRef } from 'react';
import Lottie, { AnimationItem } from 'lottie-web';
import BounceAnimation from './BounceAnimation.json';
import './Splash.css';

export function Splash({
  onAnimationFinished
}: {
  onAnimationFinished: () => boolean;
}): JSX.Element {
  const ballAnimation = useRef<AnimationItem | null>(null);
  const ballDiv = useRef<HTMLDivElement | null>(null);

  function handleLogoAnimationCompleted(): void {
    onAnimationFinished();
  }

  useEffect(() => {
    if (!ballAnimation.current) {
      ballAnimation.current = Lottie.loadAnimation({
        container: ballDiv.current,
        animationData: BounceAnimation,
        renderer: 'svg',
        loop: true,
        autoplay: false
      });
      ballAnimation.current.setSubframe(true);
      ballAnimation.current.addEventListener(
        'loopComplete',
        handleLogoAnimationCompleted
      );
      // Plaaaaaaaaaaaaaaaaay!!!!
      ballAnimation.current.goToAndPlay(12.9, true);
    }
  }, [ballDiv]);

  useEffect(() => {
    return () => {
      ballAnimation.current?.destroy();
    };
  }, []);

  return (
    <div className="splash-container center">
      <div id="splash-bounce" ref={ballDiv} className="ball" />
    </div>
  );
}
