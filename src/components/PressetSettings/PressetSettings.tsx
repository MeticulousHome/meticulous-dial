import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppSelector } from '../store/hooks';

import { PresetSettingString } from '../../constant/Preset';
import './pressetSettings.css';
import { dummyOptions } from '../../utils/mock';

interface Props {
  optionSelected: (option: number) => void;
}

export function PressetSettings({ optionSelected }: Props): JSX.Element {
  const [animationStyle, setAnimationStyle] = useState('');
  const [init, setInit] = useState(false);
  const [swiper, setSwiper] = useState(null);

  const { screen, presetSetting } = useAppSelector((state) => state);
  const listSettings = [...dummyOptions, ...presetSetting.settings];

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
          {listSettings.map((setting, index: number) => (
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
                    {PresetSettingString[setting.name] || setting.name}
                    {/* {presets?.activePreset?.sensors[setting.name] || '0'} */}
                  </>
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
