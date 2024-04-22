import '../../assets/fonts/custom/css/fontello.css';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import './deletedWifi.css';
import './wifiSettings.css';

export function DeletedWifi(): JSX.Element {
  const dispatch = useAppDispatch();
  const { pending, error, deletedWifiResult } = useAppSelector(
    (state) => state.wifi
  );

  useHandleGestures({
    pressDown() {
      if (!pending) {
        dispatch(setBubbleDisplay({ visible: false, component: null }));
        dispatch(setScreen('pressets'));
      }
    }
  });

  if (pending) {
    return <LoadingScreen />;
  }

  return (
    <div className="quick-settings">
      <div className={` deleted-response ${error ? 'error-entry' : ''}`}>
        {deletedWifiResult
          ? deletedWifiResult
          : error === true
          ? 'An unknown error occured. Please try again'
          : 'Connection could not be verified, please check the connection details'}
      </div>
      <br />
      <div key="back" className={`settings-item active-setting deleted-item`}>
        <div className="settings-entry deleted-button">Ok</div>
      </div>
    </div>
  );
}
