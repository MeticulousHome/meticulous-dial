import React, { memo, useRef } from 'react';
import { getDashArray } from '../SettingNumerical/Gauge';
import styledComponents, { keyframes } from 'styled-components';

export const radius = 237;
export const transform = `rotate(90, ${radius}, ${radius})`;

export const Circle = memo(
  ({
    extraDelay,
    strokeInitialValue,
    strokeEndValue,
    fillEnd,
    fillInitial,
    timeFunc
  }: {
    extraDelay: number;
    strokeInitialValue: number;
    strokeEndValue: number;
    fillInitial: number;
    fillEnd: number;
    timeFunc?: 'ease-in' | 'linear';
  }) => {
    // Calculate initial and final dash array values
    const value1Ref = useRef(getDashArray(strokeInitialValue, 100));
    const value2Ref = useRef(getDashArray(strokeEndValue, 100));

    const treinta = (strokeEndValue - strokeInitialValue) * 0.3;

    // Calculate total time for the first animation
    const timeTotal =
      Math.abs(strokeEndValue - strokeInitialValue) *
        (extraDelay === 100 ? 12 : 3) +
      extraDelay;

    const strokeAnimationDuration = strokeInitialValue === 0 ? 2000 : timeTotal;

    // Define the first animation (strokeAnimation)
    const strokeAnimation = keyframes`
      0% {
        stroke-dasharray: ${value1Ref.current};
        fill: rgba(0, 0, 0, ${Math.min(fillInitial, 0.8)});
      }
      ${
        extraDelay
          ? `
        ${(timeTotal * extraDelay) / 100}% {
          stroke-dasharray: ${getDashArray(treinta, 100)}
        }
        `
          : ``
      }
      100% {
        stroke-dasharray: ${value2Ref.current};
        fill: rgba(0, 0, 0, ${Math.min(fillEnd, 0.8)});
      }
    `;

    // Define the second animation (colorAnimation) to change stroke color
    const initialStrokeColor = '#FFFFFF';
    const transitionStrokeColor = '#000000';
    const finalStrokeColor = '#f5c444';

    const colorAnimationDuration = 2000; // Duration in milliseconds
    const colorAnimationDelay = (strokeAnimationDuration * 9) / 10; // Starts after 90% of the first animation
    const colorAnimationTimingFunction = 'linear'; // Timing function

    const colorAnimation = keyframes`
      0% {
        stroke: ${initialStrokeColor};
      }
      25% {
        stroke: ${transitionStrokeColor};
      }
      50% {
        stroke: ${finalStrokeColor};
      }
      75% {
        stroke: ${transitionStrokeColor};
      }
      100% {
        stroke: ${initialStrokeColor};
      }
    `;

    // Styled component applying both animations
    const SlideTrackContainer = styledComponents.circle`
      stroke: ${initialStrokeColor};
      animation:
        ${strokeAnimation} ${strokeAnimationDuration}ms ${timeFunc} forwards,
        ${colorAnimation}  ${colorAnimationDuration}ms  ${colorAnimationTimingFunction} ${colorAnimationDelay}ms infinite;
    `;

    return (
      <SlideTrackContainer
        id="bar"
        cx={radius}
        cy={radius - 3}
        r={radius}
        fill="transparent"
        strokeDashoffset="0"
        strokeLinecap="butt"
        transform={transform}
      />
    );
  }
);
