import '../../assets/fonts/custom/css/fontello.css';

import { useDispatch } from 'react-redux';
import { IPresetName, IPresetSetting } from '../../types';

import { useAppSelector } from '../store/hooks';
import { updatePresetSetting } from '../store/features/preset/preset-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';

export function EditNameScreen(): JSX.Element {
  const { presets } = useAppSelector((state) => state);
  const setting = presets.updatingSettings.settings[
    presets.activeSetting
  ] as IPresetName;

  const dispatch = useDispatch();

  const updateSetting = (updatedText: string) => {
    const updatedSetting = {
      ...setting,
      value: updatedText
    } as IPresetSetting;
    dispatch(updatePresetSetting(updatedSetting));
    dispatch(setScreen('pressetSettings'));
  };

  const onCancel = () => {
    dispatch(setScreen('pressetSettings'));
  };

  return (
    <CircleKeyboard
      name="name"
      defaultValue={setting.value.toString().split('')}
      onSubmit={updateSetting}
      onCancel={onCancel}
    />
  );
}
