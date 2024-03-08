import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import './wifiSettings.css';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { saveConfig, updateConfig } from '../store/features/wifi/wifi-slice';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { WifiMode } from '../../types';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { QuickSettings } from '../QuickSettings/QuickSettings';
import { WifiDetails } from './WifiDetails';
import { ConnectWifiMenu } from './ConnectWifiMenu';

export const WifiSettings = (): JSX.Element => {
  const { wifiStatus, networkConfig } = useAppSelector((state) => state.wifi);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isWifiConnected = wifiStatus?.connected;
  const isApMode = isWifiConnected && networkConfig?.mode === WifiMode.AP;
  const [userWifiMode, setUserWifiMode] = useState(null);
  const isClientMode =
    isWifiConnected && networkConfig?.mode === WifiMode.CLIENT;

  const dispatch = useAppDispatch();

  const wifiSettingItems = [
    {
      key: 'status',
      label: 'Status',
      value: isWifiConnected ? 'connected' : 'not connected',
      visible: isWifiConnected
    },
    {
      key: 'details',
      label: 'See network details',
      visible: true
    },
    {
      key: 'network_mode',
      label: 'Network mode',
      value: isApMode ? 'AP' : 'Client',
      visible: isWifiConnected
    },
    {
      key: 'connect_new_network',
      label: 'Connect to a new network',
      visible: true
    },
    {
      key: 'save',
      label: 'Save',
      visible: userWifiMode !== null
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
            networkConfig.mode === WifiMode.AP ? WifiMode.CLIENT : WifiMode.AP;
          dispatch(updateConfig({ ...networkConfig, mode }));
          setUserWifiMode(mode);
          break;
        }
        case 'details': {
          dispatch(setBubbleDisplay({ visible: true, component: WifiDetails }));
          break;
        }
        case 'save': {
          dispatch(saveConfig({ ...networkConfig }));
          dispatch(
            setBubbleDisplay({ visible: true, component: QuickSettings })
          );
          break;
        }
        case 'back': {
          dispatch(
            setBubbleDisplay({ visible: true, component: QuickSettings })
          );
          break;
        }
        case 'connect_new_network': {
          dispatch(
            setBubbleDisplay({ visible: true, component: ConnectWifiMenu })
          );
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
                <div className="settings-entry">
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
