import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide, useSwiper } from 'swiper/react';

import { PresetSettingOptionsMock } from '../../../src/constants';
import { Keyboard } from 'swiper';
import { IPreset } from '../../types';
import { ListSettings } from '../../types';
import { useAppSelector } from '../store/hooks';

import { PresetSettingString } from '../../constant/Preset';
import './pressetSettings.css';

interface Props {
  optionSelected: (option: number) => void;
}

export function PressetSettings({ optionSelected }: Props): JSX.Element {
  const [animationStyle, setAnimationStyle] = useState('');
  const [init, setInit] = useState(false);
  const [swiper, setSwiper] = useState(null);

  const { screen, presetSetting, presets } = useAppSelector((state) => state);
  const { activePreset } = presets;
  const listSettings: ListSettings[number][] = activePreset?.sensors
    ? Object.keys(activePreset.sensors)
    : [];

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(presetSetting.activeSetting);
      optionSelected(presetSetting.activeSetting);
    }
  }, [presetSetting.activeSetting]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (screen.value === 'pressetSettings') {
      if (screen.prev === 'settingNumerical') {
        animation = 'settingNumericalToPressetSettings__fadeIn';
      } else {
        animation = 'pressetSettings__fadeIn';
      }
    } else if (
      screen.value === 'settingNumerical' &&
      screen.prev === 'pressetSettings'
    ) {
      animation = 'pressetSettingsToSettingNumerical__fadeOut';
    } else if (
      screen.prev === 'pressetSettings' &&
      screen.value === 'barometer'
    ) {
      animation = 'pressetSettings__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className={`presset-container ${getAnimation()}`}>
      {/* <div className="presset-title title-main-2">Filter 2.1</div> */}
      <div className="blur blur-top"></div>
      <div className="blur blur-bottom"></div>
      <div className="presset-options">
        <Swiper
          onSwiper={setSwiper}
          initialSlide={2}
          slidesPerView={9}
          allowTouchMove={false}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          onSlideNextTransitionStart={() => {
            if (!init) {
              setInit(true);
              return;
            }
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {PresetSettingOptionsMock.map((option, index) => (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index}-dummy-top`}
            ></SwiperSlide>
          ))}
          <SwiperSlide className="presset-option-item" key={`option-name`}>
            {({ isActive }) => (
              <div
                className={`${animationStyle} ${isActive ? `item-active` : ''}`}
              >
                Name: {presets?.activePreset?.name}
              </div>
            )}
          </SwiperSlide>

          {listSettings.map((setting: ListSettings, index: number) => (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index}`}
            >
              {({ isActive }) => (
                <div
                  className={`${animationStyle} ${
                    isActive ? `item-active` : ''
                  }`}
                >
                  <>
                    {PresetSettingString[setting] || setting}:{' '}
                    {presets?.activePreset.sensors[setting]}
                  </>
                </div>
              )}
            </SwiperSlide>
          ))}

          <SwiperSlide className="presset-option-item" key={`option-discard`}>
            {({ isActive }) => (
              <div
                className={`${animationStyle} ${isActive ? `item-active` : ''}`}
              >
                discard
              </div>
            )}
          </SwiperSlide>
          <SwiperSlide className="presset-option-item" key={`option-ok`}>
            {({ isActive }) => (
              <div
                className={`${animationStyle} ${isActive ? `item-active` : ''}`}
              >
                ok
              </div>
            )}
          </SwiperSlide>
        </Swiper>
      </div>
    </div>
  );
}
