import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { startMasterCalibration } from '../../../api/api';
import 'swiper/css';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { marqueeIfNeeded } from '../../shared/MarqueeValue';
import { SettingsKey } from '@meticulous-home/espresso-api';
import {
  updateItemSetting,
  updateSettings,
  setTempHeatingTimeout
} from '../../../../src/components/store/features/settings/settings-slice';
import { SettingsItem } from '../../../types';

export const AdvancedSettings = () => {
  const dispatch = useAppDispatch();
  const globalSettings = useAppSelector((state) => state.settings);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings: SettingsItem[] = [
    {
      key: 'device_info',
      label: 'Device Info',
      visible: true
    },
    {
      key: 'time_date',
      label: 'time & date',
      visible: true
    },
    {
      key: 'enable_sounds',
      label: 'sounds',
      value: globalSettings.enable_sounds,
      visible: true
    },
    {
      key: 'master_calibration',
      label: 'ACAIA master calibration',
      visible: true
    },
    {
      key: 'save_debug_shot_data',
      label: 'Save debug shot data',
      value: globalSettings.save_debug_shot_data,
      visible: true
    },
    {
      key: 'set_update_channel',
      label: 'Set update channel',
      value: globalSettings.update_channel,
      visible: true
    },
    {
      key: 'heat_timeout_after_shot',
      label: 'Heat timeout after shot',
      visible: true
    },
    {
      key: 'save',
      label: 'Save',
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
        if (item.key === 'heat_timeout_after_shot') {
          val = `${val}: ${globalSettings.tempHeatingTimeout ?? globalSettings.heating_timeout} MIN`;
        } else if (
          typeof globalSettings[item.key as SettingsKey] === 'boolean'
        ) {
          val = globalSettings[item.key as SettingsKey]
            ? val + ': ENABLED'
            : val + ': DISABLED';
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
          case 'enable_sounds':
            dispatch(
              updateItemSetting({
                key: 'enable_sounds',
                value: !globalSettings.enable_sounds
              })
            );
            break;

          case 'save_debug_shot_data':
            dispatch(
              updateItemSetting({
                key: 'save_debug_shot_data',
                value: !globalSettings.save_debug_shot_data
              })
            );
            break;
          case 'set_update_channel':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'updateChannel' })
            );
            break;
          case 'device_info':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'deviceInfo' })
            );
            break;
          case 'back':
            dispatch(setTempHeatingTimeout(null)); // Clear temporary value without saving
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          case 'save':
            dispatch(
              updateSettings({
                enable_sounds: globalSettings.enable_sounds,
                save_debug_shot_data: globalSettings.save_debug_shot_data,
                heating_timeout:
                  globalSettings.tempHeatingTimeout ??
                  globalSettings.heating_timeout
              })
            );
            dispatch(setTempHeatingTimeout(null)); // Clear temporary value after saving
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
          case 'heat_timeout_after_shot':
            dispatch(setScreen('heat_timeout_after_shot'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          case 'time_date':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeDate' })
            );
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
