import React, { useRef } from 'react';
import { css, keyframes, styled } from 'styled-components';

const iconAnimation = keyframes`
    0% {
        opacity: 0.5;
        transform: rotate(0deg);
    }
    100% {
        opacity: 1;
        transform: rotate(360deg);
    }
`;

const AnimatedIcon = styled.div<{ $isAnimating: boolean }>`
  position: absolute;
  bottom: 50px;
  left: 220px;
  transform: rotate(0deg);
  opacity: 0.5;
  animation: ${({ $isAnimating }) =>
    $isAnimating
      ? css`
          ${iconAnimation} 2s forwards
        `
      : 'none'};
`;

export const SkipOverIcon = ({
  isAnimating,
  onFinish
}: {
  isAnimating: boolean;
  onFinish?: () => void;
}) => {
  const iconRef = useRef<HTMLDivElement>(null);

  const handleAnimationEnd = () => {
    console.log('SkipOverIcon animation ended');
    if (onFinish) {
      onFinish();
    }
  };

  return (
    <AnimatedIcon
      onAnimationEnd={handleAnimationEnd}
      $isAnimating={isAnimating}
      ref={iconRef}
    >
      <img
        style={{
          width: 40,
          height: 40
        }}
        src={'/public/debug-step-over.svg'}
      />
    </AnimatedIcon>
  );
};
