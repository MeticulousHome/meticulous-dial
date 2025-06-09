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
export function AnalogClock() {
  const requestId = useRef<number>(-1);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);

  const animateTime = () => {
    if (!hourRef.current || !minuteRef.current || !secondRef.current) {
      return;
    }
    const time = new Date();
    const hourRotation = (time.getHours() + time.getMinutes() / 60) * 30;
    const minuteRotation = (time.getMinutes() + time.getSeconds() / 60) * 6;
    const secondRotation =
      (time.getSeconds() +
        (CLOCK_SMOOTH_SECONDS ? time.getMilliseconds() / 1000 : 0)) *
      6;

    hourRef.current.style.transform = `rotate(${hourRotation}deg)`;
    minuteRef.current.style.transform = `rotate(${minuteRotation}deg)`;
    secondRef.current.style.transform = `rotate(${secondRotation}deg)`;

    requestId.current = requestAnimationFrame(animateTime);
  };

  const { data: networkConfig, refetch: refetchNetworkConfig } =
    useNetworkConfig();

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
          <img src="assets/logo-white.svg" alt="Logo Meticulous white" />
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
