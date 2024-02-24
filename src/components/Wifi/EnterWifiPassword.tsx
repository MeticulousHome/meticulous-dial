import '../../assets/fonts/custom/css/fontello.css';

import { useDispatch } from 'react-redux';
import { IPresetName, IPresetSetting } from '../../types';

import { useAppSelector } from '../store/hooks';
import { updatePresetSetting } from '../store/features/preset/preset-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';

export function EnterWifiPassword(): JSX.Element {
  const { presets, wifi } = useAppSelector((state) => state);
  const setting = presets.updatingSettings.settings[
    presets.activeSetting
  ] as IPresetName;

  const dispatch = useDispatch();

  const updateSetting = (password: string) => {
    console.log('Log ~ updateSetting ~ password:', password);
    dispatch(setScreen('selectWifi'));
  };

  const onCancel = () => {
    dispatch(setScreen('selectWifi'));
  };

  return (
    <CircleKeyboard
      name={`password for ${wifi.selectedWifi}`}
      // type="password"
      onSubmit={updateSetting}
      onCancel={onCancel}
    />
  );
}
