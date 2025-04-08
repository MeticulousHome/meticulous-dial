import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { QrImage } from './QrImage';
import './wifiDetails.css';
import { api } from '../../api/api';

const items = [{ key: 'back' }];

export const WifiQrMenu = (): JSX.Element => {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(items.length - 1);
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
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: 'wifiSettings' })
          );
          break;

        default:
          break;
      }
    }
  });

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

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
