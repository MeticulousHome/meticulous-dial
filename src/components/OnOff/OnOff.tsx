import { useCallback, useEffect, useState } from 'react';
import {
  handleAddPresetAnimation,
  handleRemovePresetsAnimation
} from '../../utils/preset';

import { Swiper, SwiperSlide } from 'swiper/react';

import './onOff.css';
import { useAppSelector } from '../store/hooks';

export function OnOff(): JSX.Element {
  const [swiper, setSwiper] = useState(null);
  const [options] = useState(['Yes', 'No']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture } = useAppSelector((state) => state);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    if (screen.value === 'onOff') {
      switch (gesture.value) {
        case 'right':
          if (activeIndex < options.length - 1) {
            setActiveIndex(activeIndex + 1);
          }
          break;
        case 'left':
          if (activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
          }
          break;
        default:
          break;
      }
    }
  }, [screen, gesture]);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (
      (screen.value === 'scale' && screen.prev === 'onOff') ||
      (screen.value === 'onOff' && screen.prev === 'scale')
    ) {
      animation = '';
    } else if (screen.value === 'onOff') {
      animation = 'onOff__fadeIn';
    } else if (screen.prev === 'onOff') {
      animation = 'onOff__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className={`on-off-wrapper ${getAnimation()}`}>
      <div
        className="main-title-selected"
        style={{
          fontWeight: 'bold',
          fontSize: '35px',
          top: 60
        }}
      >
        pre-infusion
      </div>
      <div className="options-container">
        <Swiper
          slidesPerView={2}
          spaceBetween={-40}
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
