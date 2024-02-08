import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getConfig as getWifiConfig } from '../store/features/wifi/wifi-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setScreen } from '../store/features/screens/screens-slice';

import './wifiDetails.css';

export const WifiDetails = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');

  const dispatch = useAppDispatch();
  const { wifiStatus, pending } = useAppSelector((state) => state.wifi);

  const swiperRef = useRef<SwiperRef>(null);

  useEffect(() => {
    dispatch(getWifiConfig());
  }, []);

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
      if (activeIndex === 1) {
        dispatch(setScreen('wifiSettings'));
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

  if (pending) {
    return <LoadingScreen />;
  }

  return (
    <div className="main-layout content-center">
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
          <SwiperSlide key="wifi-details">
            <div className={`${animationStyle} wifi-detail-wrapper`}>
              <div className="wifi-item">
                <div>network:</div>
                <div>{wifiStatus?.connection_name}</div>
              </div>
              <div className="wifi-item">
                <div>hostname:</div>
                <div>{wifiStatus?.hostname}</div>
              </div>
              <div className="wifi-item ip-item">
                <div>ips:</div>
                <div>
                  {(wifiStatus?.ips || []).map((ip) => (
                    <div key={ip} className="ip-value">
                      {ip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SwiperSlide>
          <SwiperSlide key="exit">
            <div className={`${animationStyle}`}>
              <div className="wifi-detail-wrapper">back</div>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
      <div className="fade fade-top wifi-details-fade-top"></div>
      <div className="fade fade-bottom wifi-fade-bottom"></div>
    </div>
  );
};
