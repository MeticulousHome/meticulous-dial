import { styled, css } from 'styled-components';
import DripTray from './DripTray';
import Weight from './Weight';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';

import { useEffect, useState } from 'react';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';

type TransitionProps = {
  isTaring: boolean;
};

type TitleProps = {
  color?: string;
  fontSize?: string;
  fontWeight?: string;
};

//470g - 530g is the range allowed for calibration in acaia scales
//This logic is temporary since the method of calibration will change. For example, it will be done with 100g instead of 500g.
const LOWER_RANGE_ALLOWED = 470;
const UPPER_RANGE_ALLOWED = 530;

const HorizontalWrapper = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  justify-content: center;
`;

const VerticalWrapper = styled.div`
  height: 100%;
  width: 60%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
`;

const Overlay = styled.div<TransitionProps>`
  width: 277px;
  height: 50px;
  position: absolute;
  background-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1),
    rgba(0, 0, 0, 0.9)
  );
  overflow: hidden;
  filter: blur(10px);
  top: ${(props) => (props.isTaring ? '165px' : '140px')};
  transition:
    top 0.5s ease,
    opacity 0.3s ease;
  transition-delay: 0.8s;
`;

const Title = styled.div<TitleProps>`
  border: 1px solid #5d5d5d;
  border-radius: 30px;
  line-height: 1.4;
  position: absolute;
  letter-spacing: 3.2px;
  text-align: center;
  text-transform: uppercase;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding-inline: 1rem;
  & > * {
    color: ${(props) => props.color || 'inherit'};
    font-size: ${(props) => props.fontSize || 'inherit'};
    font-weight: ${(props) => props.fontWeight || 'inherit'};
  }
`;

const BottomStatus = styled.div`
  position: absolute;
  bottom: 70px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
`;

const Label = styled.div`
  letter-spacing: 5px;
  text-transform: uppercase;
  font-size: 25px;
  position: relative;
  height: 25px;
  width: 100%;
`;

const Text = styled.span<{ color?: string; show: boolean; bordered?: boolean }>`
  opacity: ${(props) => (props.show ? '1' : '0')};
  color: ${(props) => props.color || 'inherit'};
  transition: opacity 0.5s ease;
  transition-delay: 0.8s;
  position: absolute;
  left: 50%;
  text-align: center;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: ${(props) => (props.bordered ? '12px' : '')};
  border: ${(props) => (props.bordered ? `1px solid ${props.color}` : '')};
`;

const SVGContainer = css`
  width: 100%;
  position: absolute;
  transition:
    top 0.5s ease,
    opacity 0.5s ease;
  transition-delay: 0.8s;
`;

const DripTrayContainer = styled.div<TransitionProps>`
  ${SVGContainer}
  max-width: 277px;
  top: ${(props) => (props.isTaring ? '190px' : '170px')};
  z-index: -10;
`;

const WeightContainer = styled.div<TransitionProps>`
  ${SVGContainer}
  max-width: 160px;
  top: ${(props) => (props.isTaring ? '108px' : '60px')};
  opacity: ${(props) => (props.isTaring ? 1 : 0)};
`;

const Grams = styled.span`
  color: #0866ff;
  font-size: 38px;
  font-weight: 200;
  letter-spacing: 7.6px;
`;

const formatWeight = (weight: number) => {
  if (weight < 0) {
    const absoluteWeight = Math.abs(weight).toString().padStart(3, '0');
    return `-${absoluteWeight}`;
  }
  return weight.toString().padStart(3, '0');
};

export default function CalibrateScale() {
  const socket = useSocket();
  const dispatch = useAppDispatch();

  const weight = useAppSelector((state) => Math.round(state.stats.sensors.w));
  const formattedWeight = formatWeight(weight);
  const [isTaring, setIsTaring] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  //This logic is temporary since the method of calibration will change. For example, it will be done with 100g instead of 500g.
  const notAllowCalibrate =
    weight <= 0 || weight < LOWER_RANGE_ALLOWED || weight > UPPER_RANGE_ALLOWED;

  useEffect(() => {
    if (!isCalibrated) return;

    const timeoutId = setTimeout(() => {
      dispatch(setBubbleDisplay({ visible: false, component: null }));
      dispatch(setScreen('pressets'));
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [isCalibrated]);

  useHandleGestures({
    singleTare() {
      setIsTaring(true);
    },
    doubleClick() {
      dispatch(setBubbleDisplay({ visible: false, component: null }));
      dispatch(setScreen('pressets'));
    },
    pressDown() {
      if (notAllowCalibrate) return;
      socket.emit('calibrate', '');
      setIsCalibrated(true);
    }
  });

  return (
    <>
      <Title color="rgba(255, 255, 255, 0.8)">
        <span>calibrate scale</span>
      </Title>
      <HorizontalWrapper>
        <VerticalWrapper>
          <Overlay isTaring={isTaring} />
          <DripTrayContainer isTaring={isTaring}>
            <DripTray />
          </DripTrayContainer>
          <WeightContainer isTaring={isTaring}>
            <Weight />
          </WeightContainer>
          <BottomStatus>
            <Grams>{formattedWeight}g</Grams>
            <Label>
              <Text show={!isTaring && !isCalibrated}>set zero</Text>
              <Text
                show={isTaring && !isCalibrated}
                bordered={true}
                color={
                  notAllowCalibrate
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(255, 255, 255, 1)'
                }
              >
                calibrate
              </Text>
              <Text show={isCalibrated}>done</Text>
            </Label>
          </BottomStatus>
        </VerticalWrapper>
      </HorizontalWrapper>
    </>
  );
}
