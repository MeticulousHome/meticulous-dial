import { styled } from 'styled-components';
import {
  backgroundWidth,
  backgroundHeight,
  infernoStops
} from '@styles/variables.styled';

export const HorizontalWrapper = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  background: transparent;
`;

export const VerticalWrapper = styled.div`
  height: 100%;
  width: 50%;
  display: flex;
  align-content: center;
  background: transparent;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
`;

export const Dots = styled.div<{ $gap: number }>`
  position: relative;
  width: ${backgroundWidth}px;
  height: ${backgroundHeight}px;
  background: black;

  display: flex;
  flex-direction: column;
  gap: ${(props) => props.$gap}px;
`;

export const Row = styled.div<{
  $offseted: boolean;
  $maxSize: number;
  $gap: number;
}>`
  display: flex;
  flex-direction: row;
  margin-left: ${(props) =>
    props.$offseted ? props.$maxSize * 0.5 + props.$gap * 0.5 : 0}px;
  gap: ${(props) => props.$gap}px;
`;

export const Circle = styled.div<{ $maxSize: number }>`
  border-radius: 50%;
  opacity: 0.8;
  transition: transform 0.2s;
  width: ${(props) => props.$maxSize}px;
  height: ${(props) => props.$maxSize}px;
  background: white;
`;

const linearGradientCSS = `linear-gradient(0deg, ${infernoStops
  .map((stop) => `${stop.color} ${stop.offset}`)
  .join(', ')});`;

export const GradientContainer = styled.div`
  position: absolute;
  width: ${backgroundWidth}px;
  height: ${backgroundHeight}px;
  background: ${linearGradientCSS};
  background-position-y: 0%;
  background-size: 100% 10000%;
  background-repeat: no-repeat;
  mix-blend-mode: multiply;
`;
