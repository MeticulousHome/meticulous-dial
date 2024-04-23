import '../../assets/fonts/custom/css/fontello.css';
import { useDispatch } from 'react-redux';
import { PasswortConnect } from '../../types';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { connectToWifiThunk } from '../store/features/wifi/wifi-slice';
import { useAppSelector } from '../store/hooks';
import { AppDispatch } from '../store/store';

export function EnterWifiPassword(): JSX.Element {
  const { wifi } = useAppSelector((state) => state);
  const { bubbleDisplay } = useAppSelector((state) => state.screen);
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

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
    dispatch(setBubbleDisplay({ visible: true, component: 'connectWifi' }));
  };

  const onCancel = () => {
    dispatch(setScreen(screen.prev));
    dispatch(
      setBubbleDisplay({
        visible: true,
        component:
          bubbleDisplay.previousComponent === 'deleteKnowWifiMenu'
            ? 'deleteKnowWifiMenu'
            : 'selectWifi'
      })
    );
  };

  return (
    <CircleKeyboard
      name={`password for ${wifi.selectedWifi}`}
      defaultValue={
        bubbleDisplay.previousComponent === 'deleteKnowWifiMenu'
          ? wifi.knownWifis
              .find((knownWifi) => knownWifi.ssid === wifi.selectedWifi)
              ?.password.split('') ?? undefined
          : undefined
      }
      onSubmit={updateSetting}
      onCancel={onCancel}
    />
  );
}
