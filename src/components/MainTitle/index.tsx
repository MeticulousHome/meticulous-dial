import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useAppSelector } from '../store/hooks';

const MainTitle = () => {
  const { presets, screen } = useAppSelector((state) => state);
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (presets.activePreset > -1) {
      slideTo(presets.activePreset);
    }
  }, [presets.activePreset]);

  return (
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
            <span className={isActive ? animationStyle : ''}>
              {preset.name}
            </span>
          )}
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default MainTitle;
