import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useAppSelector } from '../store/hooks';

const MainTitle = () => {
  const { presets, screen } = useAppSelector((state) => state);
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (presets.activePresetIndex > -1 && presets.value.length > 0) {
      slideTo(presets.activePresetIndex);
    }
  }, [presets]);

  useEffect(() => {
    if (screen.value !== 'pressets') {
      setAnimationStyle('');
    }
  }, [screen.value]);

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
  );
};

export default MainTitle;
