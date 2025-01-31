import { memo, useEffect, useRef, useState } from 'react';
import { styled } from 'styled-components';

const NO_WATER_DOT_SIZE = 5;
const DOT_MAX_SIZE = 18;
const DOT_MIN_SIZE = 5;
const COL_GAP = 7;
const ROW_GAP = 3;
const ROWS = 11;
const COLS = 6;
const TEMP_RANGE_START = 20;
const TEMP_RANGE_END = 90;
const TEMP_RANGE_SIZE = TEMP_RANGE_END - TEMP_RANGE_START;

export const BUBBLES_CONTAINER_WIDTH =
  COLS * DOT_MAX_SIZE + (COLS - 1) * COL_GAP;
export const BUBBLES_CONTAINER_HEIGHT =
  ROWS * DOT_MAX_SIZE + (ROWS - 1) * ROW_GAP;

const Dots = styled.div<{ $gap: number }>`
  position: relative;
  width: ${BUBBLES_CONTAINER_WIDTH}px;
  height: ${BUBBLES_CONTAINER_HEIGHT}px;
  background: black;

  display: flex;
  flex-direction: column;
  gap: ${(props) => props.$gap}px;
`;

const Row = styled.div<{ $offseted: boolean; $maxSize: number; $gap: number }>`
  display: flex;
  flex-direction: row;
  margin-left: ${(props) =>
    props.$offseted ? props.$maxSize * 0.5 + props.$gap * 0.5 : 0}px;
  gap: ${(props) => props.$gap}px;
`;

const Circle = styled.div<{ $maxSize: number }>`
  border-radius: 50%;
  opacity: 0.8;
  transition: transform 0.2s;
  width: ${(props) => props.$maxSize}px;
  height: ${(props) => props.$maxSize}px;
  background: white;
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

const linearGradientCSS = `linear-gradient(180deg, ${gradientColors
  .map(
    (color, i) =>
      `${color} ${Math.round(((i + 1) / gradientColors.length) * 100)}%`
  )
  .join(', ')});`;

const GradientContainer = styled.div`
  position: absolute;
  width: ${BUBBLES_CONTAINER_WIDTH}px;
  height: ${BUBBLES_CONTAINER_HEIGHT}px;
  transition: background-position-y 0.3s;
  background: ${linearGradientCSS};
  background-position-y: 0%;
  background-size: 100% ${gradientColors.length * 100}%;
  background-repeat: no-repeat;
  mix-blend-mode: multiply;
`;

const getWavePattern = (x: number, y: number, time: number) => {
  const warpedTime = time * 7;
  const wave1 = Math.sin(5 + x + warpedTime * 0.5) * 0.3;
  const wave2 = Math.sin(10 + y + warpedTime * 0.7) * 0.3;
  const wave3 = Math.sin((x + y + warpedTime) * 0.6) * 0.5;
  return Math.min(1.1 + wave1 + wave2 + wave3, 2.0);
};

const getCircleSize = (x: number, y: number, time: number, maxSize: number) => {
  const patternValue = getWavePattern(x, y, time);

  return Math.max(DOT_MIN_SIZE, maxSize * (patternValue / 2));
};

export const BubbleAnimation = memo(
  ({
    temperature,
    waterStatus
  }: {
    temperature: number;
    waterStatus: boolean;
  }) => {
    const [noWaterAnimationStart, setNoWaterAnimationStart] =
      useState<Date | null>(null);

    const animationRef = useRef<number | null>(null);

    const circleRefs = useRef<(HTMLDivElement | null)[][]>(
      Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => null)
      )
    );
    const gradientRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      console.log('waterStatus', waterStatus);
      if (waterStatus === false && !noWaterAnimationStart) {
        setNoWaterAnimationStart(new Date());
      } else {
        setNoWaterAnimationStart(null);
      }
    }, [waterStatus]);

    useEffect(() => {
      const updateSizes = (timestamp: number) => {
        let noWaterInterpolation = -1;
        if (noWaterAnimationStart) {
          const noWaterTime =
            new Date().getTime() - noWaterAnimationStart.getTime();
          noWaterInterpolation = Math.max(0, 2000 - noWaterTime) / 2000;
        }

        if (gradientRef.current) {
          const temperatureRatio =
            (Math.min(TEMP_RANGE_END, Math.max(TEMP_RANGE_START, temperature)) -
              TEMP_RANGE_START) /
            TEMP_RANGE_SIZE;

          const temperatureOffset =
            ((gradientTempRangeStart +
              (gradientColors.length - gradientTempRangeStart) *
                temperatureRatio) /
              gradientColors.length) *
            100;

          gradientRef.current.style.backgroundPositionY = `${
            (noWaterInterpolation > -1 ? noWaterInterpolation : 1) *
            temperatureOffset
          }%`;
        }

        circleRefs.current.forEach((row, rowIndex) => {
          row.forEach((circle, colIndex) => {
            if (circle) {
              let size = getCircleSize(
                rowIndex,
                colIndex,
                timestamp / 1000,
                DOT_MAX_SIZE
              );

              if (noWaterInterpolation > -1) {
                size = Math.max(
                  NO_WATER_DOT_SIZE,
                  noWaterInterpolation * size +
                    (1 - noWaterInterpolation) * NO_WATER_DOT_SIZE
                );
              }
              circle.style.transform = `scale(${size / DOT_MAX_SIZE})`;
            }
          });
        });

        animationRef.current = requestAnimationFrame(updateSizes);
      };

      animationRef.current = requestAnimationFrame(updateSizes);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [noWaterAnimationStart, temperature]);

    return (
      <Dots $gap={ROW_GAP}>
        {Array.from({ length: ROWS }).map((_, rowIndex) => (
          <Row
            key={rowIndex}
            $offseted={rowIndex % 2 === 0}
            $maxSize={DOT_MAX_SIZE}
            $gap={COL_GAP}
          >
            {Array.from({ length: rowIndex % 2 ? COLS : COLS - 1 }).map(
              (_, colIndex) => (
                <Circle
                  $maxSize={DOT_MAX_SIZE}
                  key={`${rowIndex}-${colIndex}`}
                  ref={(el) => {
                    circleRefs.current[rowIndex][colIndex] = el;
                  }}
                />
              )
            )}
          </Row>
        ))}
        <GradientContainer ref={gradientRef} />
      </Dots>
    );
  }
);
