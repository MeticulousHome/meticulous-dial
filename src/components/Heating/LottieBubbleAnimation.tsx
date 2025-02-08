import Lottie, { AnimationItem } from 'lottie-web';
import { memo, useEffect, useRef } from 'react';

import BubbleAnimation from './WaterBubbles.json';
const baseSegment = [60, 314];

import { styled } from 'styled-components';

export const BUBBLES_WIDTH = 170;
export const BUBBLES_HEIGHT = 270;

const BubbleContainer = styled.div`
  position: relative;

  width: ${BUBBLES_WIDTH}px;
  height: ${BUBBLES_HEIGHT}px;
  background: black;
  padding: 1px;
`;

const Animation = styled.div`
  width: ${BUBBLES_WIDTH}px;
  height: ${BUBBLES_HEIGHT}px;
`;

const gradientColors = [
  'grey',
  '#280B54',
  '#280B54',
  '#480B6A',
  '#65156E',
  '#82206C',
  '#9F2A63',
  '#BB3755',
  '#D44842',
  '#E8602D',
  '#F44D19',
  '#F44D19'
];
const gradientTempRangeStart = 2;

const TEMP_RANGE_START = 20;
const TEMP_RANGE_END = 90;
const TEMP_RANGE_SIZE = TEMP_RANGE_END - TEMP_RANGE_START;

const linearGradientCSS = `linear-gradient(180deg, ${gradientColors
  .map(
    (color, i) =>
      `${color} ${Math.round(((i + 1) / gradientColors.length) * 100)}%`
  )
  .join(', ')});`;

const GradientContainer = styled.div`
  position: absolute;

  width: ${BUBBLES_WIDTH - 1}px;
  height: ${BUBBLES_HEIGHT - 1}px;
  top: 1px;
  left: 1px;
  transition: background-position-y 0.5s;
  background: ${linearGradientCSS};
  background-position-y: 0%;
  background-size: 100% ${gradientColors.length * 100}%;
  background-repeat: no-repeat;
  mix-blend-mode: multiply;
`;

export const LottieBubbleAnimation = memo(
  ({
    temperature,
    waterStatus
  }: {
    temperature: number;
    waterStatus: boolean;
  }) => {
    const animation = useRef<AnimationItem | null>(null);
    const animationDiv = useRef<HTMLDivElement | null>(null);
    const gradientRef = useRef<HTMLDivElement | null>(null);

    // Start / stop the animation based on the water status
    useEffect(() => {
      if (!animation.current) {
        return;
      }
      if (waterStatus) {
        animation.current?.playSegments([0, baseSegment[1]], true);
        animation.current.setLoop(true);
      } else {
        animation.current.setLoop(false);
        animation.current?.playSegments([baseSegment[1], 375], false);
      }
    }, [waterStatus]);

    useEffect(() => {
      if (!gradientRef.current) {
        return;
      }

      // Where is the current temperature on the range of colors?
      const temperatureRatio =
        (Math.min(TEMP_RANGE_END, Math.max(TEMP_RANGE_START, temperature)) -
          TEMP_RANGE_START) /
        TEMP_RANGE_SIZE;

      // Offset the gradient based on the temperature
      const temperatureOffset =
        ((gradientTempRangeStart +
          (gradientColors.length - gradientTempRangeStart) * temperatureRatio) /
          gradientColors.length) *
        100;

      // go to 0 (grey) if the water is not detected
      gradientRef.current.style.backgroundPositionY = `${
        waterStatus ? temperatureOffset : 0
      }%`;
    }, [temperature, waterStatus, gradientRef]);

    useEffect(() => {
      if (!animationDiv.current) {
        return () => {
          animation.current?.destroy();
        };
      }
      if (!animation.current) {
        animation.current = Lottie.loadAnimation({
          container: animationDiv.current,
          animationData: BubbleAnimation,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          initialSegment: [0, baseSegment[0]]
        });
        animation.current.setSubframe(false);

        // Play segment, wait for the previous one to finish
        animation.current?.playSegments(
          [baseSegment[0], baseSegment[1]],
          false
        );

        animation.current.addEventListener('loopComplete', () => {
          animation.current.setSegment(baseSegment[0], baseSegment[1]);
        });
      }
      return () => {
        animation.current?.destroy();
      };
    }, [animationDiv]);

    return (
      <BubbleContainer>
        <Animation ref={animationDiv} />
        <GradientContainer ref={gradientRef} />
      </BubbleContainer>
    );
  }
);
