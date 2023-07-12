import { useCallback, useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { IPresetSetting } from '../../types';
import { useAppSelector } from '../store/hooks';

import './pressetSettings.css';
import { generateDefaultAction } from '../../utils/preset';

interface Props {
  optionSelected: (option: string) => void;
}

const formatSetting = (setting: IPresetSetting) => {
  let mValue = '';

  if (
    (setting.value || setting.label) &&
    (typeof setting.value === 'number' || typeof setting.value === 'string')
  ) {
    mValue = `: ${setting.value} ${(setting as any)?.unit || ''}`;
  }

  return `${setting.label}${mValue}`;
};

export function PressetSettings({ optionSelected }: Props): JSX.Element {
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);
  const { screen, presetSetting } = useAppSelector((state) => state);
  const settings = useMemo(
    () => [
      ...presetSetting.updatingSettings.settings.filter(
        (setting) => !setting.hidden
      ),
      ...(generateDefaultAction(
        presetSetting.updatingSettings.settings.length
      ).flat() as IPresetSetting[])
    ],
    [presetSetting.updatingSettings.settings]
  );

  useEffect(() => {
    if (swiper) {
      const settingsExist =
        presetSetting.settings && presetSetting.settings.settings.length > 0;

      let settingBeforeChange;

      if (
        settingsExist &&
        presetSetting.settings.settings[swiper['activeIndex']]
      ) {
        settingBeforeChange =
          presetSetting.settings.settings[swiper['activeIndex']].key;
      }

      try {
        if (
          (settingBeforeChange === 'save' ||
            settingBeforeChange === 'discard') &&
          presetSetting.activeSetting === 2
        ) {
          swiper.slideTo(presetSetting.activeSetting, 0, false);
        } else {
          swiper.slideTo(presetSetting.activeSetting);
        }
      } catch (error) {
        console.log({ error, location: 'PressetSettings' });
      }

      if (settingsExist) {
        optionSelected(settings[presetSetting.activeSetting].key);
      }
    }
  }, [presetSetting.activeSetting, swiper]);

  useEffect(() => {
    if (
      presetSetting.settings &&
      presetSetting.settings.settings.length > 0 &&
      presetSetting.settings.settings[presetSetting.activeSetting] &&
      settings[presetSetting.activeSetting]?.key
    ) {
      optionSelected(settings[presetSetting.activeSetting].key);
    }
  }, [presetSetting.settings]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (
      ((screen.value === 'scale' || screen.value === 'settings') &&
        screen.prev === 'pressetSettings') ||
      (screen.value === 'pressetSettings' &&
        (screen.prev === 'scale' || screen.prev === 'settings'))
    ) {
      animation = '';
    } else if (screen.value === 'pressetSettings') {
      if (
        screen.prev === 'settingNumerical' ||
        screen.prev === 'onOff' ||
        screen.prev === 'purge'
      ) {
        animation = 'settingNumericalToPressetSettings__fadeIn';
      } else if (screen.prev === 'circleKeyboard') {
        animation = 'keyboardToPressetSettings__fadeIn';
      } else {
        animation = 'pressetSettings__fadeIn';
      }
    } else if (
      (screen.value === 'settingNumerical' ||
        screen.value === 'onOff' ||
        screen.value === 'purge') &&
      screen.prev === 'pressetSettings'
    ) {
      animation = 'pressetSettingsToSettingNumerical__fadeOut';
    } else if (
      screen.prev === 'pressetSettings' &&
      screen.value === 'barometer'
    ) {
      animation = 'pressetSettings__fadeOut';
    }
    if (
      screen.value === 'circleKeyboard' &&
      screen.prev === 'pressetSettings'
    ) {
      animation = 'pressetSettingsToKeyboard__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className={`presset-container ${getAnimation()}`}>
      <div className="presset-options">
        <Swiper
          onSwiper={setSwiper}
          slidesPerView={9}
          allowTouchMove={false}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          initialSlide={presetSetting.activeSetting}
          onSlideNextTransitionStart={() => {
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {settings.map((setting, index: number) => (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index}`}
            >
              <div
                className={`${animationStyle} ${
                  setting.key === 'delete' ? 'delete-option-item' : ''
                }`}
              >
                {formatSetting(setting)}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div className="fade fade-top"></div>
      <div className="fade fade-bottom"></div>
    </div>
  );
}
