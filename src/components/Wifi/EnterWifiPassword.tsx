import '../../assets/fonts/custom/css/fontello.css';

import { useDispatch } from 'react-redux';
// import { IPresetName } from '../../types';
import { PasswortConnect } from '../../types';

import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { connectToWifiThunk } from '../store/features/wifi/wifi-slice';
import { useAppSelector } from '../store/hooks';
import { SelectWifi } from './SelectWifi';
import { AppDispatch } from '../store/store';
import { ConnectWifi } from './ConnectWifi';

export function EnterWifiPassword(): JSX.Element {
  const { wifi } = useAppSelector((state) => state);
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );
  // const setting = presets.updatingSettings.settings[
  //   presets.activeSetting
  // ] as IPresetName;

  const dispatch: AppDispatch = useDispatch();

  const updateSetting = (password: string) => {
    console.log(
      'Log ~ EnterWifiPassword ~ ssid',
      wifi.selectedWifi,
      '~ password:',
      password
    );
    const ssid = wifi.selectedWifi;
    const config = { ssid: ssid, password: password } as PasswortConnect;
    dispatch(connectToWifiThunk(config));
    dispatch(setBubbleDisplay({ visible: true, component: ConnectWifi }));
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
