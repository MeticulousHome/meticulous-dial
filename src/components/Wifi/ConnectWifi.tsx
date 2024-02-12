import React, { useState } from 'react';
import { SwiperSlide } from 'swiper/react';
import { useAppDispatch } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { SwiperWrapper } from '../Swiper/SwiperWrapper';

import './connectWifi.css';

export const ConnectWifi = (): JSX.Element => {
  const [animationStyle, setAnimationStyle] = useState('');
  const dispatch = useAppDispatch();

  const onClick = (_activeId: string, activeIndex: number) => {
    if (activeIndex === 0) {
      dispatch(setScreen('selectWifi'));
    }
    if (activeIndex === 2) {
      dispatch(setScreen('wifiSettings'));
    }
  };

  return (
    <div className="main-layout">
      <div className="connect-wifi-options">
        <SwiperWrapper onClick={onClick} setAnimationStyle={setAnimationStyle}>
          <SwiperSlide
            key="connect-via-app"
            className="connect-wifi-option-item"
            style={{ height: '60px' }}
          >
            <div className={`${animationStyle} center`}>connect via app</div>
          </SwiperSlide>
          <SwiperSlide
            key="choose-wifi"
            className="connect-wifi-option-item"
            style={{ height: '60px' }}
          >
            <div className={`${animationStyle} center`}>
              connect to a network
            </div>
          </SwiperSlide>
          <SwiperSlide
            key="exit"
            className="connect-wifi-option-item"
            style={{ height: '60px' }}
          >
            <div className={`${animationStyle}`}>back</div>
          </SwiperSlide>
        </SwiperWrapper>
      </div>
      <div className="fade fade-top connect-wifi-fade-top"></div>
      <div className="fade fade-bottom connect-wifi-fade-bottom"></div>
    </div>
  );
};
