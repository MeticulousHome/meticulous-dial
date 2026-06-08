import { useEffect, useRef } from 'react';

import { useNetworkConfig } from '../../hooks/useWifi';

import { styled } from 'styled-components';

import { WifiIndicator } from './WifiIndicator';

const CLOCK_DIAMETER = 480;
const CLOCK_MAX_HAND_THICKNESS = 10;
const CLOCK_HOUR_COLOR = '#E6E6E6';
const CLOCK_HOUR_LENGTH = 82.42;
const CLOCK_MINUTE_COLOR = '#E6E6E6';
const CLOCK_MINUTE_LENGTH = 125.5;
const CLOCK_SECONDS_COLOR = '#F5C444';
const CLOCK_SECONDS_LENGTH = 50.83;
const CLOCK_SMOOTH_SECONDS = true;

const ClockContainer = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  font-size: 24px;
  color: white;
  background: black;
  text-align: center;
`;

const RotationContainer = styled.div<{ $rotation?: number }>`
  position: absolute;
  top: 0px;
  left: ${(CLOCK_DIAMETER - CLOCK_MAX_HAND_THICKNESS) / 2}px;
  min-width: ${CLOCK_MAX_HAND_THICKNESS}px;
  height: ${CLOCK_DIAMETER}px;
  transform: ${(props) => `rotateZ(${props.$rotation}deg)`};

  display: flex;
  justify-content: center;
`;

const HourHand = styled.div`
  position: relative;
  width: 9px;
  height: ${CLOCK_HOUR_LENGTH}px;
  top: ${(CLOCK_DIAMETER / 2 - CLOCK_HOUR_LENGTH) / 2}px;

  background: ${CLOCK_HOUR_COLOR};
`;

const MinuteHand = styled.div`
  position: relative;
  width: 6px;
  height: ${CLOCK_MINUTE_LENGTH}px;
  top: ${(CLOCK_DIAMETER / 2 - CLOCK_MINUTE_LENGTH) / 2}px;

  background: ${CLOCK_MINUTE_COLOR};
`;

const SecondHand = styled.div`
  position: relative;
  width: 4px;
  height: ${CLOCK_SECONDS_LENGTH}px;
  top: 0px;

  background: ${CLOCK_SECONDS_COLOR};
`;

const Indicators = styled.span<{ $main: boolean }>`
  position: relative;
  top: 4.5px;
  width: 1.5px;
  height: ${(props) => (props.$main ? 31.5 : 15.5)}px;

  background: ${(props) => (props.$main ? '#898989' : '#494949')};
`;

const IconsConatiner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
`;
// Pre-compute rotation strings to avoid per-frame template literal allocations.
// 360 degrees at 0.1 degree resolution = 3600 cached strings.
const ROTATE_STRINGS: string[] = new Array(3600);
for (let i = 0; i < 3600; i++) {
  ROTATE_STRINGS[i] = `rotate(${(i / 10).toFixed(1)}deg)`;
}

function rotateString(degrees: number): string {
  const idx = Math.round((((degrees % 360) + 360) % 360) * 10);
  return ROTATE_STRINGS[idx % 3600];
}

// getTimezoneOffset() returns UTC - local in minutes
const TZ_OFFSET_MS = new Date().getTimezoneOffset() * 60 * 1000;

export function AnalogClock() {
  const requestId = useRef<number>(-1);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);
  const lastHour = useRef('');
  const lastMinute = useRef('');
  const lastSecond = useRef('');

  const animateTime = () => {
    if (!hourRef.current || !minuteRef.current || !secondRef.current) {
      return;
    }

    // Use Date.now() + integer arithmetic instead of new Date() to avoid
    // allocating a Date object every frame (~60/sec).
    const now = Date.now();
    const ms = (now - TZ_OFFSET_MS) % 86400000; // ms since midnight local time
    const totalSeconds = ms / 1000;
    const seconds = totalSeconds % 60;
    const totalMinutes = totalSeconds / 60;
    const minutes = totalMinutes % 60;
    const hours = (totalMinutes / 60) % 12;

    const hourRotation = hours * 30;
    const minuteRotation = minutes * 6;
    const secondRotation =
      (Math.floor(seconds) + (CLOCK_SMOOTH_SECONDS ? seconds % 1 : 0)) * 6;

    // Only write to style.transform when the cached string actually changes.
    // This avoids creating new template literal strings every frame.
    const hourStr = rotateString(hourRotation);
    if (hourStr !== lastHour.current) {
      lastHour.current = hourStr;
      hourRef.current.style.transform = hourStr;
    }

    const minuteStr = rotateString(minuteRotation);
    if (minuteStr !== lastMinute.current) {
      lastMinute.current = minuteStr;
      minuteRef.current.style.transform = minuteStr;
    }

    const secondStr = rotateString(secondRotation);
    if (secondStr !== lastSecond.current) {
      lastSecond.current = secondStr;
      secondRef.current.style.transform = secondStr;
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
    <ClockContainer>
      <IconsConatiner>
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
      </IconsConatiner>
      {Array.from({ length: 60 }).map((_, i) => {
        return (
          <RotationContainer key={i} $rotation={(i * 360) / 60}>
            <Indicators $main={i % 5 === 0} />
          </RotationContainer>
        );
      })}
      <RotationContainer ref={hourRef}>
        <HourHand />
      </RotationContainer>
      <RotationContainer ref={minuteRef}>
        <MinuteHand />
      </RotationContainer>
      <RotationContainer ref={secondRef}>
        <SecondHand />
      </RotationContainer>
    </ClockContainer>
  );
}
