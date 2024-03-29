import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import './selectWifi.css';
import { WifiIcon } from './WifiIcon';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getWifis, selectWifi } from '../store/features/wifi/wifi-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';

export const SelectWifi = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { pending, wifiList = [] } = useAppSelector((state) => state.wifi);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, wifiList.length));
    },
    click() {
      if (activeIndex >= wifiList.length) {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'connectWifiMenu' })
        );
      } else {
        dispatch(setBubbleDisplay({ visible: false, component: null }));
        dispatch(selectWifi(wifiList[activeIndex].ssid));
        dispatch(setScreen('enterWifiPassword'));
      }
    }
  });

  useEffect(() => {
    dispatch(getWifis());
  }, []);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  if (pending) {
    return <LoadingScreen />;
  }

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
        {wifiList.length &&
          wifiList.map((network, index) => {
            const isActive = index === activeIndex;
            return (
              <SwiperSlide
                key={network.ssid}
                className={`settings-item ${isActive ? 'active-setting' : ''}`}
              >
                <div className="network-option">
                  <span>{network.ssid}</span>
                  <WifiIcon level={Math.min(wifiList.length - index, 4)} />
                </div>
              </SwiperSlide>
            );
          })}
        <SwiperSlide
          key="back"
          className={`settings-item ${
            activeIndex >= wifiList.length ? 'active-setting' : ''
          }`}
          style={{ height: '30px' }}
        >
          <div>Back</div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
