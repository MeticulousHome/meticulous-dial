import { useMemo, useState } from 'react';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { SettingsItem } from '../../types';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

// Features that are not yet part of the product live here, one menu away from
// the quick settings, so they can be reached without cluttering the settings.
const initialSettings: SettingsItem[] = [
  {
    key: 'manual_mode',
    label: 'Manual mode'
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export function ExperimentalSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, initialSettings.length - 1)
        );
      },
      pressDown() {
        switch (initialSettings[activeIndex].key) {
          case 'manual_mode':
            // The menu opens entries on pressDown. Keep the setup screen
            // blocked until the bubble finishes closing so the release of the
            // same physical press cannot resolve into a click that accepts
            // the temperature step before it was ever shown.
            dispatch(
              setBubbleDisplay({
                visible: false,
                component: null,
                interceptsGesture: true
              })
            );
            dispatch(setScreen('manualSetup'));
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
          default:
            break;
        }
      }
    },
    !bubbleDisplay.interceptsGesture
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: initialSettings
      }),
    [activeIndex]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: initialSettings
      }),
    [activeIndex]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {initialSettings.map((option) => (
            <Styled.Option key={option.key}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {initialSettings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $isMarquee={
                  activeIndex === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
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
