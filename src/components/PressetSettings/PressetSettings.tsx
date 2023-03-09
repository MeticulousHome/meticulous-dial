import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppSelector } from '../store/hooks';

import { dummyOptions } from '../../utils/mock';
import './pressetSettings.css';

interface Props {
  optionSelected: (option: string) => void;
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
      optionSelected(listSettings[presetSetting.activeSetting].key);
    }
  }, [presetSetting.activeSetting]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (
      (screen.value === 'scale' && screen.prev === 'pressetSettings') ||
      (screen.value === 'pressetSettings' && screen.prev === 'scale')
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
                  {isActive ? setting.label : setting.key}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
