import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { SettingsKey } from '@meticulous-home/espresso-api';
import {
  updateItemSetting,
  updateSettings
} from '../../../../src/components/store/features/settings/settings-slice';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { SettingsItem } from '../../../types';
import { marqueeIfNeeded } from '../../shared/MarqueeValue';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { MenuAnnotation } from '../MenuAnnotation';

const UPDATE_CHANNELS = ['stable', 'beta', 'rel', 'nightly'];

export const UpdateChannel = () => {
  const dispatch = useAppDispatch();
  const globalSettings = useAppSelector((state) => state.settings);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings: SettingsItem[] = [
    ...UPDATE_CHANNELS.map((channel) => ({
      key: 'channel_' + channel,
      label: channel,
      visible: true
    })),
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
            const channel = settings[activeIndex].label;
            dispatch(
              updateItemSetting({
                key: 'update_channel',
                value: channel
              })
            );
            dispatch(
              updateSettings({
                update_channel: channel
              })
            );
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
          const isSelectedChannel =
            globalSettings?.update_channel === item.label;
          return (
            <SwiperSlide
              key={index}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{showValue(isActive, item)}</span>
              {isSelectedChannel && (
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
