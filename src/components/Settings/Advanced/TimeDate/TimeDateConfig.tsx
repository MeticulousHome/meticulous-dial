import { useCallback, useEffect, useState } from 'react';

import '../../../QuickSettings/quick-settings.css';
import { useHandleGestures } from '../../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../../store/features/screens/screens-slice';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../../../OSStatus/OSStatus.css';

import { SettingsItem } from '../../../../types';
import { useSettings } from '../../../../hooks/useSettings';

const defaultSettings: SettingsItem[] = [
  {
    key: 'set_timezone',
    label: 'Set time zone',
    visible: true,
    value: false
  },
  {
    key: 'set_date_time',
    label: 'Set date & time',
    visible: true,
    value: false
  },
  {
    key: 'back',
    label: 'Back',
    visible: true
  }
];

export function TimeDate(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [settings, setSettings] = useState(defaultSettings);
  const { data: globalSettings } = useSettings();

  const [counterESGG, setCounterESGG] = useState(0);

  useHandleGestures(
    {
      context() {
        setActiveIndex(1);
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: !bubbleDisplay.visible ? 'quick-settings' : null
          })
        );
      },
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        setCounterESGG(0);
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
        if (settings[activeIndex].key === 'exit') {
          setCounterESGG(counterESGG + 1);
        }
      },
      pressDown() {
        switch (settings[activeIndex].key) {
          case 'set_timezone': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeZoneConfig' })
            );
            break;
          }
          case 'conset_date_time': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeDate' }) //Does nothing for now
            );
            break;
          }
          case 'back': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible
  );

  useEffect(() => {
    setSettings(defaultSettings);
  }, []);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    if (counterESGG >= 20) {
      console.log('Easter Egg on');
      dispatch(setBubbleDisplay({ visible: false, component: null }));
      dispatch(setScreen('snake'));
    }
  }, [counterESGG]);

  const getSettingClasses = useCallback((isActive: boolean) => {
    return `
      settings-item ${isActive ? 'active-setting' : ''}
      `;
  }, []);

  const getLabel = (setting: SettingsItem) => {
    switch (setting.key) {
      case 'set_timezone':
        if (globalSettings && globalSettings.time_zone) {
          return `${setting.label}: ${globalSettings.time_zone}`;
        }
        break;
      case 'set_date_time':
        break;
    }
    return setting.label;
  };

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
        {settings.map((setting, index: number) => {
          const isActive = index === activeIndex;
          return (
            <div key={`option-${index}-${setting.key}`}>
              <SwiperSlide
                className={getSettingClasses(isActive)}
                key={`option-${index}-${setting.key}`}
              >
                <div className="text-container">{getLabel(setting)}</div>
              </SwiperSlide>
            </div>
          );
        })}
      </Swiper>
    </div>
  );
}
