import { useMemo, useState } from 'react';
import { styled } from 'styled-components';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';

const LAB_MENU_PASSWORD = '0000';
const PIN_OPTIONS = [
  '0',
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
  'Back'
];

const PinStatus = styled.div`
  position: absolute;
  top: 118px;
  left: 0;
  right: 0;
  z-index: 20;
  color: #e0dcd0;
  font-family: 'ABC Diatype Mono';
  font-size: 18px;
  letter-spacing: 1.4px;
  line-height: 24px;
  text-align: center;
  text-transform: uppercase;
`;

export function LabUnlock(): JSX.Element {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('Enter lab PIN');

  const settings = useMemo(
    () =>
      PIN_OPTIONS.map((option) => ({
        key: option,
        label: option.length === 1 ? `PIN ${option}` : option,
        hasSeparator: option === '9'
      })),
    []
  );

  const resetInvalidPin = () => {
    setMessage('Invalid PIN');
    setPin('');
    window.setTimeout(() => setMessage('Enter lab PIN'), 1200);
  };

  const selectActiveOption = () => {
    const option = PIN_OPTIONS[activeIndex];

    if (option === 'Back') {
      dispatch(setScreen('settings'));
      return;
    }

    if (option === 'Clear') {
      setPin('');
      setMessage('Enter lab PIN');
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
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
    },
    pressDown() {
      selectActiveOption();
    }
  });

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings
      }),
    [activeIndex, settings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings
      }),
    [activeIndex, settings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <PinStatus>
          {message}: {pin.padEnd(LAB_MENU_PASSWORD.length, '-')}
        </PinStatus>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {settings.map((option) => (
            <Styled.Option key={option.key} $hasSeparator={option.hasSeparator}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {settings.map((option) => (
              <Styled.Option
                key={option.key}
                $hasSeparator={option.hasSeparator}
              >
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
}
