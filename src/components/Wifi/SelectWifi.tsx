import React, { useEffect, useState } from 'react';
import { SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { getWifis, selectWifi } from '../store/features/wifi/wifi-slice';
import { WifiIcon } from './WifiIcon';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { SwiperWrapper } from '../Swiper/SwiperWrapper';

import './selectWifi.css';

export const SelectWifi = (): JSX.Element => {
  const [animationStyle, setAnimationStyle] = useState('');

  const dispatch = useAppDispatch();
  const { pending, wifiList = [] } = useAppSelector((state) => state.wifi);

  const onClick = (_activeId: string, activeIndex: number) => {
    if (activeIndex === wifiList.length) {
      dispatch(setScreen('connectWifi'));
    } else {
      dispatch(selectWifi(wifiList[activeIndex].ssid));
      dispatch(setScreen('enterWifiPassword'));
    }
  };

  useEffect(() => {
    dispatch(getWifis());
  }, []);

  if (pending) {
    return <LoadingScreen />;
  }

  return (
    <div className="main-layout">
      <div className="settings-options">
        <SwiperWrapper onClick={onClick} setAnimationStyle={setAnimationStyle}>
          {wifiList.length &&
            wifiList.map((network, index) => {
              return (
                <SwiperSlide
                  className="setting-option-item"
                  key={`option-${index}`}
                  style={{ height: '60px' }}
                >
                  <div className={`${animationStyle} network-option`}>
                    <span>{network.ssid}</span>
                    <WifiIcon level={Math.min(wifiList.length - index, 4)} />
                  </div>
                </SwiperSlide>
              );
            })}
          <SwiperSlide
            className="setting-option-item"
            key="cancel"
            style={{ height: '60px' }}
          >
            <div className={`${animationStyle} network-option`}>cancel</div>
          </SwiperSlide>
        </SwiperWrapper>
      </div>
      <div className="fade fade-top"></div>
      <div className="fade fade-bottom"></div>
    </div>
  );
};
