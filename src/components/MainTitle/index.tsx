import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import {
  handleAddPresetAnimation,
  handleRemovePresetsAnimation
} from '../../utils/preset';

import { useAppSelector } from '../store/hooks';

const MainTitle = () => {
  const { presets, screen, stats } = useAppSelector((state) => state);
  const [swiper, setSwiper] = useState(null);
  const currentAnimation = useRef('');

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (presets.activePresetIndex > -1 && presets.value.length > 0 && swiper) {
      slideTo(presets.activePresetIndex);
    }
  }, [presets, swiper]);

  useEffect(() => {
    if (screen.value !== 'pressets') {
      if (swiper) {
        handleRemovePresetsAnimation(swiper);
      }
    }
  }, [screen.value]);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (screen.value === 'scale' || screen.prev === 'scale') {
      animation = currentAnimation.current;
    } else if (screen.value === 'barometer') {
      if (screen.prev === 'pressetSettings') {
        animation = 'title__smallTwo';
      } else {
        animation = 'title__small';
      }
    } else if (screen.value === 'pressetSettings') {
      if (screen.prev === 'barometer') {
        animation = 'title__BigTwo';
      } else if (screen.prev === 'settingNumerical') {
        animation = 'titleBigSettingNumerical';
      } else if (screen.prev === 'circleKeyboard') {
        animation = 'titleSmallCircleKeyboard__fadeIn';
      }
    } else if (screen.value === 'pressets') {
      animation = 'title__Big';
    } else if (screen.value === 'settingNumerical') {
      animation = 'titleSmallSettingNumerical';
    } else if (screen.value === 'circleKeyboard') {
      animation = 'titleBigCircleKeyboard__fadeOut';
    }

    currentAnimation.current = animation;

    return animation;
  }, [screen]);

  return (
    <div
      className={`main-title-selected ${getAnimation()}`}
      style={{
        width: '100%'
      }}
    >
      {stats.name !== 'idle' ? (
        <div>{stats.profile}</div>
      ) : (
        <Swiper
          slidesPerView={screen.value === 'pressets' ? 2 : 1}
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
          {presets.value.map((preset, index) => (
            <SwiperSlide key={`${index}-slide`}>
              {() => (
                <div
                  style={{
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  {preset.name}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
};

export default MainTitle;
