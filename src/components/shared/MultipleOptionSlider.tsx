import { useEffect, useRef } from 'react';
import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';

import { handlePresetSlideChange } from '../../utils/preset';

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
  const swiperRef = useRef<SwiperRef | null>(null);

  useEffect(() => {
    try {
      swiperRef.current?.swiper.slideTo(activeIndex);
    } catch (error) {
      console.log({ error, location: 'MultipleOptionSlider' });
    }
  }, [activeIndex]);

  return (
    <div className={`multiple-option-wrapper`}>
      <div className={`options-container ${extraClass ? extraClass : ''}`}>
        <Swiper
          slidesPerView={2}
          spaceBetween={spaceBetween}
          centeredSlides={true}
          allowTouchMove={false}
          initialSlide={activeIndex}
          ref={swiperRef}
          onSlideChange={handlePresetSlideChange}
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
