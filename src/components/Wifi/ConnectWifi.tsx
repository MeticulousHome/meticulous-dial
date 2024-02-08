import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';

import './connectWifi.css';

export const ConnectWifi = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');

  const swiperRef = useRef<SwiperRef>(null);

  const dispatch = useAppDispatch();

  useHandleGestures({
    left() {
      setActiveIndex(0);
    },
    right() {
      setActiveIndex(1);
    },
    click() {
      if (activeIndex === 0) {
        dispatch(setScreen('selectWifi'));
      }
    }
  });

  useEffect(() => {
    if (swiperRef.current?.swiper) {
      try {
        swiperRef.current.swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error, location: 'ConnectWifi' });
      }
    }
  }, [activeIndex]);

  return (
    <div className="main-layout">
      <div className="connect-wifi-options">
        <Swiper
          ref={swiperRef}
          slidesPerView={2}
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
          <SwiperSlide className="connect-wifi-option-item">
            <div
              className={`${animationStyle} ${
                activeIndex === 0 ? `item-active` : ''
              } center`}
            >
              connect to a network
            </div>
          </SwiperSlide>
          <SwiperSlide className="connect-wifi-option-item">
            <div
              className={`${animationStyle} ${
                activeIndex === 1 ? `item-active` : ''
              } center`}
            >
              connect via app
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
      <div className="fade fade-top connect-wifi-fade-top"></div>
      <div className="fade fade-bottom connect-wifi-fade-bottom"></div>
    </div>
  );
};
