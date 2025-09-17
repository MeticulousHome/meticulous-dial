import { useMemo, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { SettingsItem } from '../../../types';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import Styled, { VIEWPORT_HEIGHT } from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';
import { useFactoryReset } from '../../../hooks/useMachine';
import { LoadingScreen } from '../../../components/LoadingScreen/LoadingScreen';

export const FactoryReset = () => {
  const dispatch = useAppDispatch();
  const factoryReset = useFactoryReset();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings: SettingsItem[] = [
    {
      key: 'back1',
      label: 'Back',
      visible: true
    },
    {
      key: 'back2',
      label: 'Back',
      visible: true
    },
    {
      key: 'factory_reset',
      label: '!! Factory reset !!',
      visible: true
    },
    {
      key: 'back3',
      label: 'Back',
      visible: true
    },
    {
      key: 'back4',
      label: 'Back',
      visible: true
    },
    {
      key: 'back5',
      label: 'Back',
      visible: true
    }
  ];

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
      },
      pressDown() {
        const activeItem = settings[activeIndex].key;
        switch (activeItem) {
          case 'factory_reset':
            factoryReset.mutate();
            break;
          default:
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
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

  if (factoryReset.isPending || factoryReset.isSuccess) {
    return <LoadingScreen />;
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {settings.map((option) => {
            return (
              <Styled.SelectedOption key={option.key}>
                <span>{option.label}</span>
              </Styled.SelectedOption>
            );
          })}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {settings.map((option) => {
              return (
                <Styled.SelectedOption key={option.key}>
                  <span>{option.label}</span>
                </Styled.SelectedOption>
              );
            })}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
