import { useEffect, useState } from 'react';
import Marquee from 'react-fast-marquee';
import { Swiper, SwiperSlide } from 'swiper/react';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { getConfig as getWifiConfig } from '../store/features/wifi/wifi-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import { backendURL } from '../../api/wifi';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { WifiMode } from '../../types';
import { QrImage } from './QrImage';
import { WifiSettings } from './WifiSettings';
import './wifiDetails.css';

const items = [
  { key: 'network' },
  { key: 'hostname' },
  { key: 'ap_name' },
  { key: 'ap_password' },
  { key: 'ips' },
  { key: 'back' }
];

const marqueeIfNeeded = (enabled: boolean, val: string) => {
  if (enabled && val.length > 18) return <Marquee delay={0.6}>{val}</Marquee>;
  return <>{val}</>;
};

export const WifiDetails = (): JSX.Element => {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dispatch = useAppDispatch();
  const { wifiStatus, pending, networkConfig } = useAppSelector(
    (state) => state.wifi
  );

  const isWifiConnected = wifiStatus?.connected;
  const isApMode = isWifiConnected && networkConfig?.mode === WifiMode.AP;

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
          <div className="settings-entry">
            Network:
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded(
                items[activeIndex].key === 'network',
                wifiStatus?.connection_name
              )}
            </span>
          </div>
        </SwiperSlide>

        <SwiperSlide
          key="hostname"
          className={`settings-item ${
            items[activeIndex].key === 'hostname' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            Hostname:
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`,
                wordBreak: 'break-word'
              }}
            >
              {marqueeIfNeeded(
                items[activeIndex].key === 'hostname',
                wifiStatus?.hostname
              )}
            </span>
          </div>
        </SwiperSlide>

        <SwiperSlide
          key="ap_name"
          style={{ height: '30px' }}
          className={`settings-item ${
            items[activeIndex].key === 'ap_name' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            AP Name:
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded(
                items[activeIndex].key === 'ap_name',
                networkConfig?.apName
              )}
            </span>
          </div>
        </SwiperSlide>
        <SwiperSlide
          key="ap_password"
          className={`settings-item ${
            items[activeIndex].key === 'ap_password' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            AP Password:
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded(
                items[activeIndex].key === 'ap_password',
                networkConfig?.apPassword
              )}
            </span>
          </div>
        </SwiperSlide>

        <SwiperSlide
          key="ips"
          style={{ height: '30px' }}
          className={`settings-item ${
            items[activeIndex].key === 'ips' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            IP:
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded(
                items[activeIndex].key === 'ips',
                wifiStatus?.ips[0]
              )}
            </span>
          </div>
        </SwiperSlide>
        <SwiperSlide style={{ height: '300px' }}>
          <QrImage src={`${backendURL}/wifi/config/qr.png`} />
        </SwiperSlide>

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
