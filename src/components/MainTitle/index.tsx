import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useAppSelector } from '../store/hooks';

const MainTitle = () => {
  const { presets, screen } = useAppSelector((state) => state);
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (presets.activePresetIndex > -1 && presets.value.length > 0 && swiper) {
      slideTo(presets.activePresetIndex);
    }
  }, [presets, swiper]);

  useEffect(() => {
    if (screen.value !== 'pressets') {
      setAnimationStyle('');
    }
  }, [screen.value]);

  const getAnimation = useCallback(() => {
    let animation = '';
    if (screen.value === 'pressets') {
      animation = 'title__Big';
    } else if (screen.value === 'pressetSettings') {
      if (screen.prev === 'settingNumerical') {
        animation = 'titleBigSettingNumerical';
      } else {
        animation = 'title__BigTwo';
      }
    } else if (screen.value === 'settingNumerical') {
      animation = 'titleSmallSettingNumerical';
    } else if (
      screen.value === 'barometer' &&
      screen.prev === 'pressetSettings'
    ) {
      animation = 'title__smallTwo';
    } else {
      animation = 'title__small';
    }

    return animation;
  }, [screen]);

  return (
    <div
      className={`main-title-selected ${getAnimation()}`}
      style={{
        display: `${
          (screen.value !== 'barometer' &&
            screen.value !== 'pressets' &&
            screen.value !== 'settingNumerical' &&
            screen.value !== 'pressetSettings') ||
          screen.prev === 'scale'
            ? 'none'
            : ''
        }`,
        width: '100%'
      }}
    >
      <Swiper
        slidesPerView={screen.value === 'pressets' ? 2 : 1}
        centeredSlides={true}
        allowTouchMove={false}
        initialSlide={0}
        onSwiper={setSwiper}
        onSlideChangeTransitionStart={() => {
          setAnimationStyle('animation-bounce-left');
        }}
        onSlidePrevTransitionStart={() => {
          setAnimationStyle('animation-bounce-right');
        }}
      >
        {presets.value.map((preset, index) => (
          <SwiperSlide key={`${index}-slide`}>
            {({ isActive }) => (
              <span
                style={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
                className={isActive ? animationStyle : ''}
              >
                {preset.name}
              </span>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default MainTitle;
