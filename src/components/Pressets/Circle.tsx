import React, { useRef } from 'react';
import { getDashArray } from '../SettingNumerical/Gauge';
import styled, { css, keyframes } from 'styled-components';

export const radius = 237;
export const transform = `rotate(90, ${radius}, ${radius})`;

export const Circle = React.memo(
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
    const value1Ref = useRef(getDashArray(strokeInitialValue, 100));
    const value2Ref = useRef(getDashArray(strokeEndValue, 100));

    const treinta = (strokeEndValue - strokeInitialValue) * 0.3;

    const timeTotal =
      (strokeEndValue > 0
        ? strokeEndValue - strokeInitialValue
        : strokeInitialValue - strokeEndValue) *
        (extraDelay === 100 ? 12 : 3) +
      extraDelay;

    const stroke = keyframes`
      0% {
        stroke-dasharray: ${value1Ref.current};
        fill: rgba(0,0,0, ${Math.min(fillInitial, 0.8)});
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
        fill: rgba(0,0,0, ${Math.min(fillEnd, 0.8)});
      }`;

    const scrollAnimation = () => css`
      ${stroke} ${strokeInitialValue === 0
        ? 2000
        : timeTotal}ms ${timeFunc} forwards
    `;

    const SlideTrackContainer = styled.circle`
      animation: ${scrollAnimation};
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
