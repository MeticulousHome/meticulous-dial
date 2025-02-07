import Lottie, { AnimationItem } from 'lottie-web';
import { memo, useEffect, useRef, useState } from 'react';

import BubbleAnimation from './WaterBubbles.json';

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
  transition: background-position-y 0.3s;
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
    const [noWaterAnimationStart, setNoWaterAnimationStart] =
      useState<Date | null>(null);

    useEffect(() => {
      if (!gradientRef.current) {
        return;
      }
      // Should we transition to grey for the no-water status?
      let noWaterInterpolation = -1;
      if (noWaterAnimationStart) {
        const noWaterTime =
          new Date().getTime() - noWaterAnimationStart.getTime();
        noWaterInterpolation = Math.max(0, 2000 - noWaterTime) / 2000;
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

      // Mix Water status and temperature gradient
      gradientRef.current.style.backgroundPositionY = `${
        (noWaterInterpolation > -1 ? noWaterInterpolation : 1) *
        temperatureOffset
      }%`;
    }, [temperature, noWaterAnimationStart, gradientRef]);

    useEffect(() => {
      if (waterStatus === false && !noWaterAnimationStart) {
        setNoWaterAnimationStart(new Date());
      } else {
        setNoWaterAnimationStart(null);
      }
    }, [waterStatus, noWaterAnimationStart]);

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
          autoplay: true
        });
        animation.current.setSpeed(1.2);
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
