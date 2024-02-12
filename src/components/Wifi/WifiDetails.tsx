import React, { useEffect, useState } from 'react';
import { SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getConfig as getWifiConfig } from '../store/features/wifi/wifi-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setScreen } from '../store/features/screens/screens-slice';
import { SwiperWrapper } from '../Swiper/SwiperWrapper';

import './wifiDetails.css';

export const WifiDetails = (): JSX.Element => {
  const [animationStyle, setAnimationStyle] = useState('');

  const dispatch = useAppDispatch();
  const { wifiStatus, pending } = useAppSelector((state) => state.wifi);

  useEffect(() => {
    dispatch(getWifiConfig());
  }, []);

  const onClick = (_activeId: string, activeIndex: number) => {
    if (activeIndex === 1) {
      dispatch(setScreen('wifiSettings'));
    }
  };

  if (pending) {
    return <LoadingScreen />;
  }

  return (
    <div className="main-layout content-center">
      <div className="wifi-options">
        <SwiperWrapper
          largeContentIndices={[0]}
          largeContentFadeClassNameTop="wifi-details-fade-top"
          largeContentFadeClassNameBottom="wifi-fade-bottom"
          onClick={onClick}
          setAnimationStyle={setAnimationStyle}
        >
          <SwiperSlide key="wifi-details" style={{ height: '190px' }}>
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
          <SwiperSlide key="exit" style={{ height: '60px' }}>
            <div className={`${animationStyle}`}>
              <div className="wifi-detail-wrapper">back</div>
            </div>
          </SwiperSlide>
        </SwiperWrapper>
      </div>
      <div className="fade fade-top wifi-details-fade-top"></div>
      <div className="fade fade-bottom wifi-fade-bottom"></div>
    </div>
  );
};
