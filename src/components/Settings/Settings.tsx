import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { SettingsKey } from '@meticulous-home/espresso-api';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';

import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { SettingsItem } from '../../types';

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
    visible: true
  },
  {
    key: 'calibrate',
    label: 'calibrate scale'
  },
  {
    key: 'advanced',
    label: 'Advanced Settings'
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export function Settings(): JSX.Element {
  const { data: globalSettings } = useSettings();

  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const updateSettings = useUpdateSettings();

  const showValue = useCallback(
    (isActive: boolean, item: SettingsItem) => {
      if (!item) return <></>;
      let val = item.label;
      if (globalSettings) {
        if (typeof globalSettings[item.key as SettingsKey] === 'boolean') {
          val = globalSettings[item.key as SettingsKey]
            ? val + ': ENABLED'
            : val + ': DISABLED';
        }
      }
      return marqueeIfNeeded({ enabled: isActive, val });
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
        const activeItem = settings[activeIndex];
        switch (activeItem.key) {
          case 'device_info':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'deviceInfo' })
            );
            break;
          case 'advanced': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          }
          case 'usb_mode': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'usbSettings' })
            );
            break;
          }
          case 'calibrate': {
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            dispatch(setScreen('calibrateScale'));
            break;
          }
          case 'enable_sounds':
            updateSettings.mutate({
              enable_sounds: !globalSettings.enable_sounds
            });
            break;
          case 'time_date':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeDate' })
            );
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
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
        spaceBetween={16}
        autoHeight={false}
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        {settings.map((item, index: number) => {
          const isActive = index === activeIndex;
          return (
            <>
              <SwiperSlide
                key={index}
                className={`settings-item ${isActive ? 'active-setting' : ''}`}
              >
                <div className="settings-entry text-container">
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {showValue(isActive, item)}
                  </span>
                </div>
              </SwiperSlide>
              {item.seperator_after && (
                <SwiperSlide key={`seperator-${index}`} className="separator" />
              )}
            </>
          );
        })}
      </Swiper>
    </div>
  );
}
