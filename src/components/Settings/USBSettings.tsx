import { useCallback, useEffect, useState } from 'react';
import 'swiper/css';
import { Swiper, SwiperSlide } from 'swiper/react';

import { SettingsKey, USB_MODE } from '@meticulous-home/espresso-api';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { SettingsItem } from '../../types';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';

export const USBSettings = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings: SettingsItem[] = [
    {
      key: 'client',
      label: 'Client / USB-C Network',
      visible: true
    },
    {
      key: 'host',
      label: 'Host (Charging)',
      visible: true
    },
    {
      key: 'dual_role',
      label: 'Dual Role / Undescided',
      visible: true
    }
  ];

  const showValue = useCallback(
    (isActive: boolean, item: SettingsItem) => {
      if (!item) return <></>;
      let val = item.label.toUpperCase();
      if (globalSettings) {
        switch (item.key) {
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
        const activeUsbMode = settings[activeIndex].key as USB_MODE;
        updateSettings.mutate({
          usb_mode: activeUsbMode
        });
        dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
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
