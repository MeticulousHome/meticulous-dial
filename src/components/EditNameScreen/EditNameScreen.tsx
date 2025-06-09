import '../../assets/fonts/custom/css/fontello.css';

import { useDispatch } from 'react-redux';
import { IPresetSetting } from '../../types';

import { setScreen } from '../store/features/screens/screens-slice';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import { useDimScreen } from '../../hooks/useDimScreen';
import { useProfileContext } from '../../context/ProfileContext';
import { useState } from 'react';
export function EditNameScreen(): JSX.Element {
  const { settingsIndex, settingsProfile, setSettingsProfile } =
    useProfileContext();
  const setting = settingsProfile.settings[settingsIndex];
  const [updatedName, setUpdatedName] = useState<string>(
    setting.value.toString()
  );

  const dispatch = useDispatch();

  useDimScreen();

  const updateSetting = (updatedText: string) => {
    const updatedSetting = {
      ...setting,
      value: updatedText
    } as IPresetSetting;
    setSettingsProfile((prev) => ({
      ...prev,
      settings: [
        ...prev.settings.slice(0, settingsIndex),
        updatedSetting,
        ...prev.settings.slice(settingsIndex + 1)
      ]
    }));
    dispatch(setScreen('pressetSettings'));
  };

  const onCancel = () => {
    dispatch(setScreen('pressetSettings'));
  };

  return (
    <CircleKeyboard
      name="name"
      defaultValue={updatedName.split('')}
      onSubmit={updateSetting}
      onCancel={onCancel}
      onChange={(text: string) => {
        setUpdatedName(text);
      }}
    />
  );
}
