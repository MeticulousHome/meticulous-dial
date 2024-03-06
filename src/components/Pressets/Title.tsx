import React from 'react';
import styled, { css, keyframes } from 'styled-components';

export const TitleCircle = React.memo(
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
    const fade = keyframes`
    0%{
      opacity: ${titleOpacityInitial};
    }
    100% {
      opacity: ${titleOpacityEnd};
    }
    `;

    const fadeAnimation = () => css`
      ${fade} ${value2 > 0
        ? (value2 - value1) * 10
        : value1 * 30}ms linear forwards
    `;

    const Title = styled.h1`
      animation: ${fadeAnimation};
    `;

    return (
      <div className="cicle-container">
        <Title>Hold to start</Title>
      </div>
    );
  }
);
