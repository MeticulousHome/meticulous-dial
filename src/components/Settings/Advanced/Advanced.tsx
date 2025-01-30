import { useCallback, useEffect, useState } from 'react';
import 'swiper/css';
import { Swiper, SwiperSlide } from 'swiper/react';
import { startMasterCalibration } from '../../../api/api';

import { SettingsKey } from '@meticulous-home/espresso-api';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { SettingsItem } from '../../../types';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { marqueeIfNeeded } from '../../shared/MarqueeValue';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { IdleScreens } from './IdleScreenSetting';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';

export const AdvancedSettings = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { refetch: fetchDeviceStatus } = useDeviceInfo();

  const settings: SettingsItem[] = [
    {
      key: 'usb_mode',
      label: 'USB mode'
    },
    {
      key: 'master_calibration',
      label: 'ACAIA master calibration',
      visible: true
    },
    {
      key: 'save_debug_shot_data',
      label: 'Save debug shot data',
      visible: true
    },
    {
      key: 'set_update_channel',
      label: 'Update channel',
      visible: true
    },
    {
      key: 'set_idle_screen',
      label: 'Select Idle Screen',
      visible: true
    },
    {
      key: 'back',
      label: 'Back',
      visible: true
    }
  ];

  const showValue = useCallback(
    (isActive: boolean, item: SettingsItem) => {
      if (!item) return <></>;
      let val = item.label.toUpperCase();
      if (globalSettings) {
        switch (item.key) {
          case 'usb_mode':
            val = `${val}: ${globalSettings.usb_mode}`;
            break;
          case 'set_update_channel':
            val = `${val}: ${globalSettings.update_channel}`;
            break;
          case 'set_idle_screen': {
            const idleKey = globalSettings.idle_screen;
            const idle = IdleScreens.filter((item) => item.key === idleKey)[0];
            const idleLabel =
              idle?.shortLabel || idle?.label || idleKey.toUpperCase();
            val = `${val}: ${idleLabel}`;
            break;
          }
          default:
            if (typeof globalSettings[item.key as SettingsKey] === 'boolean') {
              val = globalSettings[item.key as SettingsKey]
                ? val + ': ENABLED'
                : val + ': DISABLED';
            }
        }

        return marqueeIfNeeded({ enabled: isActive, val });
      }
    },
    [globalSettings]
  );
  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
      },
      pressDown() {
        const activeItem = settings[activeIndex].key;
        switch (activeItem) {
          case 'device_info':
            fetchDeviceStatus();
            dispatch(
              setBubbleDisplay({ visible: true, component: 'deviceInfo' })
            );
            break;

          case 'save_debug_shot_data':
            updateSettings.mutate({
              save_debug_shot_data: !globalSettings.save_debug_shot_data
            });
            break;
          case 'set_update_channel':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'updateChannel' })
            );
            break;
          case 'set_idle_screen':
            dispatch(
              setBubbleDisplay({
                visible: true,
                component: 'idleScreenSettings'
              })
            );
            break;

          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          case 'master_calibration':
            startMasterCalibration()
              .then(() => {
                dispatch(setBubbleDisplay({ visible: false, component: null }));
              })
              .catch((err) => {
                console.log(err);
              });
            break;
          default: {
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible
  );

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
        {settings.map((item, index: number) => {
          const isActive = index === activeIndex;
          return (
            <SwiperSlide
              key={index}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
            >
              <div style={{ height: '30px' }}>
                <div className="settings-entry text-container">
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {showValue(isActive, item)}
                  </span>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};
