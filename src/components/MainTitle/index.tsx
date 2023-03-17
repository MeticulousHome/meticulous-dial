import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import {
  handleAddPresetAnimation,
  handleRemovePresetsAnimation
} from '../../utils/preset';
import { setActiveIndexSwiper } from '../store/features/preset/preset-slice';

import { useAppSelector, useAppDispatch } from '../store/hooks';

const MainTitle = () => {
  const { presets, screen, stats } = useAppSelector((state) => state);
  const [swiper, setSwiper] = useState(null);
  const currentAnimation = useRef('');
  const dispatch = useAppDispatch();

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (swiper) {
      slideTo(presets.activeIndexSwiper);
      handlSlideChange();
    }
  }, [presets.activeIndexSwiper, swiper]);

  useEffect(() => {
    if (screen.value !== 'pressets') {
      if (swiper) {
        handleRemovePresetsAnimation(swiper);
      }
    }
  }, [screen.value]);

  useEffect(() => {
    if (
      stats.name === 'idle' &&
      screen.value !== 'pressets' &&
      screen.value !== 'scale' &&
      presets.activeIndexSwiper === presets.value.length
    ) {
      dispatch(setActiveIndexSwiper(presets.activeIndexSwiper - 1));
    }
  }, [stats.name, screen.value, presets.activeIndexSwiper, presets.value]);

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
      } else if (
        screen.prev === 'settingNumerical' ||
        screen.prev === 'onOff' ||
        screen.prev === 'purge'
      ) {
        animation = 'titleBigSettingNumerical';
      } else if (screen.prev === 'circleKeyboard') {
        animation = 'titleSmallCircleKeyboard__fadeIn';
      }
    } else if (screen.value === 'pressets') {
      animation = 'title__Big';
    } else if (
      screen.value === 'settingNumerical' ||
      screen.value === 'onOff' ||
      screen.value === 'purge'
    ) {
      animation = 'titleSmallSettingNumerical';
    } else if (screen.value === 'circleKeyboard') {
      animation = 'titleBigCircleKeyboard__fadeOut';
    }

    currentAnimation.current = animation;

    return animation;
  }, [screen]);

  const handlSlideChange = () => {
    if (swiper) {
      handleRemovePresetsAnimation(swiper);

      setTimeout(() => {
        handleAddPresetAnimation(swiper);
      }, 20);
    }
  };

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
        presets.defaultPresetIndex > -1 && (
          <Swiper
            slidesPerView={screen.value === 'pressets' ? 2 : 1}
            centeredSlides={true}
            initialSlide={presets.activeIndexSwiper}
            allowTouchMove={false}
            onSwiper={setSwiper}
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
            {(screen.value === 'pressets' ||
              (screen.value === 'scale' && screen.prev === 'pressets')) && (
              <SwiperSlide key={`${presets.value.length + 1}-slide`}>
                {() => (
                  <div
                    style={{
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                  >
                    New
                  </div>
                )}
              </SwiperSlide>
            )}
          </Swiper>
        )
      )}
    </div>
  );
};

export default MainTitle;
