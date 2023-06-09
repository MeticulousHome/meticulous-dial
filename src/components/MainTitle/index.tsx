import { useEffect, useRef, useState } from 'react';
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
  const dispatch = useAppDispatch();

  const slideTo = (index: number) => {
    try {
      swiper.slideTo(index);
    } catch (error) {
      console.log({ error, location: 'MainTitle' });
    }
  };

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
      screen.value !== 'settings' &&
      presets.activeIndexSwiper === presets.value.length
    ) {
      dispatch(setActiveIndexSwiper(presets.activeIndexSwiper - 1));
    }
  }, [stats.name, screen.value, presets.activeIndexSwiper, presets.value]);

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
      className="main-title-selected"
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
              ((screen.value === 'scale' || screen.value === 'settings') &&
                screen.prev === 'pressets')) && (
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
