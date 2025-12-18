import { useEffect } from 'react';
import 'swiper/css';

import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch } from '../../store/hooks';
import { useHandleGestures } from '../../../hooks/useHandleGestures'; //'../hooks/useHandleGestures';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import { QrGeneratedImage } from '../../QR/QrImage';
import { api } from '../../../api/api';

export const InfoQRCode = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { data, isLoading } = useDeviceInfo();

  //Auto-exit timer
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setBubbleDisplay({ visible: true, component: 'deviceInfo' }));
    }, 30000);

    // Cleanup timer on component unmount
    return () => clearTimeout(timer);
  }, [data, isLoading]);

  useHandleGestures({
    pressDown() {
      dispatch(setBubbleDisplay({ visible: true, component: 'deviceInfo' }));
    }
  });

  return (
    <div className="main-quick-settings settings-explanation">
      <div
        className="settings-explanation-container"
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        {!isLoading ? (
          <>
            <QrGeneratedImage
              size={280}
              style={{ paddingRight: '100px' }}
              src={api.getWiFiQRURL()}
              value={`SN:${data.serial} BATCH:${data.batch_number} COLOR:${data.color.toUpperCase()}`}
              description="Scan with a QR Code scanner to get the SN, Batch & Color info of the machine"
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
          </>
        ) : (
          <span>Loading...</span>
        )}
      </div>
    </div>
  );
};
