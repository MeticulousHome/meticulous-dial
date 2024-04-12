import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';

import './connectWifiViaApp.css';
import './wifiDetails.css';

const items = [{ key: 'content' }, { key: 'back' }];

export const ConnectWifiViaApp = (): JSX.Element => {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dispatch = useAppDispatch();

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
            setBubbleDisplay({ visible: true, component: 'connectWifiMenu' })
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
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        <SwiperSlide key="content">
          <div className="wifi-help-text">
            To connect the machine to your existing WiFi download the meticulous
            App in the AppStore or PlayStore and select "Add Device" in the
            settings menu. An authentication will be requested if needed and the
            app will quide you through the process.
          </div>
        </SwiperSlide>
        <SwiperSlide></SwiperSlide>
        <SwiperSlide></SwiperSlide>

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
