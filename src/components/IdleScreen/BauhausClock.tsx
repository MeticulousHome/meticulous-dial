import { useEffect, useRef } from 'react';

import { useNetworkConfig } from '../../hooks/useWifi';
import { styled } from 'styled-components';
import { WifiIndicator } from './WifiIndicator';

const CLOCK_DIAMETER = 480;
const CLOCK_RADIUS = CLOCK_DIAMETER / 2;
const CLOCK_SMOOTH_SECONDS = true;

// Hand dimensions — thinner and more refined than the default analog clock
const HOUR_HAND_WIDTH = 3;
const HOUR_HAND_LENGTH = 110;
const MINUTE_HAND_WIDTH = 1.8;
const MINUTE_HAND_LENGTH = 158;
const SECOND_HAND_WIDTH = 0.8;
const SECOND_HAND_LENGTH = 158;
const SECOND_HAND_TAIL = 30;

export type BauhausVariant = 'dark' | 'light' | 'slate';

interface VariantColors {
  dial: string;
  numeral: string;
  hand: string;
  second: string;
  hourTick: string;
  minuteTick: string;
  chapterRing: string;
  wordmark: string;
  centerDot: string;
}

const VARIANTS: Record<BauhausVariant, VariantColors> = {
  dark: {
    dial: '#0d0d0d',
    numeral: '#e8e4dc',
    hand: '#e8e4dc',
    second: '#c8a96e',
    hourTick: '#888888',
    minuteTick: '#3a3a3a',
    chapterRing: '#2a2a2a',
    wordmark: '#3a3a3a',
    centerDot: '#0d0d0d'
  },
  light: {
    dial: '#f0ece4',
    numeral: '#1a1a1a',
    hand: '#1a1a1a',
    second: '#8b4513',
    hourTick: '#555555',
    minuteTick: '#bbbbbb',
    chapterRing: '#ccc8c0',
    wordmark: '#aaaaaa',
    centerDot: '#f0ece4'
  },
  slate: {
    dial: '#1c2330',
    numeral: '#c8d4e0',
    hand: '#c8d4e0',
    second: '#5b9bd5',
    hourTick: '#5a7a9a',
    minuteTick: '#2e3a4a',
    chapterRing: '#2e3a4a',
    wordmark: '#3a4a5a',
    centerDot: '#1c2330'
  }
};

interface ClockContainerProps {
  $dialColor: string;
}

const ClockContainer = styled.div<ClockContainerProps>`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: ${({ $dialColor }) => $dialColor};
  position: relative;
  overflow: hidden;
`;

