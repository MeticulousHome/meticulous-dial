import { Swiper, SwiperSlide } from 'swiper/react';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../store/hooks';

export function Settings(): JSX.Element {
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);
  const [init, setInit] = useState(false);
  const { settings, screen } = useAppSelector((state) => state);
  const reset = useRef<boolean>(false);

  useEffect(() => {
    if (swiper) {
      if (reset.current) {
        swiper.slideTo(settings.activeIndexSetting, 0, false);
      } else {
        swiper.slideTo(settings.activeIndexSetting);
      }
    }
  }, [swiper, settings.activeIndexSetting]);

  useEffect(() => {
    reset.current = screen.value !== 'settings';
  }, [screen.value]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  return (
    <div
      className={`main-layout ${
        screen.value === 'settings'
          ? 'scale__fadeIn'
          : screen.prev === 'settings'
          ? 'scale__fadeOut'
          : 'hidden'
      }`}
    >
      <div className="title">Settings</div>
      <div className="blur blur-top"></div>
      <div className="blur blur-bottom"></div>
      <div className="settings-options">
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
          {settings.settings.map((setting, index) => (
            <SwiperSlide
              className="setting-option-item"
              key={`option-${index}`}
            >
              {({ isActive }) => (
                <div
                  className={`${animationStyle} ${
                    isActive ? `item-active` : ''
                  } `}
                >
                  {setting.label}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
