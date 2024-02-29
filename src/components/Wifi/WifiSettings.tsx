import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import './wifiSettings.css';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateConfig } from '../store/features/wifi/wifi-slice';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { AppMode } from '../../types';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { QuickSettings } from '../QuickSettings/QuickSettings';
import { WifiDetails } from './WifiDetails';
import { ConnectWifi } from './ConnectWifi';

export const WifiSettings = (): JSX.Element => {
  const { wifiStatus, networkConfig } = useAppSelector((state) => state.wifi);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isWifiConnected = wifiStatus?.connected;
  const isAppMode = isWifiConnected && networkConfig?.mode === AppMode.AP;
  const isClientMode =
    isWifiConnected && networkConfig?.mode === AppMode.CLIENT;

  const dispatch = useAppDispatch();

  const wifiSettingItems = [
    {
      key: 'status',
      label: 'Status',
      value: isWifiConnected ? 'connected' : 'not connected',
      visible: isWifiConnected
    },
    {
      key: 'network_mode',
      label: 'Network mode',
      value: networkConfig?.mode === AppMode.AP ? 'AP' : 'Client',
      visible: isWifiConnected
    },
    {
      key: 'details',
      label: 'See network details',
      visible: isAppMode
    },
    {
      key: 'connect_new_network',
      label: 'Connect to a new network',
      visible: !isWifiConnected || isClientMode
    },
    {
      key: 'back',
      label: 'Back',
      visible: true
    }
  ];

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) =>
        Math.min(
          prev + 1,
          wifiSettingItems.filter((item) => item.visible).length - 1
        )
      );
    },
    click() {
      const filter = wifiSettingItems.filter((item) => item.visible)[
        activeIndex
      ].key;
      switch (filter) {
        case 'network_mode': {
          const mode =
            networkConfig.mode === AppMode.AP ? AppMode.CLIENT : AppMode.AP;
          dispatch(updateConfig({ ...networkConfig, mode }));
          break;
        }
        case 'details': {
          dispatch(setBubbleDisplay({ visible: true, component: WifiDetails }));
          break;
        }
        case 'back': {
          dispatch(
            setBubbleDisplay({ visible: true, component: QuickSettings })
          );
          break;
        }
        case 'connect_new_network': {
          dispatch(setBubbleDisplay({ visible: true, component: ConnectWifi }));
          break;
        }
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

  return (
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
        autoHeight={false}
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        {wifiSettingItems
          .filter((item) => item.visible)
          .map((item, index) => {
            if (!item.visible) return <></>;

            const isActive = index === activeIndex;
            return (
              <SwiperSlide
                key={item.key}
                className={`settings-item ${isActive ? 'active-setting' : ''}`}
              >
                <div style={{ height: '30px' }}>
                  <span>
                    {item.label}
                    {item.value && ': '}
                  </span>
                  {item.value && <span>{item.value}</span>}
                </div>
              </SwiperSlide>
            );
          })}
      </Swiper>

      {/* </div> */}
    </div>
  );
};
