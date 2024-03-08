import '../../assets/fonts/custom/css/fontello.css';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import './connectWifi.css';
import './wifiSettings.css';

export function ConnectWifi(): JSX.Element {
  const dispatch = useAppDispatch();
  const { pending, error, connectionResult } = useAppSelector(
    (state) => state.wifi
  );

  useHandleGestures({
    click() {
      if (!pending) {
        dispatch(setBubbleDisplay({ visible: false, component: null }));
        dispatch(setScreen('pressets'));
      }
    }
  });

  if (pending) {
    return <LoadingScreen />;
  }

  console.log("error is", error)
  return (
    <div className="quick-settings">
      <div
        className={` connect-response ${error ? 'error-entry' : ''}`}
      >
        {connectionResult ? connectionResult : error === true
          ? 'An unknown error occured. Please try again'
          : 'Connection could not be verified, please check the connection details'}
      </div>
      <br />
      <div
        key="back"
        className={`settings-item active-setting connect-item`}
      >
        <div className="settings-entry connect-button">Ok</div>
      </div>
    </div>
  );
}
