import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { IPresetSetting, ISettingType } from '../../../src/types';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useProfileContext } from '../../context/ProfileContext';

interface Props {
  type: ISettingType;
}

const options = ['Yes', 'No'];

export function OnOff({ type }: Props): JSX.Element {
  const dispatch = useDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { settingsIndex, settingsProfile, setSettingsProfile } =
    useProfileContext();
  const setting = settingsProfile.settings.find(
    (setting: IPresetSetting) => setting.key === type
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
        setSettingsProfile((prev) => ({
          ...prev,
          settings: [
            ...prev.settings.slice(0, settingsIndex),
            { ...setting, value } as IPresetSetting,
            ...prev.settings.slice(settingsIndex + 1)
          ]
        }));
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
