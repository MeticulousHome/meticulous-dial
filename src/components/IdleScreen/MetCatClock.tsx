import { useEffect, useRef } from 'react';
import Lottie, { AnimationItem } from 'lottie-web';
import MetCat from './MetCat.json';
import { formatTime } from './DigitalClock';

export function MetCatClock({ time }: { time: ReturnType<typeof formatTime> }) {
  const animationDiv = useRef<HTMLDivElement | null>(null);
  const animation = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (animationDiv.current) {
      animation.current = Lottie.loadAnimation({
        container: animationDiv.current,
        animationData: MetCat,
        renderer: 'svg',
        loop: false,
        autoplay: false
      });

      animation.current.playSegments(
        [
          [0, 120],
          [120, 313]
        ],
        true
      );

      animation.current.addEventListener('segmentStart', () => {
        animation.current?.setSegment(120, 313);
        if (animation.current) animation.current.loop = true;
      });
    }

    return () => {
      animation.current?.destroy();
      animation.current = undefined;
    };
  }, []);

  return (
    <div className="clock-wrapper">
      <div className="clock miniclock">
        {time.hours.toString().padStart(2, '0')}:
        {time.minutes.toString().padStart(2, '0')}
      </div>
      <div className="metcat" ref={animationDiv} />
    </div>
  );
}
