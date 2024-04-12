import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { updatePresetSetting } from '../store/features/preset/preset-slice';
import { IPresetSetting, ISettingType } from '../../../src/types';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';

interface Props {
  type: ISettingType;
}

const options = ['Yes', 'No'];

export function OnOff({ type }: Props): JSX.Element {
  const dispatch = useDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const setting = useAppSelector((state) =>
    state.presets.updatingSettings.settings.find(
      (setting) => setting.key === type
    )
  );

  const [activeIndex, setActiveIndex] = useState(
    setting?.value
      ? options.findIndex((option) => option.toLowerCase() === setting.value)
      : 0
  );

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
      },
      right() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      pressDown() {
        const value = options[activeIndex].toLowerCase();
        dispatch(
          updatePresetSetting({
            ...setting,
            value
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
        spaceBetween: -40
      }}
    />
  );
}
