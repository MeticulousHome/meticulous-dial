import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';

import './connectWifiViaApp.css';
import './wifiDetails.css';

export const ConnectWifiViaApp = (): JSX.Element => {
  const dispatch = useAppDispatch();

  useHandleGestures({
    pressDown() {
      dispatch(
        setBubbleDisplay({ visible: true, component: 'connectWifiMenu' })
      );
    }
  });

  return (
    <div className="main-quick-settings settings-explanation-container">
      <div className="settings-explanation">
        <div className="settings-explanation-shaper-left" />
        <div className="settings-explanation-shaper-right" />
        <span className="wifi-help-text">
          To connect the machine to your existing WiFi download the meticulous
          App in the AppStore or PlayStore and select "Add Device" in the
          settings menu. An authentication will be requested if needed and the
          app will quide you through the process.
        </span>

        <div
          className={`settings-item active-setting`}
          style={{
            marginTop: 50,
            marginBottom: 80
          }}
        >
          <div
            className="settings-entry"
            style={{
              padding: '6px'
            }}
          >
            <span>Back</span>
          </div>
        </div>
      </div>
    </div>
  );
};
