import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import { setBubbleDisplay } from '../../../../store/features/screens/screens-slice';
import { marqueeIfNeeded } from '../../../../shared/MarqueeValue';
import { SettingsKey } from '@meticulous-home/espresso-api';
import { SettingsItem } from '../../../../../types';

export const TimeZoneConfig = () => {
  const dispatch = useAppDispatch();
  const globalSettings = useAppSelector((state) => state.settings);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const settings: SettingsItem[] = [
    {
      key: 'automatic_toggle',
      label: 'Automatic',
      visible: true,
      value: false
    },
    {
      key: 'time_zone_selector',
      label: 'Select Timezone',
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
          case 'automatic':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          case 'time_zone_selector':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'tzSelector' })
            );
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeDate' })
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
