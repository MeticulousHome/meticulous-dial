import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import {
  handleAddPresetAnimation,
  handleRemovePresetsAnimation
} from '../../utils/preset';

import './multipleOptionSlider.css';

interface Props {
  options: string[];
  activeIndex: number;
  contentAnimation: 'FadeOut' | 'FadeIn' | 'None';
  title: string;
  extraClass?: string;
  spaceBetween?: string | number;
}

export function MultipleOptionSlider({
  activeIndex,
  options,
  contentAnimation,
  title,
  extraClass,
  spaceBetween
}: Props): JSX.Element {
  const [swiper, setSwiper] = useState(null);

  useEffect(() => {
    if (swiper) {
      try {
        swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error, location: 'MultipleOptionSlider' });
      }
    }
  }, [activeIndex, swiper]);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    switch (contentAnimation) {
      case 'FadeIn':
        animation = 'multipleOptionContent__fadeIn';
        break;
      case 'FadeOut':
        animation = 'multipleOptionContent__fadeOut';
        break;
      case 'None':
        animation = '';
        break;
    }

    return animation;
  }, [contentAnimation]);

  return (
    <div className={`multiple-option-wrapper ${getAnimation()}`}>
      <div
        className="main-title-selected"
        style={{
          fontWeight: 'bold',
          fontSize: '35px',
          top: 60
        }}
      >
        {title}
      </div>
      <div className={`options-container ${extraClass ? extraClass : ''}`}>
        <Swiper
          slidesPerView={2}
          spaceBetween={spaceBetween}
          centeredSlides={true}
          allowTouchMove={false}
          initialSlide={0}
          onSwiper={setSwiper}
          onSlideChange={(e) => {
            handleRemovePresetsAnimation(e);

            setTimeout(() => {
              handleAddPresetAnimation(e);
            }, 20);
          }}
        >
          {options.map((option, index) => (
            <SwiperSlide key={`${index}-slide`}>
              {() => (
                <div
                  style={{
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  {option}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