const ClockSvg = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const IconsContainer = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
`;

function buildTickMarks(colors: VariantColors) {
  const ticks: JSX.Element[] = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const outerR = CLOCK_RADIUS - 18;
    const innerR = isHour ? CLOCK_RADIUS - 32 : CLOCK_RADIUS - 24;

    const x1 = CLOCK_RADIUS + outerR * Math.cos(angle);
    const y1 = CLOCK_RADIUS + outerR * Math.sin(angle);
    const x2 = CLOCK_RADIUS + innerR * Math.cos(angle);
    const y2 = CLOCK_RADIUS + innerR * Math.sin(angle);

    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isHour ? colors.hourTick : colors.minuteTick}
        strokeWidth={isHour ? 1.2 : 0.5}
        strokeLinecap="round"
      />
    );
  }
  return ticks;
}

function buildNumerals(colors: VariantColors) {
  const positions = [
    { label: '12', x: CLOCK_RADIUS, y: 42 },
    { label: '3', x: CLOCK_DIAMETER - 42, y: CLOCK_RADIUS },
    { label: '6', x: CLOCK_RADIUS, y: CLOCK_DIAMETER - 44 },
    { label: '9', x: 42, y: CLOCK_RADIUS }
  ];

  return positions.map(({ label, x, y }) => (
    <text
      key={label}
      x={x}
      y={y}
      fill={colors.numeral}
      fontFamily="'Georgia', 'Times New Roman', serif"
      fontSize="22"
      fontWeight="400"
      textAnchor="middle"
      dominantBaseline="central"
      letterSpacing="1"
    >
      {label}
    </text>
  ));
}

interface BauhausClockProps {
  variant?: BauhausVariant;
}

export function BauhausClock({ variant = 'dark' }: BauhausClockProps) {
  const colors = VARIANTS[variant];

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<SVGLineElement>(null);
  const requestId = useRef<number>(-1);

  const animateTime = () => {
    const time = new Date();
    const ms = CLOCK_SMOOTH_SECONDS ? time.getMilliseconds() / 1000 : 0;

    const hourRotation = ((time.getHours() % 12) + time.getMinutes() / 60) * 30;
    const minuteRotation = (time.getMinutes() + time.getSeconds() / 60) * 6;
    const secondRotation = (time.getSeconds() + ms) * 6;

    if (hourRef.current) {
      hourRef.current.style.transform = `rotate(${hourRotation}deg)`;
    }
    if (minuteRef.current) {
      minuteRef.current.style.transform = `rotate(${minuteRotation}deg)`;
    }
    if (secondRef.current) {
      secondRef.current.setAttribute(
        'transform',
        `rotate(${secondRotation}, ${CLOCK_RADIUS}, ${CLOCK_RADIUS})`
      );
    }

    requestId.current = requestAnimationFrame(animateTime);
  };

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig({ idle: true });

  useEffect(() => {
    refetchNetworkConfig();
    requestId.current = requestAnimationFrame(animateTime);
    return () => {
      cancelAnimationFrame(requestId.current);
    };
  }, []);

  const isWifiConnected = networkConfig?.status.connected;

  return (
    <ClockContainer $dialColor={colors.dial}>
      <ClockSvg viewBox={`0 0 ${CLOCK_DIAMETER} ${CLOCK_DIAMETER}`}>
        {/* Chapter ring */}
        <circle
          cx={CLOCK_RADIUS}
          cy={CLOCK_RADIUS}
          r={CLOCK_RADIUS - 16}
          fill="none"
          stroke={colors.chapterRing}
          strokeWidth={0.5}
        />

        {/* Tick marks */}
        {buildTickMarks(colors)}

        {/* Arabic numerals */}
        {buildNumerals(colors)}

        {/* Meticulous wordmark */}
        <text
          x={CLOCK_RADIUS}
          y={CLOCK_RADIUS + 68}
          fill={colors.wordmark}
          fontFamily="'Georgia', serif"
          fontSize="9"
          textAnchor="middle"
          letterSpacing="3"
        >
          METICULOUS
        </text>

        {/* Seconds hand — SVG so we can animate via ref */}
        <line
          ref={secondRef}
          x1={CLOCK_RADIUS}
          y1={CLOCK_RADIUS + SECOND_HAND_TAIL}
          x2={CLOCK_RADIUS}
          y2={CLOCK_RADIUS - SECOND_HAND_LENGTH}
          stroke={colors.second}
          strokeWidth={SECOND_HAND_WIDTH}
          strokeLinecap="round"
        />

        {/* Center cap */}
        <circle cx={CLOCK_RADIUS} cy={CLOCK_RADIUS} r={3} fill={colors.hand} />
        <circle
          cx={CLOCK_RADIUS}
          cy={CLOCK_RADIUS}
          r={1.2}
          fill={colors.centerDot}
        />
      </ClockSvg>

      {/* Hour hand — div-based to match existing AnalogClock pattern */}
      <div
        ref={hourRef}
        style={{
          position: 'absolute',
          top: 0,
          left: CLOCK_RADIUS - HOUR_HAND_WIDTH / 2,
          width: `${HOUR_HAND_WIDTH}px`,
          height: `${CLOCK_DIAMETER}px`,
          transformOrigin: `${HOUR_HAND_WIDTH / 2}px ${CLOCK_RADIUS}px`
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: CLOCK_RADIUS - HOUR_HAND_LENGTH,
            left: 0,
            width: `${HOUR_HAND_WIDTH}px`,
            height: `${HOUR_HAND_LENGTH}px`,
            background: colors.hand,
            borderRadius: '2px 2px 0 0'
          }}
        />
      </div>

      {/* Minute hand */}
      <div
        ref={minuteRef}
        style={{
          position: 'absolute',
          top: 0,
          left: CLOCK_RADIUS - MINUTE_HAND_WIDTH / 2,
          width: `${MINUTE_HAND_WIDTH}px`,
          height: `${CLOCK_DIAMETER}px`,
          transformOrigin: `${MINUTE_HAND_WIDTH / 2}px ${CLOCK_RADIUS}px`
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: CLOCK_RADIUS - MINUTE_HAND_LENGTH,
            left: 0,
            width: `${MINUTE_HAND_WIDTH}px`,
            height: `${MINUTE_HAND_LENGTH}px`,
            background: colors.hand,
            borderRadius: '1px 1px 0 0'
          }}
        />
      </div>

      {/* Logo and wifi — matching AnalogClock layout */}
      <IconsContainer>
        <div
          style={{
            position: 'relative',
            width: '30px',
            top: '103px'
          }}
        >
          <img src="/logo-white.svg" alt="Logo Meticulous white" />
        </div>
        <WifiIndicator
          enabled={isWifiConnected}
          style={{
            position: 'relative',
            width: '27.57px',
            bottom: '103px'
          }}
        />
      </IconsContainer>
    </ClockContainer>
  );
}
