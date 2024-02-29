import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getConfig as getWifiConfig } from '../store/features/wifi/wifi-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { SwiperWrapper } from '../Swiper/SwiperWrapper';

import './wifiDetails.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { WifiSettings } from './WifiSettings';
import { QrImage } from './QrImage';

const items = [
  { key: 'network' },
  { key: 'hostname' },
  { key: 'ap_name' },
  { key: 'ap_password' },
  { key: 'back' }
];

export const WifiDetails = (): JSX.Element => {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dispatch = useAppDispatch();
  const { wifiStatus, pending, networkConfig } = useAppSelector(
    (state) => state.wifi
  );

  useEffect(() => {
    dispatch(getWifiConfig());
  }, []);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    click() {
      switch (items[activeIndex].key) {
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: WifiSettings })
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
        initialSlide={activeIndex}
        centeredSlides={true}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        <SwiperSlide
          key="network"
          className={`settings-item ${
            items[activeIndex].key === 'network' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>
            Network:
            <span>{wifiStatus?.connection_name}</span>
          </div>
        </SwiperSlide>

        <SwiperSlide
          key="hostname"
          className={`settings-item ${
            items[activeIndex].key === 'hostname' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>
            Hostname:
            <span>{wifiStatus?.hostname}</span>
          </div>
        </SwiperSlide>

        <SwiperSlide
          key="ap_name"
          style={{ height: '30px' }}
          className={`settings-item ${
            items[activeIndex].key === 'ap_name' ? 'active-setting' : ''
          }`}
        >
          <span>
            AP Name:
            <span
              style={{
                fontSize: `${
                  networkConfig?.apName.length > 14 ? '12px' : undefined
                }`
              }}
            >
              {networkConfig?.apName}
            </span>
          </span>
        </SwiperSlide>

        <SwiperSlide
          key="ap_password"
          className={`settings-item ${
            items[activeIndex].key === 'ap_password' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>
            AP Password:
            <span>{networkConfig?.apPassword}</span>
          </div>
        </SwiperSlide>

        {/* <SwiperSlide
          key="ips"
          className={`settings-item ${
            items[activeIndex].key === 'ips' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>Ips: {wifiStatus?.hostname}</div>
          <div>
            {(wifiStatus?.ips || []).map((ip) => (
              <div key={ip}>{ip}</div>
            ))}
          </div>
        </SwiperSlide> */}
        <SwiperSlide style={{ height: '300px' }}>
          <QrImage src={null} />
        </SwiperSlide>

        <SwiperSlide></SwiperSlide>
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
