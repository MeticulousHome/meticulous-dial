import { memo } from 'react';
import styledComponents, { css, keyframes } from 'styled-components';

export const TitleCircle = memo(
  ({
    titleOpacityEnd,
    titleOpacityInitial,
    value1,
    value2
  }: {
    value1: number;
    value2: number;
    titleOpacityInitial: number;
    titleOpacityEnd: number;
  }) => {
    const timeTotal = (value2 > 0 ? value2 - value1 : value1 - value2) * 15;

    const per = (((timeTotal / value1) * 30) / timeTotal) * 100;

    const fade = keyframes`
    0%{
      opacity: ${titleOpacityInitial};
    }
    ${
      !isNaN(per) && per < 100
        ? `
      ${100 - per}% {
        opacity: ${titleOpacityInitial};
      }
      `
        : ``
    }
    100% {
      opacity: ${titleOpacityEnd};
    }
    `;

    const fadeAnimation = () => css`
      ${fade} ${timeTotal}ms linear forwards
    `;

    const Title = styledComponents.h1`
      animation: ${fadeAnimation};
    `;

    return (
      <div className="cicle-container">
        <Title>Hold to start</Title>
      </div>
    );
  }
);
