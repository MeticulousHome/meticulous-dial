import { useEffect, useRef, useState } from 'react';
import { styled } from 'styled-components';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Temperatures } from './Temperatures';
import { setScreen } from '../store/features/screens/screens-slice';

const NO_WATER_DOT_SIZE = 5;
const DOT_MAX_SIZE = 22;
const DOT_MIN_SIZE = 5;
const DOT_GAP = 3;
const ROWS = 11;
const COLS = 6;

const backgroundWidth = COLS * DOT_MAX_SIZE + (COLS - 1) * DOT_GAP;
const backgroundHeight = ROWS * DOT_MAX_SIZE + (ROWS - 1) * DOT_GAP;

const HorizontalWrapper = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  background: transparent;
`;
const VerticalWrapper = styled.div`
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

const Dots = styled.div<{ $gap: number }>`
  position: relative;
  width: ${backgroundWidth}px;
  height: ${backgroundHeight}px;
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

const infernoStops = [
  { offset: '00%', color: 'grey' },
  { offset: '15%', color: '#280B54' },
  { offset: '20%', color: '#480B6A' },
  { offset: '25%', color: '#65156E' },
  { offset: '30%', color: '#82206C' },
  { offset: '40%', color: '#9F2A63' },
  { offset: '50%', color: '#BB3755' },
  { offset: '60%', color: '#D44842' },
  { offset: '70%', color: '#E8602D' },
  { offset: '80%', color: '#F44D19' },
  { offset: '100%', color: '#F44D19' }
];

const linearGradientCSS = `linear-gradient(0deg, ${infernoStops
  .map((stop) => `${stop.color} ${stop.offset}`)
  .join(', ')});`;

const GradientContainer = styled.div`
  position: absolute;
  width: ${backgroundWidth}px;
  height: ${backgroundHeight}px;
  background: ${linearGradientCSS};
  background-position-y: 0%;
  background-size: 100% 10000%;
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

export const Heating = () => {
  const [noWaterAnimationStart, setNoWaterAnimationStart] =
    useState<Date | null>(null);

  const stats = useAppSelector((state) => state.stats);
  const waterStatus = stats.waterStatus;
  const temperature = parseInt(stats.sensors.t);
  const temperatureTarget = stats.setpoints.temperature;
  const animationRef = useRef<number | null>(null);

  const dispatch = useAppDispatch();

  const circleRefs = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null))
  );
  const gradientRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (stats.name === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [stats.name]);

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
        if (noWaterInterpolation > -1) {
          const position =
            noWaterInterpolation * (100 - temperature) +
            (1 - noWaterInterpolation) * 100;

          gradientRef.current.style.backgroundPositionY = `${position}%`;
        } else {
          gradientRef.current.style.backgroundPositionY = `${
            100 - Math.max(10, temperature)
          }%`;
        }
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
    <HorizontalWrapper>
      <VerticalWrapper style={{ paddingLeft: 10 }}>
        <Dots $gap={DOT_GAP}>
          {Array.from({ length: ROWS }).map((_, rowIndex) => (
            <Row
              key={rowIndex}
              $offseted={rowIndex % 2 === 0}
              $maxSize={DOT_MAX_SIZE}
              $gap={DOT_GAP}
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
      </VerticalWrapper>
      <VerticalWrapper>
        <sup
          style={{
            paddingRight: '25%',
            fontSize: '20px',
            letterSpacing: 4,
            color: '#E7E7E7',
            height: 80,
            textAlign: 'center'
          }}
        >
          HEATING
        </sup>
        <Temperatures current={temperature} target={temperatureTarget} />
      </VerticalWrapper>
    </HorizontalWrapper>
  );
};
