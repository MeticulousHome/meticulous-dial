import { useState } from 'react';

import '../../../QuickSettings/quick-settings.css';
import { useHandleGestures } from '../../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setBubbleDisplay } from '../../../store/features/screens/screens-slice';

import { AnimatedCounter } from 'react-animated-counter/dist/esm';
import { styled } from 'styled-components';
import './TimeConfig.css';
import { useSetTime } from '../../../../hooks/useSettings';

const CLOCK_FONT_SIZE = 60;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 400px;
  height: 320px;
  padding-top: 100px;
  padding-right: 20px;

  justify-content: space-evenly;
  align-items: center;
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

export function DateConfig(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [newTime, setNewTime] = useState(new Date());
  const [activeField, setActiveField] = useState<'day' | 'month' | 'year'>(
    'day'
  );
  const setDateTime = useSetTime();

  const changeTime = (direction: number) => {
    if (activeField === 'day') {
      setNewTime((prev) => {
        const next = new Date(prev.getTime());
        next.setDate(next.getDate() + direction);
        return next;
      });
    } else if (activeField === 'month') {
      setNewTime((prev) => {
        const next = new Date(prev.getTime());
        next.setMonth(next.getMonth() + direction);
        return next;
      });
    } else {
      setNewTime((prev) => {
        const next = new Date(prev.getTime());
        next.setFullYear(next.getFullYear() + direction);
        return next;
      });
    }
  };

  useHandleGestures(
    {
      right() {
        changeTime(1);
      },
      left() {
        changeTime(-1);
      },
      pressDown() {
        setActiveField((prev) => {
          if (prev === 'day') {
            return 'month';
          }
          if (prev === 'month') {
            return 'year';
          }
          return 'day';
        });
        console.log(activeField);
      },
      longEncoder() {
        const set = new Date();
        set.setFullYear(newTime.getFullYear());
        set.setMonth(newTime.getMonth());
        set.setDate(newTime.getDate());
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
      <ClockWrapper>
        {/* The Animated Counter will not redraw on color change so we force it via css */}
        <div className={activeField === 'day' ? 'activeClock' : ''}>
          <AnimatedCounter
            value={newTime.getDate()}
            color={INACTIVE_COLOR}
            decrementColor={ACTIVE_COLOR}
            incrementColor={ACTIVE_COLOR}
            includeDecimals={false}
            fontSize={`${CLOCK_FONT_SIZE}px`}
            containerStyles={{ ...DigitContainerStyle, minWidth: 70 }}
          />
        </div>

        {/* Clock seperating : */}
        <div style={DigitContainerStyle}>.</div>

        {/* Month */}
        <div className={activeField === 'month' ? 'activeClock' : ''}>
          <AnimatedCounter
            value={newTime.getMonth() + 1}
            color={INACTIVE_COLOR}
            decrementColor={ACTIVE_COLOR}
            incrementColor={ACTIVE_COLOR}
            includeDecimals={false}
            fontSize={`${CLOCK_FONT_SIZE}px`}
            containerStyles={{ ...DigitContainerStyle, minWidth: 70 }}
          />
        </div>
        {/* Clock seperating : */}
        <div style={DigitContainerStyle}>.</div>

        {/* Year */}
        <div className={activeField === 'year' ? 'activeClock' : ''}>
          <AnimatedCounter
            value={newTime.getFullYear()}
            color={INACTIVE_COLOR}
            decrementColor={ACTIVE_COLOR}
            incrementColor={ACTIVE_COLOR}
            includeDecimals={false}
            fontSize={`${CLOCK_FONT_SIZE}px`}
            containerStyles={{ ...DigitContainerStyle, minWidth: 70 }}
          />
        </div>
      </ClockWrapper>
      <HelpText>
        <span>long-press to confirm</span>
        <span>double-press to abort</span>
      </HelpText>
    </Container>
  );
}
