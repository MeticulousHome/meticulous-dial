import { useCallback, useEffect, useState } from 'react';
import { PresetSettingOptionsMock } from '../../../src/constants';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppSelector } from '../store/hooks';

import './pressetSettings.css';

interface Props {
  optionSelected: (option: number) => void;
}

export function PressetSettings({ optionSelected }: Props): JSX.Element {
  const [swiper, setSwiper] = useState(null);
  const { presetSetting, screen } = useAppSelector((state) => state);
  const [animationStyle, setAnimationStyle] = useState('');
  const [init, setInit] = useState(false);

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
      {/* <div className="test-mid-screen"></div> */}
      <div className="presset-options">
        <Swiper
          initialSlide={2}
          slidesPerView={8}
          onSwiper={setSwiper}
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
              key={`option-${index}`}
            >
              {({ isActive }) => (
                <div
                  className={`${animationStyle} ${
                    isActive ? `item-active` : ''
                  }`}
                >
                  {option.name}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
