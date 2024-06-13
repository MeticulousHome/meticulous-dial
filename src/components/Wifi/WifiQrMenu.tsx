import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { getConfig as getWifiConfig } from '../store/features/wifi/wifi-slice';
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

  useEffect(() => {
    dispatch(getWifiConfig());
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
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
        autoHeight={false}
        initialSlide={activeIndex}
        centeredSlides={true}
        style={{ paddingLeft: '29px', top: '-20px' }}
      >
        <SwiperSlide key="qr" style={{ paddingBottom: '130px' }}>
          <QrImage
            src={`${api.getWiFiQRURL()}`}
            size={280}
            style={{ paddingRight: '30px' }}
            description="Scan with meticulous App to connect to the machine"
          />
        </SwiperSlide>
        <SwiperSlide
          key="back"
          className={`settings-item ${
            items[activeIndex].key === 'back' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            <span>Back</span>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
