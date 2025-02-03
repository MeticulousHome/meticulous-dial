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
    key: 'auto_start_shot',
    label: 'Auto start after heating'
  },
  {
    key: 'auto_purge_after_shot',
    label: 'Auto purge after shot'
  },
  {
    key: 'heat_timeout_after_shot',
    label: 'Heat timeout after shot',
    visible: true
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export function BrewSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
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

        if (item.key === 'heat_timeout_after_shot') {
          val = `${val}: ${globalSettings.heating_timeout} MIN`;
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
        const activeItem = settings[activeIndex];
        switch (activeItem.key) {
          case 'heat_timeout_after_shot':
            dispatch(setScreen('heat_timeout_after_shot'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
          default: {
            if (
              typeof globalSettings[activeItem.key as SettingsKey] === 'boolean'
            ) {
              const new_value = !globalSettings[activeItem.key as SettingsKey];
              updateSettings.mutate({ [activeItem.key]: new_value });
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
            </>
          );
        })}
      </Swiper>
    </div>
  );
}
