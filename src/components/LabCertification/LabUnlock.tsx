import { useMemo, useState } from 'react';
import { styled } from 'styled-components';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';

const LAB_MENU_PASSWORD = '0000';
const PIN_OPTIONS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'Clear',
  '0',
  'Back'
] as const;
const PIN_OPTION_RADIUS = 156;

type PinOption = (typeof PIN_OPTIONS)[number];

const UnlockScreen = styled.div`
  position: relative;
  width: 480px;
  height: 480px;
  overflow: hidden;
  background: #000;
  color: #e0dcd0;
  font-family: 'ABC Diatype Mono';
`;

const CenterStatus = styled.div`
  position: absolute;
  top: 178px;
  left: 120px;
  width: 240px;
  text-align: center;
`;

const PinTitle = styled.div`
  font-size: 17px;
  line-height: 24px;
`;

const PinDigits = styled.div`
  margin-top: 12px;
  font-size: 30px;
  line-height: 34px;
  letter-spacing: 8px;
`;

const PinPad = styled.div`
  position: absolute;
  inset: 0;
`;

const PinPadOption = styled.button<{ $active: boolean; $wide: boolean }>`
  position: absolute;
  top: 240px;
  left: 240px;
  width: ${({ $wide }) => ($wide ? '74px' : '48px')};
  height: 48px;
  margin-top: -24px;
  margin-left: ${({ $wide }) => ($wide ? '-37px' : '-24px')};
  padding: 0;
  border: 0;
  border-radius: 24px;
  background: ${({ $active }) => ($active ? '#f5c84b' : 'transparent')};
  color: ${({ $active }) => ($active ? '#000' : '#817d74')};
  font: inherit;
  font-size: ${({ $wide }) => ($wide ? '13px' : '22px')};
  line-height: 48px;
  text-align: center;
  text-transform: uppercase;
`;

const getPinOptionTransform = (index: number) => {
  const angle = -90 + (360 / PIN_OPTIONS.length) * index;
  const radians = (angle * Math.PI) / 180;
  const x = Math.cos(radians) * PIN_OPTION_RADIUS;
  const y = Math.sin(radians) * PIN_OPTION_RADIUS;
  return `translate(${x}px, ${y}px)`;
};

const maskPin = (pin: string) =>
  Array.from({ length: LAB_MENU_PASSWORD.length }, (_, index) =>
    index < pin.length ? '*' : '_'
  ).join(' ');

export function LabUnlock(): JSX.Element {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('Enter LAB Pin');

  const pinOptions = useMemo(() => PIN_OPTIONS, []);

  const resetInvalidPin = () => {
    setMessage('Invalid PIN');
    setPin('');
    window.setTimeout(() => setMessage('Enter LAB Pin'), 1200);
  };

  const selectOption = (option: PinOption) => {
    if (option === 'Back') {
      dispatch(setScreen('ready'));
      return;
    }

    if (option === 'Clear') {
      setPin('');
      setMessage('Enter LAB Pin');
      return;
    }

    const nextPin = `${pin}${option}`;
    setPin(nextPin);

    if (nextPin.length < LAB_MENU_PASSWORD.length) {
      return;
    }

    if (nextPin === LAB_MENU_PASSWORD) {
      dispatch(setScreen('labCertification'));
      return;
    }

    resetInvalidPin();
  };

  useHandleGestures({
    left() {
      setActiveIndex((prev) =>
        prev === 0 ? PIN_OPTIONS.length - 1 : prev - 1
      );
    },
    right() {
      setActiveIndex((prev) => (prev + 1) % PIN_OPTIONS.length);
    },
    pressDown() {
      selectOption(PIN_OPTIONS[activeIndex]);
    }
  });

  return (
    <UnlockScreen>
      <CenterStatus>
        <PinTitle>{message}</PinTitle>
        <PinDigits>{maskPin(pin)}</PinDigits>
      </CenterStatus>
      <PinPad>
        {pinOptions.map((option, index) => (
          <PinPadOption
            key={option}
            $active={activeIndex === index}
            $wide={option.length > 1}
            style={{ transform: getPinOptionTransform(index) }}
            onClick={() => selectOption(option)}
          >
            {option}
          </PinPadOption>
        ))}
      </PinPad>
    </UnlockScreen>
  );
}
