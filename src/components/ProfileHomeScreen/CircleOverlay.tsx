import { useEffect, useState } from 'react';
import './transitions.less';

import { styled } from 'styled-components';
import { useProfileContext } from '../../context/ProfileContext';

const CircleText = styled.div`
  position: absolute;
  width: 480px;
  height: 480px;
  top: 0;
  left: 0;

  background-color: black;

  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;

  font-family: var(--multilingual-fonts);
  font-size: 25px;
  font-weight: 400;
  letter-spacing: -0.01em;
  opacity: 0;

  transition: opacity 0.5s ease;
`;

export function CircleOverlay({
  shouldAnimate,
  onAnimationFinished
}: {
  shouldAnimate: boolean;
  onAnimationFinished?: () => void;
}) {
  // Circle configuration
  const stroke = 5;
  const radius = (480 - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  // We start fully "hidden" by matching dash offset to the full circumference
  const [strokeDashOffset, setStrokeDashOffset] = useState(circumference);

  // This state tracks whether the circle is finished drawing
  const [isDrawn, setIsDrawn] = useState(false);
  const [wasLetGo, setWasLetGo] = useState(false);

  // We use `onTransitionEnd` to detect when the circle finishes drawing
  // This might also be triggered on winddown, so we need to check if the circle is fully drawn
  function handleTransitionEnd() {
    if (!shouldAnimate || strokeDashOffset === circumference) {
      setIsDrawn(false);
    } else {
      setIsDrawn(true);
      if (onAnimationFinished) {
        onAnimationFinished();
      }
    }
  }

  const { localHoverState } = useProfileContext();

  useEffect(() => {
    if (!isDrawn) {
      if (shouldAnimate) {
        setStrokeDashOffset(0);
      } else {
        if (strokeDashOffset !== circumference) {
          setWasLetGo(true);
          setStrokeDashOffset(circumference);
        }
      }
    }
  }, [shouldAnimate, isDrawn]);

  // Reset the circle if we zoom out
  useEffect(() => {
    setWasLetGo(false);
  }, [localHoverState]);

  return (
    <>
      <svg
        width="480"
        height="480"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* The circle that animates from 0% to 100% */}
        <circle
          cx="240"
          cy="240"
          r={radius}
          fill="transparent"
          className={
            shouldAnimate
              ? 'animateCirlceOpacityUp'
              : 'animateCirlceOpacityDown'
          }
          strokeWidth={stroke}
          style={{
            transformOrigin: '50% 50%',
            stroke: 'white',
            transform: 'rotate(90deg)',
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashOffset,
            transition: 'stroke-dashoffset 1.0s ease-out'
          }}
          onTransitionEnd={handleTransitionEnd}
        />
      </svg>
      <CircleText
        className={
          localHoverState && wasLetGo && !shouldAnimate
            ? 'animateTextOpacityUp'
            : ''
        }
        onAnimationEnd={() => setWasLetGo(false)}
      >
        Hold to start
      </CircleText>
    </>
  );
}
