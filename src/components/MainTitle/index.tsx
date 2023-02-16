import { useEffect, useState } from 'react';
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

  return (
    <div
      className={`main-title-selected ${
        screen.value === 'pressets'
          ? 'title__Big'
          : screen.value === 'pressetSettings'
          ? 'title__BigTwo'
          : screen.value === 'barometer' && screen.prev === 'pressetSettings'
          ? 'title__smallTwo'
          : 'title__small'
      }`}
      style={{
        display: `${
          (screen.value !== 'barometer' &&
            screen.value !== 'pressets' &&
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
