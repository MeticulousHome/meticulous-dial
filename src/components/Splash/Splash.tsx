import { useEffect, useRef } from 'react';
import Lottie, { AnimationItem } from 'lottie-web';
import BounceAnimation from './BounceAnimation.json';
import LogoAnimation from './LogoAnimation.json';
import './Splash.css';

export function Splash({
  onAnimationFinished
}: {
  onAnimationFinished: () => boolean;
}): JSX.Element {
  const ballAnimation = useRef<AnimationItem | null>(null);
  const ballDiv = useRef<HTMLDivElement | null>(null);

  const logoAnimation = useRef<AnimationItem | null>(null);
  const logoDiv = useRef<HTMLDivElement | null>(null);

  function handleLogoAnimationCompleted(): void {
    const startSecondAnimation = onAnimationFinished();

    if (startSecondAnimation) {
      // wait 100ms on the static image before starting the animation
      setTimeout(() => {
        // Unhide the bouncing
        if (ballDiv.current) {
          ballDiv.current.style.display = 'block';
        }
        // The logo ball is removed on the last frame, lets go there
        logoAnimation.current.goToAndStop(59, true);
        // Plaaaaaaaaaaaaaaaaay!!!!
        ballAnimation.current.goToAndPlay(12.9, true);
      }, 100);
    }
  }

  useEffect(() => {
    if (!logoAnimation.current) {
      logoAnimation.current = Lottie.loadAnimation({
        container: logoDiv.current,
        animationData: LogoAnimation,
        renderer: 'svg',
        loop: false,
        autoplay: false
      });
      logoAnimation.current.setSpeed(0.75);
      logoAnimation.current.addEventListener(
        'complete',
        handleLogoAnimationCompleted
      );
      logoAnimation.current.setSegment(0, 59);
      setTimeout(() => {
        logoAnimation.current.play();
      }, 100);
    }
    if (!ballAnimation.current) {
      ballAnimation.current = Lottie.loadAnimation({
        container: ballDiv.current,
        animationData: BounceAnimation,
        renderer: 'svg',
        loop: true,
        autoplay: false
      });
      ballAnimation.current.setSubframe(true);
    }
    ballDiv.current.style.display = 'none';
  }, [ballDiv]);

  return (
    <div className="splash-container center">
      <div id="splash-logo" ref={logoDiv} className="logo" />
      <div id="splash-bounce" ref={ballDiv} className="ball" />
    </div>
  );
}
