import Lottie, { AnimationItem } from 'lottie-web';
import { memo, useEffect, useRef } from 'react';

import GatheringData from './animations/gatheringData.json';
import TransmittingReport from './animations/transmittingReport.json';

const ANIMATIONS = {
  // Data motes spiralling into a core: the machine is collecting the report.
  gathering: GatheringData,
  // Pulses travelling out to the horizon: the report is on its way to us.
  transmitting: TransmittingReport
};

export type BugReportAnimationVariant = keyof typeof ANIMATIONS;

interface BugReportAnimationProps {
  variant: BugReportAnimationVariant;
  size?: number;
}

export const BugReportAnimation = memo(
  ({ variant, size = 200 }: BugReportAnimationProps): JSX.Element => {
    const animation = useRef<AnimationItem | null>(null);
    const animationDiv = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!animationDiv.current) {
        return;
      }

      animation.current = Lottie.loadAnimation({
        container: animationDiv.current,
        animationData: ANIMATIONS[variant],
        renderer: 'svg',
        loop: true,
        autoplay: true
      });
      animation.current.setSubframe(true);

      return () => {
        animation.current?.destroy();
        animation.current = null;
      };
    }, [variant]);

    return (
      <div
        className="bug-report-animation"
        ref={animationDiv}
        style={{ width: size, height: size }}
      />
    );
  }
);

BugReportAnimation.displayName = 'BugReportAnimation';
