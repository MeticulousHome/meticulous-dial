import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { SettingsKey } from 'meticulous-api';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';

import SettingsVisibility from '../../schemas/settings.json';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import {
  updateItemSetting,
  updateSettings
} from '../store/features/settings/settings-slice';

export function Settings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const globalSettings = useAppSelector((state) => state.settings);

  const showValue = useCallback(
    (isActive: boolean, item: SettingsKey) => {
      if (!item) return <></>;
      let val = item.split('_').join(' ').toUpperCase();
      if (globalSettings) {
        if (typeof globalSettings[item as SettingsKey] === 'boolean') {
          val = globalSettings[item] ? val + ': ENABLED' : val + ': DISABLED';
        }

        if (item.length > 15) {
          return marqueeIfNeeded({ enabled: isActive, val, len: 0 });
        }

        return val;
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
        setActiveIndex((prev) =>
          Math.min(prev + 1, SettingsVisibility.properties.visible.length - 1)
        );
      },
      pressDown() {
        const activeItem = SettingsVisibility.properties.visible[activeIndex];
        switch (activeItem) {
          case 'advanced': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          }
          case 'save': {
            dispatch(updateSettings(globalSettings));
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
          }
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
          default: {
            if (
              typeof globalSettings[activeItem as SettingsKey] === 'boolean'
            ) {
              const new_value = !globalSettings[activeItem as SettingsKey];
              dispatch(
                updateItemSetting({
                  key: activeItem as SettingsKey,
                  value: new_value
                })
              );
            }
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

  useEffect(() => {
    if (
      !globalSettings.deviceInfo ||
      Object.keys(globalSettings.deviceInfo).length === 0
    ) {
      SettingsVisibility.properties.visible =
        SettingsVisibility.properties.visible.filter(
          (item) => item !== 'advanced'
        );
    }
  }, [globalSettings]);

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
        {SettingsVisibility.properties.visible.map((item, index: number) => {
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
                    {showValue(isActive, item as SettingsKey)}
                  </span>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
