import '../../assets/fonts/custom/css/fontello.css';

import { useDispatch } from 'react-redux';
// import { IPresetName } from '../../types';

import { useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import { SelectWifi } from './SelectWifi';

export function EnterWifiPassword(): JSX.Element {
  const { wifi } = useAppSelector((state) => state);
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );
  // const setting = presets.updatingSettings.settings[
  //   presets.activeSetting
  // ] as IPresetName;

  const dispatch = useDispatch();

  const updateSetting = (password: string) => {
    console.log('Log ~ updateSetting ~ password:', password);
    dispatch(setScreen(screen.prev));
    dispatch(setBubbleDisplay({ visible: true, component: SelectWifi }));
  };

  const onCancel = () => {
    dispatch(setScreen(screen.prev));
    dispatch(setBubbleDisplay({ visible: true, component: SelectWifi }));
  };

  return (
    <CircleKeyboard
      name={`password for ${wifi.selectedWifi}`}
      onSubmit={updateSetting}
      onCancel={onCancel}
    />
  );
}
