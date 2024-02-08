import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { getWifis, selectWifi } from '../store/features/wifi/wifi-slice';
import { WifiIcon } from './WifiIcon';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

import './selectWifi.css';

export const SelectWifi = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');

  const swiperRef = useRef<SwiperRef>(null);

  const dispatch = useAppDispatch();
  const { pending, wifiList } = useAppSelector((state) => state.wifi);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) =>
        Math.min(
          prev + 1,
          (swiperRef?.current?.swiper?.slides || []).length - 1
        )
      );
    },
    click() {
      if (activeIndex === wifiList.length) {
        dispatch(setScreen('wifiSettings'));
      } else {
        dispatch(selectWifi(wifiList[activeIndex].ssid));
        dispatch(setScreen('enterWifiPassword'));
      }
    }
  });

  useEffect(() => {
    if (swiperRef.current?.swiper) {
      try {
        swiperRef.current.swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error, location: 'Wifi' });
      }
    }
  }, [activeIndex]);

  useEffect(() => {
    dispatch(getWifis());
  }, []);

  if (pending) {
    return <LoadingScreen />;
  }

  return (
    <div className="main-layout">
      <div className="settings-options">
        <Swiper
          ref={swiperRef}
          slidesPerView={9}
          allowTouchMove={false}
          initialSlide={activeIndex}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          onSlideNextTransitionStart={() => {
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {wifiList.length &&
            wifiList.map((network, index) => {
              return (
                <SwiperSlide
                  className="setting-option-item"
                  key={`option-${index}`}
                >
                  <div className={`${animationStyle} network-option`}>
                    <span>{network.ssid}</span>
                    <WifiIcon level={Math.min(wifiList.length - index, 4)} />
                  </div>
                </SwiperSlide>
              );
            })}
          <SwiperSlide className="setting-option-item" key="cancel">
            <div className={`${animationStyle} network-option`}>cancel</div>
          </SwiperSlide>
        </Swiper>
      </div>
      <div className="fade fade-top"></div>
      <div className="fade fade-bottom"></div>
    </div>
  );
};
