import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppSelector } from '../store/hooks';

import './pressetSettings.css';

const presetSettingOptionsMock = [
  {
    name: '',
    id: -1
  },
  {
    name: '',
    id: -1
  },
  {
    name: 'name: Filter 2.1',
    id: 1
  },
  {
    name: 'pressure',
    id: 2
  },
  {
    name: 'temperature: 86°c',
    id: 3
  },
  {
    name: 'stop weight',
    id: 4
  },
  {
    name: 'flow',
    id: 5
  },
  {
    name: 'pre-infusion',
    id: 6
  },
  {
    name: 'save',
    id: 7
  },
  {
    name: 'discard',
    id: 8
  },
  {
    name: '',
    id: -1
  },
  {
    name: '',
    id: -1
  }
];

export function PressetSettings(): JSX.Element {
  const [swiper, setSwiper] = useState(null);
  const { presetSetting, screen } = useAppSelector((state) => state);
  const [animationStyle, setAnimationStyle] = useState('');
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(presetSetting.activeSetting);
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
        {/* <div className="presset-option-item">stop weight</div>
            <div className="presset-option-item">flow</div>
            <div className="presset-option-item item-active">
              temperature: 86°c
            </div>
            <div className="presset-option-item">presset</div>
            <div className="presset-option-item">style</div>
            <div className="presset-option-item">stop weight</div>
            <div className="presset-option-item">flow</div>
            <div className="presset-option-item">temperature: 86°c</div>
            <div className="presset-option-item">presset</div>
            <div className="presset-option-item">style</div>
            <div className="presset-option-item">save changes</div> */}
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
          {presetSettingOptionsMock.map((option, index) => (
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
