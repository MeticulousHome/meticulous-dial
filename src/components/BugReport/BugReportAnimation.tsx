import Lottie, { AnimationItem } from 'lottie-web';
import { memo, useEffect, useRef } from 'react';

import CollapsingBridge from './animations/collapsingBridge.json';
import CollectingData from './animations/collectingData.json';
import FinishedData from './animations/Finished.json';
import GatheringData from './animations/gatheringData.json';
import ProcessingSubmission from './animations/processingSubmission.json';
import TransmittingReport from './animations/transmittingReport.json';

interface Step {
  data: unknown;
  /** Loops rest until the phase changes; one-shots hand over when they end. */
  loop: boolean;
}

// Motes converging on a core while the machine compiles the report.
const COLLECTING: Step = { data: CollectingData, loop: true };
// The one-shot hand-off from collecting to sending.
const BRIDGE: Step = { data: CollapsingBridge, loop: false };
// The long wait: ticketing, upload and Sentry flush.
const PROCESSING: Step = { data: ProcessingSubmission, loop: true };
// Plays out before the submitted screen replaces it.
const FINISHED: Step = { data: FinishedData, loop: false };

// Superseded by the sequence above. Kept, unwired, so the designs stay in reach.
export const LEGACY_ANIMATIONS = {
  gathering: { data: GatheringData, loop: true } as Step,
  transmitting: { data: TransmittingReport, loop: true } as Step
};

export type BugReportAnimationPhase = 'collecting' | 'submitting' | 'finished';

interface BugReportAnimationProps {
  phase: BugReportAnimationPhase;
  /** Fires once Finished has played to its last frame. */
  onFinished?: () => void;
  size?: number;
}

export const BugReportAnimation = memo(
  ({ phase, onFinished, size = 200 }: BugReportAnimationProps): JSX.Element => {
    const animation = useRef<AnimationItem | null>(null);
    const animationDiv = useRef<HTMLDivElement | null>(null);
    // What is on screen, so the bridge can be recognised while it still runs.
    const playing = useRef<Step | null>(null);
    // True from the moment the bridge is scheduled until it has played out.
    const bridgePending = useRef(false);
    // Set when the submission lands before the bridge is done with the screen.
    const finishQueued = useRef(false);
    // Read at completion time, so a new callback identity cannot restart a step.
    const finishedCallback = useRef(onFinished);
    finishedCallback.current = onFinished;

    useEffect(() => {
      return () => {
        animation.current?.destroy();
        animation.current = null;
        playing.current = null;
      };
    }, []);

    useEffect(() => {
      const container = animationDiv.current;
      if (!container) {
        return;
      }

      const play = (step: Step, onComplete?: () => void) => {
        animation.current?.destroy();
        playing.current = step;

        const item = Lottie.loadAnimation({
          container,
          animationData: step.data,
          renderer: 'svg',
          loop: step.loop,
          autoplay: true
        });
        item.setSubframe(true);
        if (onComplete) {
          item.addEventListener('complete', onComplete);
        }
        animation.current = item;
      };

      const playFinished = () => {
        play(FINISHED, () => finishedCallback.current?.());
      };

      // The bridge is a designed hand-off, so it always plays to its end. A
      // submission that lands before it does waits its turn here rather than
      // cutting it off mid-motion.
      const playBridge = () => {
        play(BRIDGE, () => {
          bridgePending.current = false;
          if (finishQueued.current) {
            finishQueued.current = false;
            playFinished();
            return;
          }
          play(PROCESSING);
        });
      };

      switch (phase) {
        case 'collecting':
          // Re-entering the flow after a cancel or a failure starts clean.
          bridgePending.current = false;
          finishQueued.current = false;
          play(COLLECTING);
          break;
        case 'submitting':
          if (bridgePending.current) {
            break;
          }
          bridgePending.current = true;
          // Both clips put the arc at the same angle on the collecting loop's
          // boundary, and nowhere else: the arc travels a full revolution in
          // between, so cutting on an arbitrary frame snaps it by up to 179
          // degrees. Let the loop come round first.
          if (playing.current === COLLECTING && animation.current) {
            animation.current.addEventListener('loopComplete', playBridge);
            break;
          }
          playBridge();
          break;
        case 'finished':
          if (bridgePending.current) {
            finishQueued.current = true;
            break;
          }
          playFinished();
          break;
      }
    }, [phase]);

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
