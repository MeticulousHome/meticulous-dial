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
  const { screen, presets } = useAppSelector((state) => state);
  const currentPresetSetting = presets.activePreset?.settings || [];
  const settings = useMemo(
    () => [
      ...(presets.updatingSettings.settings || []).filter(
        (setting) => !setting.hidden
      ),
      ...(generateDefaultAction(
        presets.updatingSettings.settings.length
      ).flat() as IPresetSetting[])
    ],
    [presets.updatingSettings.settings]
  );

  useEffect(() => {
    if (swiper) {
      const settingsExist =
        currentPresetSetting && currentPresetSetting.length > 0;

      let settingBeforeChange;

      if (settingsExist && currentPresetSetting[swiper['activeIndex']]) {
        settingBeforeChange = currentPresetSetting[swiper['activeIndex']].key;
      }

      if (
        (settingBeforeChange === 'save' || settingBeforeChange === 'discard') &&
        presets.activeSetting === 2
      ) {
        swiper.slideTo(presets.activeSetting, 0, false);
      } else {
        swiper.slideTo(presets.activeSetting);
      }

      if (settingsExist) {
        optionSelected(settings[presets.activeSetting].key);
      }
    }
  }, [presets.activeSetting, swiper]);

  useEffect(() => {
    if (
      presets.activePreset &&
      currentPresetSetting.length > 0 &&
      currentPresetSetting[presets.activeSetting] &&
      settings[presets.activeSetting]?.key
    ) {
      optionSelected(settings[presets.activeSetting].key);
    }
  }, [presets.activePreset.settings]);

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
