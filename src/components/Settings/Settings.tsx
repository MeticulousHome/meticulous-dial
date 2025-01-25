import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { SettingsKey } from '@meticulous-home/espresso-api';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';

import SettingsVisibility from '../../schemas/settings.json';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';

export function Settings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();

  const showValue = useCallback(
    (isActive: boolean, item: SettingsKey) => {
      if (!item) return <></>;
      let val = item.split('_').join(' ').toUpperCase();
      if (globalSettings) {
        if (typeof globalSettings[item as SettingsKey] === 'boolean') {
          val = globalSettings[item] ? val + ': ENABLED' : val + ': DISABLED';
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
          case 'usb_mode': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'usbSettings' })
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
              updateSettings.mutate({ [activeItem]: new_value });
            } else {
              console.error('This setting type is not yet implemented!');
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
