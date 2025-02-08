import { useState } from 'react';

import '../../../QuickSettings/quick-settings.css';
import { useHandleGestures } from '../../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setBubbleDisplay } from '../../../store/features/screens/screens-slice';

import { useSetTime, useSettings } from '../../../../hooks/useSettings';
import { AnimatedCounter } from 'react-animated-counter/dist/esm';
import { styled } from 'styled-components';
import './TimeConfig.css';

const CLOCK_FONT_SIZE = 110;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 400px;
  height: 320px;
  padding-top: 100px;
  padding-right: 20px;

  justify-content: space-evenly;
  align-items: center;

  font-family: 'ABC Diatype Mono';
  font-size: 20px;
`;

const ClockWrapper = styled.div`
  display: flex;
  flex-direction: row;

  justify-content: center;
  align-items: center;

  font-family: 'ABC Diatype Mono';
  font-weight: 300;
  letter-spacing: '-0.02em';
  padding-top: 60px;
`;

const MinuteClock = styled.div`
  display: flex;
  flex-direction: row;

  justify-content: center;
  align-items: center;
`;

const HelpText = styled.div`
  display: flex;
  flex-direction: column;

  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  line-height: 1.2;
  padding-top: 50px;
  letter-spacing: 0.1em;
`;

const DigitContainerStyle = {
  margin: 0,
  fontSize: CLOCK_FONT_SIZE,
  fontFamily: 'ABC Diatype Mono',
  fontWeight: 300,
  letterSpacing: '-0.02em'
};

const ACTIVE_COLOR = '#f5c444';
const INACTIVE_COLOR = '#E6E6E6';

export function TimeConfig(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
  const [newTime, setNewTime] = useState(new Date());
  const [activeField, setActiveField] = useState<'hours' | 'minutes'>('hours');
  const setDateTime = useSetTime();

  const changeTime = (direction: number) => {
    if (activeField === 'hours') {
      const oneHour = 60 * 60 * 1000;
      setNewTime((prev) => new Date(prev.getTime() + oneHour * direction));
    } else {
      const oneMinute = 60 * 1000;
      setNewTime((prev) => new Date(prev.getTime() + oneMinute * direction));
    }
  };

  useHandleGestures(
    {
      left() {
        changeTime(-1);
      },
      right() {
        changeTime(1);
      },
      pressDown() {
        setActiveField((prev) => (prev === 'hours' ? 'minutes' : 'hours'));
      },
      longEncoder() {
        const set = new Date();
        set.setMinutes(newTime.getMinutes());
        set.setHours(newTime.getHours());
        setDateTime.mutate(set);
        dispatch(setBubbleDisplay({ visible: true, component: 'timeDate' }));
      },
      doubleClick() {
        dispatch(setBubbleDisplay({ visible: true, component: 'timeDate' }));
      }
    },
    !bubbleDisplay.visible
  );

  return (
    <Container>
      <span>{globalSettings?.time_zone}</span>
      {/* We render "HOURS : Minute/10 Minute%10" to ensure zero padding*/}
      <ClockWrapper>
        {/* The Animated Counter will not redraw on color change so we force it via css */}
        <div className={activeField === 'hours' ? 'activeClock' : ''}>
          <AnimatedCounter
            value={newTime.getHours()}
            color={INACTIVE_COLOR}
            decrementColor={ACTIVE_COLOR}
            incrementColor={ACTIVE_COLOR}
            includeDecimals={false}
            fontSize={`${CLOCK_FONT_SIZE}px`}
            containerStyles={{ ...DigitContainerStyle, minWidth: 130 }}
          />
        </div>

        {/* Clock seperating : */}
        <div style={DigitContainerStyle}>:</div>

        {/* Minutes */}
        <MinuteClock className={activeField === 'minutes' ? 'activeClock' : ''}>
          <AnimatedCounter
            value={Math.floor(newTime.getMinutes() / 10.0)}
            color={INACTIVE_COLOR}
            decrementColor={ACTIVE_COLOR}
            incrementColor={ACTIVE_COLOR}
            includeDecimals={false}
            fontSize={`${CLOCK_FONT_SIZE}px`}
            containerStyles={{ ...DigitContainerStyle, minWidth: 130 / 2 }}
          />
          <AnimatedCounter
            value={newTime.getMinutes() % 10}
            color={INACTIVE_COLOR}
            decrementColor={ACTIVE_COLOR}
            incrementColor={ACTIVE_COLOR}
            includeDecimals={false}
            fontSize={`${CLOCK_FONT_SIZE}px`}
            containerStyles={{ ...DigitContainerStyle, minWidth: 130 / 2 }}
          />
        </MinuteClock>
      </ClockWrapper>
      <HelpText>
        <span>long-press to confirm</span>
        <span>double-press to abort</span>
      </HelpText>
    </Container>
  );
}
