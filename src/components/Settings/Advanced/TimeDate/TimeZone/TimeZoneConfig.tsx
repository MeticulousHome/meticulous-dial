import { useCallback, useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../../../store/features/screens/screens-slice';
import { marqueeIfNeeded } from '../../../../shared/MarqueeValue';
import { SettingsItem } from '../../../../../types';
import { api, setTimezoneSync } from '../../../../../api/api';

export const TimeZoneConfig = () => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [automaticTz, setAutomaticTz] = useState<boolean>(false);

  useEffect(() => {
    api.getSettings().then((result) => {
      const { data } = result;
      if ('error' in data) {
        console.log('Error fetching timezone sync mode: ', data.error);
        setAutomaticTz(false);
      } else {
        const sync_mode = data.timezone_sync;
        setAutomaticTz(sync_mode === 'automatic');
      }
    });
  }, []);

  const settings: SettingsItem[] = useMemo(() => {
    if (automaticTz) {
      return [
        {
          key: 'automatic_toggle',
          label: 'Automatic',
          visible: true,
          value: false
        },
        {
          key: 'back',
          label: 'Back',
          visible: true
        }
      ];
    }
    return [
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
  }, [automaticTz]);

  const handleAutomaticToggle = () => {
    const new_timezone_sync = !automaticTz;
    setAutomaticTz(new_timezone_sync);
    setTimezoneSync(new_timezone_sync ? 'automatic' : 'manual');
    console.log(new_timezone_sync);
  };

  const showValue = useCallback(
    (isActive: boolean, item: SettingsItem) => {
      if (!item) return <></>;
      let val = item.label.toUpperCase();
      if (item.key === 'automatic_toggle') {
        val += automaticTz ? ': ENABLED' : ': DISABLED';
      }
      return marqueeIfNeeded({ enabled: isActive, val });
    },
    [automaticTz]
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
          case 'automatic_toggle':
            handleAutomaticToggle();
            break;
          case 'time_zone_selector':
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            dispatch(setScreen('selectLetterCountry'));
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
        spaceBetween={16}
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
              <div className="settings-entry text-container">
                <span
                  className="settings-text"
                  style={{ wordBreak: 'break-word' }}
                >
                  {showValue(isActive, item)}
                </span>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};
