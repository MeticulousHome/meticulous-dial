import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Temperatures } from './Temperatures';
import { setScreen } from '../store/features/screens/screens-slice';

import {
  NO_WATER_DOT_SIZE,
  DOT_MAX_SIZE,
  DOT_MIN_SIZE,
  DOT_GAP,
  ROWS,
  COLS
} from '@styles/variables.styled';

import {
  HorizontalWrapper,
  VerticalWrapper,
  Dots,
  Row,
  Circle,
  GradientContainer
} from '@styles/mixins.styled';

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
