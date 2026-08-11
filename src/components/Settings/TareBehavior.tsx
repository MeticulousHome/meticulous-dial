import { useEffect, useMemo, useRef, useState } from 'react';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import Styled, {
  MenuAnnotation,
  VIEWPORT_HEIGHT
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import type { TareBehavior } from '../../types';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

type TareBehaviorOption = {
  key: TareBehavior | 'back';
  label: string;
};

const options: TareBehaviorOption[] = [
  { key: 'after_retraction', label: 'After retraction' },
  { key: 'before_retraction', label: 'Before retraction' },
  { key: 'back', label: 'Back' }
];

export const TareBehaviorSetting = () => {
  const dispatch = useAppDispatch();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(() => {
    const selected = options.findIndex(
      (option) => option.key === globalSettings?.tare_behavior
    );
    return selected >= 0 ? selected : 0;
  });
  const initializedFromSettings = useRef(Boolean(globalSettings));

  useEffect(() => {
    if (!initializedFromSettings.current && globalSettings) {
      const selected = options.findIndex(
        (option) => option.key === globalSettings.tare_behavior
      );
      setActiveIndex(selected >= 0 ? selected : 0);
      initializedFromSettings.current = true;
    }
  }, [globalSettings]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((previous) => Math.max(previous - 1, 0));
      },
      right() {
        setActiveIndex((previous) =>
          Math.min(previous + 1, options.length - 1)
        );
      },
      pressDown() {
        const selected = options[activeIndex].key;
        if (selected === 'back') {
          dispatch(setScreen(prevScreen));
          dispatch(
            setBubbleDisplay({ visible: true, component: 'brewSettings' })
          );
          return;
        }

        updateSettings.mutate({ tare_behavior: selected });
      }
    },
    !bubbleDisplay.interceptsGesture
  );

  const optionPositionOuter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: options
      }),
    [activeIndex]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: options
      }),
    [activeIndex]
  );

  const renderOption = (option: TareBehaviorOption, inner = false) => {
    const isCurrent = globalSettings?.tare_behavior === option.key;
    return (
      <Styled.SelectedOption key={option.key}>
        <span>{option.label}</span>
        {isCurrent && (
          <MenuAnnotation $marginRigth={inner ? undefined : '1.2rem'}>
            current
          </MenuAnnotation>
        )}
      </Styled.SelectedOption>
    );
  };

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOuter}>
          {options.map((option) => renderOption(option))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {options.map((option) => renderOption(option, true))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
