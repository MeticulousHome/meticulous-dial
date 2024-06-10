import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import './wifiSettings.css';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { saveConfig } from '../store/features/wifi/wifi-slice';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { WifiMode } from '../../types';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { marqueeIfNeeded } from '../shared/MarqueeValue';

export const WifiSettings = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [userWifiMode, setUserWifiMode] = useState(null);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { wifiStatus, networkConfig } = useAppSelector((state) => state.wifi);
  const isWifiConnected = wifiStatus?.connected;
  const [networkConfigMode, setNetworkConfigMode] = useState(
    networkConfig?.mode
  );
  const isApMode = isWifiConnected && networkConfigMode === WifiMode.AP;

  const wifiSettingItems = [
    {
      key: 'status',
      label: 'Status',
      value: isWifiConnected ? 'CONNECTED' : 'NOT CONNECTED',
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
      value: isApMode ? 'AP' : 'CLIENT',
      visible: isWifiConnected
    },
    {
      key: 'known_wifis',
      label: 'Known Wifis',
      visible: true
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
    pressDown() {
      const filter = wifiSettingItems.filter((item) => item.visible)[
        activeIndex
      ].key;
      switch (filter) {
        case 'network_mode': {
          const mode =
            networkConfigMode === WifiMode.AP ? WifiMode.CLIENT : WifiMode.AP;
          setNetworkConfigMode(mode);
          setUserWifiMode(mode);
          break;
        }
        case 'details': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'wifiDetails' })
          );
          break;
        }
        case 'save': {
          dispatch(
            saveConfig({
              ...networkConfig,
              mode: networkConfigMode ?? networkConfig.mode
            })
          );
          dispatch(
            setBubbleDisplay({ visible: true, component: 'wifiSettingsSave' })
          );
          break;
        }
        case 'known_wifis': {
          dispatch(setBubbleDisplay({ visible: true, component: 'KnownWifi' }));
          break;
        }
        case 'back': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'quick-settings' })
          );
          break;
        }
        case 'connect_new_network': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'connectWifiMenu' })
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
                <div className="settings-entry text-container">
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {marqueeIfNeeded({
                      enabled: isActive,
                      val: `${item.label.toUpperCase()}${
                        item.value ? ': ' + item.value : ''
                      }`
                    })}
                  </span>
                </div>
              </SwiperSlide>
            );
          })}
      </Swiper>
    </div>
  );
};
