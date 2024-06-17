import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { getConfig as getWifiConfig } from '../store/features/wifi/wifi-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import './wifiDetails.css';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useNotConnectedMessage } from '../../../src/hooks/useNotConnectedMessage';

const items = [
  { key: 'network' },
  { key: 'hostname' },
  { key: 'ap_name' },
  { key: 'ap_password' },
  { key: 'ips' },
  { key: 'mac' },
  { key: 'back' }
];

export const WifiDetails = (): JSX.Element => {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dispatch = useAppDispatch();
  const { wifiStatus, pending, networkConfig } = useAppSelector(
    (state) => state.wifi
  );
  const { getMessageIfIsConnected } = useNotConnectedMessage();

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
    pressDown() {
      switch (items[activeIndex].key) {
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: 'wifiSettings' })
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
          <div className="settings-entry text-container">
            <span className="settings-text">
              {marqueeIfNeeded({
                enabled: items[activeIndex].key === 'network',
                val:
                  'NETWORK:' +
                  getMessageIfIsConnected({
                    messageValue: wifiStatus?.connection_name
                  })
              })}
            </span>
          </div>
        </SwiperSlide>

        <SwiperSlide
          key="hostname"
          className={`settings-item ${
            items[activeIndex].key === 'hostname' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry text-container">
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`,
                wordBreak: 'break-word'
              }}
            >
              {marqueeIfNeeded({
                enabled: items[activeIndex].key === 'hostname',
                val:
                  'HOSTNAME:' +
                  getMessageIfIsConnected({
                    messageValue: wifiStatus?.hostname
                  })
              })}
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
          <div className="settings-entry text-container">
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded({
                enabled: items[activeIndex].key === 'ap_name',
                val:
                  'AP NAME:' +
                  getMessageIfIsConnected({
                    messageValue: networkConfig?.apName
                  })
              })}
            </span>
          </div>
        </SwiperSlide>
        <SwiperSlide
          key="ap_password"
          className={`settings-item ${
            items[activeIndex].key === 'ap_password' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry text-container">
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded({
                enabled: items[activeIndex].key === 'ap_password',
                val:
                  'AP PASSWORD:' +
                  getMessageIfIsConnected({
                    messageValue: networkConfig?.apPassword
                  })
              })}
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
          <div className="settings-entry text-container">
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded({
                enabled: items[activeIndex].key === 'ips',
                val:
                  'IP:' +
                  getMessageIfIsConnected({ messageValue: wifiStatus?.ips[0] })
              })}
            </span>
          </div>
        </SwiperSlide>
        <SwiperSlide key="mac" style={{ paddingBottom: '20px' }}>
          <div
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            className={`settings-entry text-container settings-item ${
              items[activeIndex].key === 'mac' ? 'active-setting' : ''
            }`}
          >
            <span
              className="settings-text"
              style={{
                fontSize: `${
                  wifiStatus?.hostname.length > 14 ? '18px' : undefined
                }`
              }}
            >
              {marqueeIfNeeded({
                enabled: items[activeIndex].key === 'mac',
                val:
                  'MAC:' +
                  getMessageIfIsConnected({ messageValue: wifiStatus?.mac })
              })}
            </span>
          </div>
        </SwiperSlide>
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
