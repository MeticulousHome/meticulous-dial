import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import './wifiSettings.css';
import { useAppDispatch } from '../store/hooks';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useNetworkConfig, useUpdateNetworkConfig } from '../../hooks/useWifi';
import { APMode } from '@meticulous-home/espresso-api';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

export const WifiSettings = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [networkConfigMode, setNetworkConfigMode] = useState<APMode>(
    APMode.CLIENT
  );

  const { data: networkConfig, error, isLoading, refetch } = useNetworkConfig();
  const updateNetworkConfigMutation = useUpdateNetworkConfig();

  useEffect(() => {
    refetch();
  }, [updateNetworkConfigMutation.status]);

  useEffect(() => {
    setNetworkConfigMode(networkConfig?.config.mode);
  }, [networkConfig]);

  const isWifiConnected = networkConfig?.status.connected;

  const isApMode = isWifiConnected && networkConfigMode === APMode.AP;
  const APModeDescription = 'Create standalone wifi';
  const ClientModeDescription = 'Machine joins existing wifi';

  const wifiSettingItems = [
    {
      key: 'status',
      label: 'Status',
      value: isWifiConnected ? 'CONNECTED' : 'NOT CONNECTED',
      visible: true
    },
    {
      key: 'qr_code',
      label: 'Show connection code',
      visible: isWifiConnected
    },
    {
      key: 'details',
      label: 'See network details',
      visible: true
    },
    {
      key: 'network_mode',
      label: 'Wifi mode',
      value: isApMode ? APModeDescription : ClientModeDescription,
      visible: true
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
      visible: networkConfigMode !== networkConfig?.config.mode
    },
    {
      key: 'back',
      label: 'Back',
      visible: true
    }
  ];

  useHandleGestures(
    {
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
        // In case of error we go back
        if (updateNetworkConfigMutation.isError || error) {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'quick-settings' })
          );
        }
        const filter = wifiSettingItems.filter((item) => item.visible)[
          activeIndex
        ].key;
        switch (filter) {
          case 'network_mode': {
            const mode =
              networkConfigMode === APMode.AP ? APMode.CLIENT : APMode.AP;
            setNetworkConfigMode(mode);
            break;
          }
          case 'qr_code': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'wifiQrMenu' })
            );
            break;
          }
          case 'details': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'wifiDetails' })
            );
            break;
          }
          case 'save': {
            updateNetworkConfigMutation.mutate({
              ...networkConfig.config,
              mode: networkConfigMode
            });
            setActiveIndex(0);
            break;
          }
          case 'known_wifis': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'KnownWifi' })
            );
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
    },
    updateNetworkConfigMutation.isPending
  );

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  if (isLoading || updateNetworkConfigMutation.isPending) {
    return <LoadingScreen />;
  }

  if (updateNetworkConfigMutation.isError || error) {
    return (
      <div className="quick-settings">
        <div
          className={` deleted-response ${
            updateNetworkConfigMutation.isError ? 'error-entry' : ''
          }`}
        >
          {updateNetworkConfigMutation.isError
            ? 'An unknown error occured. Please try again'
            : 'Connection could not be verified, please check the connection details'}
        </div>
        <br />
        <div key="back" className={`settings-item active-setting deleted-item`}>
          <div className="settings-entry deleted-button">Ok</div>
        </div>
      </div>
    );
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
