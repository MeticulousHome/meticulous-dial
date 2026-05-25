import '../../assets/fonts/custom/css/fontello.css';
import { useDispatch } from 'react-redux';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppSelector } from '../store/hooks';
import { AppDispatch } from '../store/store';
import { useConnectToWiFi } from '../../hooks/useWifi';
import { useEffect, useRef, useState } from 'react';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useDimScreen } from '../../hooks/useDimScreen';
import {
  getWifiHealthMessage,
  getWifiHealthStatusLabel
} from './wifiHealthMessages';
import { selectWifi } from '../store/features/wifi/wifi-slice';
import { WiFiConnectionError } from '../../api/wifi';

import './wifiResult.css';

export function EnterWifiPassword(): JSX.Element {
  const { wifi } = useAppSelector((state) => state);
  const { bubbleDisplay } = useAppSelector((state) => state.screen);
  const dispatch: AppDispatch = useDispatch();
  const [knownPassword, setKnownPassword] = useState<string | undefined>(
    undefined
  );
  const knownConnectionSubmitted = useRef(false);

  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  const connectToWifiMutation = useConnectToWiFi();
  const connectionError = connectToWifiMutation.error as
    | WiFiConnectionError
    | undefined;
  const isInvalidCredentials =
    connectToWifiMutation.isError &&
    connectionError?.code === 'invalid_credentials';

  useDimScreen();
  useHandleGestures({
    pressDown() {
      if (connectToWifiMutation.isSuccess || connectToWifiMutation.isError) {
        if (isInvalidCredentials) {
          connectToWifiMutation.reset();
          if (wifi.selectedWifi) {
            dispatch(
              selectWifi({
                ssid: wifi.selectedWifi,
                useKnownCredentials: false
              })
            );
          }
          return;
        }
        dispatch(setScreen('profileHome'));
      }
    }
  });

  useEffect(() => {
    knownConnectionSubmitted.current = false;
  }, [wifi.selectedWifi, wifi.selectedWifiUseKnownCredentials]);

  useEffect(() => {
    if (
      !wifi.selectedWifiUseKnownCredentials ||
      !wifi.selectedWifi ||
      knownConnectionSubmitted.current
    ) {
      return;
    }

    knownConnectionSubmitted.current = true;
    connectToWifiMutation.mutate({ type: 'PSK', ssid: wifi.selectedWifi });
  }, [wifi.selectedWifi, wifi.selectedWifiUseKnownCredentials]);

  const updateSetting = (password: string) => {
    setKnownPassword(password);
    console.log(
      'Log ~ EnterWifiPassword ~ ssid',
      wifi.selectedWifi,
      '~ password:',
      password
    );
    const ssid = wifi.selectedWifi;
    connectToWifiMutation.mutate({ type: 'PSK', ssid, password });
  };

  const onCancel = () => {
    dispatch(setScreen(screen.prev || 'profileHome'));
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

  if (
    connectToWifiMutation.isPending ||
    (wifi.selectedWifiUseKnownCredentials &&
      !connectToWifiMutation.isError &&
      !connectToWifiMutation.isSuccess)
  ) {
    return <LoadingScreen />;
  }

  if (connectToWifiMutation.isError || connectToWifiMutation.isSuccess) {
    const connectHealth = connectToWifiMutation.data?.health;
    const hasConnectionWarning = Boolean(connectHealth?.degraded);

    return (
      <div className="main-container response">
        {connectToWifiMutation.isError && (
          <>
            <div className="connect-response-title error-entry">
              {isInvalidCredentials
                ? 'Incorrect password'
                : 'Could not connect to WiFi'}
            </div>
            <div className="connect-response-message error-entry">
              {connectToWifiMutation.failureReason?.message}
            </div>
          </>
        )}
        {connectToWifiMutation.isSuccess && (
          <>
            <div className="connect-response-title">Connected</div>
            {hasConnectionWarning && (
              <>
                <div className="connect-response-status">
                  {getWifiHealthStatusLabel(connectHealth, true)}
                </div>
                <div className="connect-response-message">
                  {getWifiHealthMessage(connectHealth)}
                </div>
              </>
            )}
          </>
        )}
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
      onChange={(text: string) => {
        setKnownPassword(text);
      }}
      capitalizeFirstLetter={false}
    />
  );
}
