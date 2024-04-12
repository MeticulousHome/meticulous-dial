import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { updatePresetSetting } from '../store/features/preset/preset-slice';
import { IPresetSetting } from '../../../src/types';

import './purge.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';

const options = ['Automatic', 'Manual'];

export function Purge(): JSX.Element {
  const setting = useAppSelector((state) =>
    state.presets?.updatingSettings.settings.find(
      (setting) => setting.key === 'purge'
    )
  );
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [activeIndex, setActiveIndex] = useState(
    setting?.value
      ? options.findIndex((option) => option.toLowerCase() === setting.value)
      : 0
  );

  const dispatch = useDispatch();

  useHandleGestures(
    {
      left() {
        if (activeIndex < options.length - 1) {
          setActiveIndex(activeIndex + 1);
        }
      },
      right() {
        if (activeIndex > 0) {
          setActiveIndex(activeIndex - 1);
        }
      },
      pressDown() {
        dispatch(
          updatePresetSetting({
            ...setting,
            value: options[activeIndex].toLowerCase()
          } as IPresetSetting)
        );
        dispatch(setScreen('pressetSettings'));
      }
    },
    bubbleDisplay.visible
  );

  return (
    <MultipleOptionSlider
      {...{
        activeIndex,
        options,
        extraClass: 'options--font-50'
      }}
    />
  );
}
