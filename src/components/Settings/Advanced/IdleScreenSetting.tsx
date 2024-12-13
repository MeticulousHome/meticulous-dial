import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { marqueeIfNeeded } from '../../shared/MarqueeValue';
import { SettingsKey } from '@meticulous-home/espresso-api';
import { SettingsItem } from '../../../types';
import { MenuAnnotation } from '../MenuAnnotation';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';

export const IdleScreens: SettingsItem[] = [
  {
    key: 'default',
    label: 'Analog Clock',
    shortLabel: 'Analog',
    visible: true
  },
  {
    key: 'digital',
    label: 'Digital Clock',
    shortLabel: 'Digital',
    visible: true
  },
  {
    key: 'metCat',
    label: 'Digital Cat Clock',
    shortLabel: 'Cat',
    visible: true
  },
  {
    key: 'dvd',
    label: 'DVD Style',
    shortLabel: 'DVD',
    visible: true
  }
];

export const IdleScreenSetting = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings = [
    ...IdleScreens,
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
        if (typeof globalSettings[item.key as SettingsKey] === 'boolean') {
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
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          default: {
            const screen = settings[activeIndex].key;
            updateSettings.mutate({ idle_screen: screen });
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
          const isSelectedItem = globalSettings?.idle_screen === item.key;
          return (
            <SwiperSlide
              key={index}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{showValue(isActive, item)}</span>
              {isSelectedItem && (
                <MenuAnnotation style={{ marginRight: 10 }}>
                  current
                </MenuAnnotation>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};
