import { useEffect } from 'react';
import 'swiper/css';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { QrImage } from './QrImage';
import './wifiDetails.css';
import { api } from '../../api/api';

export const WifiQrMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();

  //Auto-exit timer
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setBubbleDisplay({ visible: true, component: 'wifiSettings' }));
    }, 30000);

    // Cleanup timer on component unmount
    return () => clearTimeout(timer);
  }, []);

  useHandleGestures({
    pressDown() {
      dispatch(setBubbleDisplay({ visible: true, component: 'wifiSettings' }));
    }
  });

  return (
    <div className="main-quick-settings settings-explanation">
      <div
        className="settings-explanation-container"
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <QrImage
          src={`${api.getWiFiQRURL()}`}
          size={280}
          style={{ paddingRight: '100px' }}
          description="Scan with meticulous App to connect to the machine"
        />
        <div
          className={`settings-item active-setting`}
          style={{
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
