import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { QuickSettings } from '../QuickSettings/QuickSettings';
import {
  UserSettingsKeys,
  updateItemSetting,
  updateSettings
} from '../store/features/settings/settings-slice';
import UserSettings from '../../schemas/settings.json';
import { marqueeIfNeeded } from '../shared/MarqueeValue';

export function Settings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const globalSettings = useAppSelector((state) => state.settings);

  const showValue = useCallback(
    (isActive: boolean, item: UserSettingsKeys) => {
      if (!item) return <></>;

      if (UserSettings && globalSettings) {
        let val = globalSettings[item];
        if (UserSettings.properties[item]?.type === 'boolean') {
          val = globalSettings[item] ? ' ENABLED' : ' DISABLED';
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
          Math.min(prev + 1, UserSettings.properties.visible.length - 1)
        );
      },
      click() {
        const activeItem = UserSettings.properties.visible[activeIndex];
        const settingItem = UserSettings.properties;
        switch (activeItem) {
          case 'save': {
            dispatch(updateSettings(globalSettings));
            dispatch(
              setBubbleDisplay({ visible: true, component: QuickSettings })
            );
            break;
          }
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: QuickSettings })
            );
            break;
          default: {
            if (
              settingItem[activeItem as UserSettingsKeys].type === 'boolean'
            ) {
              dispatch(
                updateItemSetting({
                  key: activeItem,
                  value: !globalSettings[activeItem as UserSettingsKeys]
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
        {UserSettings.properties.visible.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <SwiperSlide
              key={index}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
            >
              <div style={{ height: '30px' }}>
                <div className="settings-entry">
                  {item.split('_').join(' ')}
                  {item !== 'save' && item !== 'back' && ': '}
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {showValue(isActive, item as UserSettingsKeys)}
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
