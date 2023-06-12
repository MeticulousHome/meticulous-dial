import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import {
  handleAddPresetAnimation,
  handleRemovePresetsAnimation
} from '../../utils/preset';

import './multipleOptionSlider.css';

interface Props {
  options: string[];
  activeIndex: number;
  extraClass?: string;
  spaceBetween?: string | number;
}

export function MultipleOptionSlider({
  activeIndex,
  options,
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

  return (
    <div className={`multiple-option-wrapper`}>
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
