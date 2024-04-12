import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import './connectWifiMenu.css';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';

const items = [
  { key: 'connect-via-app' },
  { key: 'choose-wifi' },
  { key: 'back' }
];

export const ConnectWifiMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'connect-via-app': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'connectWifiViaApp' })
          );
          break;
        }
        case 'choose-wifi': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'selectWifi' })
          );
          break;
        }
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
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        <SwiperSlide
          key="connect-via-app"
          className={`settings-item ${
            items[activeIndex].key === 'connect-via-app' ? 'active-setting' : ''
          }`}
        >
          <div>Connect via APP</div>
        </SwiperSlide>
        <SwiperSlide
          key="choose-wifi"
          className={`settings-item ${
            items[activeIndex].key === 'choose-wifi' ? 'active-setting' : ''
          }`}
        >
          <div>Connect to a network</div>
        </SwiperSlide>
        <SwiperSlide
          key="back"
          className={`settings-item ${
            items[activeIndex].key === 'back' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>Back</div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
