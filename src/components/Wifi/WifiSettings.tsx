import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateConfig } from '../store/features/wifi/wifi-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { AppMode } from '../../types';

import './wifiSettings.css';

export const WifiSettings = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');
  const { wifiStatus, networkConfig } = useAppSelector((state) => state.wifi);
  console.log('Log ~ WifiSettings ~ wifiStatus:', wifiStatus);

  const isWifiConnected = wifiStatus?.connected;
  const isAppMode = isWifiConnected && networkConfig?.mode === AppMode.AP;
  const isClientMode =
    isWifiConnected && networkConfig?.mode === AppMode.CLIENT;

  const swiperRef = useRef<SwiperRef>(null);
  console.log('Log ~ WifiSettings ~ swiperRef:', swiperRef);

  const dispatch = useAppDispatch();

  useHandleGestures({
    left() {
      setActiveIndex((prev) =>
        Math.min(
          prev + 1,
          (swiperRef?.current?.swiper?.slides || []).length - 1
        )
      );
    },
    right() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    click() {
      if (activeIndex === 1) {
        dispatch(setScreen('wifiDetails'));
      }
      if (activeIndex === 2) {
        dispatch(
          updateConfig({
            ...networkConfig,
            mode:
              networkConfig.mode === AppMode.AP ? AppMode.CLIENT : AppMode.AP
          })
        );
      }
      if (activeIndex === 3) {
        dispatch(setScreen('connectWifi'));
      }
    }
  });

  useEffect(() => {
    if (swiperRef.current?.swiper) {
      try {
        swiperRef.current.swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error, location: 'WifiSettings' });
      }
    }
  }, [activeIndex]);

  return (
    <div className="main-layout">
      <div className="wifi-options">
        <Swiper
          ref={swiperRef}
          slidesPerView={3}
          allowTouchMove={false}
          initialSlide={activeIndex}
          direction="vertical"
          autoHeight={true}
          centeredSlides={true}
          onSlideNextTransitionStart={() => {
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          <SwiperSlide key="wifi-status" className="wifi-option-item">
            <div className={`${animationStyle} center`}>
              status: &nbsp;
              {isWifiConnected ? 'connected' : 'not connected'}
            </div>
          </SwiperSlide>

          {isWifiConnected && (
            <>
              <SwiperSlide key="wifi-config" className="wifi-option-item">
                <div className={`${animationStyle} center`}>
                  see current configuration
                </div>
              </SwiperSlide>
              <SwiperSlide key="app-mode" className="wifi-option-item">
                <div className={`${animationStyle} center`}>
                  network mode: &nbsp; {networkConfig?.mode}
                </div>
              </SwiperSlide>
            </>
          )}

          <SwiperSlide key="connect-wifi" className="wifi-option-item">
            <div className={`${animationStyle} center`}>
              connect to a new network
            </div>
          </SwiperSlide>

          {isAppMode && (
            <>
              <SwiperSlide key="app-details" className="wifi-option-item">
                <div className={`${animationStyle} center`}>
                  <div>connect to the machine:</div>
                  <div className="wifi-item">{`network: ${wifiStatus?.connection_name}`}</div>
                  <div className="wifi-item">{`hostname: ${wifiStatus?.hostname}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide key="app-credentials" className="wifi-option-item">
                <div className={`${animationStyle} center`}>
                  <div className="wifi-item">{`app name: ${networkConfig?.apName}`}</div>
                  <div className="wifi-item">{`app password: ${networkConfig?.apPassword}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide key="wifi-qr" className="wifi-option-item">
                <div className={`${animationStyle} center`}>
                  scan to connect wifi:
                  <div className="qr-wrapper"></div>
                </div>
              </SwiperSlide>
            </>
          )}

          {isClientMode && (
            <>
              <SwiperSlide key="wifi-qr" className="wifi-option-item">
                <div className={`${animationStyle} center`}>
                  scan to connect to this machine:
                  <div className="qr-wrapper"></div>
                </div>
              </SwiperSlide>
            </>
          )}
        </Swiper>
      </div>
      <div className="fade fade-top wifi-fade-top"></div>
      <div className="fade fade-bottom wifi-fade-bottom"></div>
    </div>
  );
};
