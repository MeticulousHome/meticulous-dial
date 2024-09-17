import '../../assets/fonts/custom/css/fontello.css';
import { useDispatch } from 'react-redux';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppSelector } from '../store/hooks';
import { AppDispatch } from '../store/store';
import { useConnectToWiFi, useNetworkConfig } from '../../hooks/useWifi';
import { useEffect, useMemo, useState } from 'react';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { useHandleGestures } from '../../hooks/useHandleGestures';

import './connectWifi.css';

export function EnterWifiPassword(): JSX.Element {
  const { wifi } = useAppSelector((state) => state);
  const { bubbleDisplay } = useAppSelector((state) => state.screen);
  const dispatch: AppDispatch = useDispatch();
  const [knownPassword, setKnownPassword] = useState<string | undefined>(
    undefined
  );

  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  const { data, isLoading } = useNetworkConfig();
  const connectToWifiMutation = useConnectToWiFi();
  useHandleGestures({
    pressDown() {
      if (connectToWifiMutation.isSuccess || connectToWifiMutation.isError) {
        dispatch(setScreen('pressets'));
      }
    }
  });

  const knownWifis = useMemo(() => {
    if (!data?.known_wifis) {
      return [];
    }

    return Object.keys(data?.known_wifis).map((key: string) => ({
      password: data.known_wifis[key],
      ssid: key
    })) as { password: string; ssid: string }[];
  }, [data]);

  useEffect(
    () =>
      setKnownPassword(
        knownWifis.find((knownWifi) => knownWifi.ssid === wifi.selectedWifi)
          ?.password
      ),
    [knownWifis]
  );

  const updateSetting = (password: string) => {
    console.log(
      'Log ~ EnterWifiPassword ~ ssid',
      wifi.selectedWifi,
      '~ password:',
      password
    );
    const ssid = wifi.selectedWifi;
    connectToWifiMutation.mutate({ ssid, password });
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

  if ((!data && isLoading) || connectToWifiMutation.isPending) {
    return <LoadingScreen />;
  }

  if (connectToWifiMutation.isError || connectToWifiMutation.isSuccess) {
    return (
      <div className="main-container response">
        {connectToWifiMutation.isError && (
          <div className={`connect-response error-entry`}>
            An unknown error occured. Please try again
            <>{connectToWifiMutation.failureReason}</>
          </div>
        )}
        {connectToWifiMutation.isSuccess && (
          <div className={`connect-response `}>Successfully Connected</div>
        )}
        <br />
        <div key="back" className={`settings-item active-setting connect-item`}>
          <div className="settings-entry connect-button">Ok</div>
        </div>
      </div>
    );
  }
  return (
    <CircleKeyboard
      name={`password for ${wifi.selectedWifi}`}
      defaultValue={knownPassword?.split('')}
      onSubmit={updateSetting}
      onCancel={onCancel}
    />
  );
}
