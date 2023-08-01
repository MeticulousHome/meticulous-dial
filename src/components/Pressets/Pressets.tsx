// Core modules imports are same as usual
import { useCallback, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';

import { handlePresetSlideChange } from '../../utils/preset';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './pressets.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import {
  addPresetNewOne,
  setNextPreset,
  setPrevPreset
} from '../store/features/preset/preset-slice';
import { Title, RouteProps } from '../../navigation';

export function Pressets({ transitioning }: RouteProps): JSX.Element {
  const dispatch = useAppDispatch();
  const { presets } = useAppSelector((state) => state);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);

  const slideTo = useCallback((index: number) => {
    try {
      presetSwiperRef.current?.swiper.slideTo(index);
      titleSwiperRef.current?.swiper.slideTo(index);
    } catch (error) {
      console.log({ error, location: 'Pressets' });
    }
  }, []);

  useHandleGestures({
    click() {
      if (presets.activeIndexSwiper === presets.value.length) {
        dispatch(addPresetNewOne());
      } else {
        dispatch(setScreen('barometer'));
      }
    },
    left() {
      if (!transitioning) {
        dispatch(setNextPreset());
      }
    },
    right() {
      if (!transitioning) {
        dispatch(setPrevPreset());
      }
    }
  });

  useEffect(() => {
    slideTo(presets.activeIndexSwiper);
  }, [presets.activeIndexSwiper, slideTo]);

  return (
    <div className="preset-wrapper">
      {presets.defaultPresetIndex > -1 && (
        <>
          <Swiper
            slidesPerView={2.15}
            spaceBetween={0}
            initialSlide={presets.activeIndexSwiper}
            centeredSlides={true}
            allowTouchMove={false}
            ref={presetSwiperRef}
            onSlideChange={handlePresetSlideChange}
          >
            {presets.value.length &&
              presets.value.map((preset) => (
                <SwiperSlide key={preset.id}>
                  {() => (
                    <div className="main-layout-content">
                      <div className="pressets-conainer">
                        <div className="presset-item presset-active">
                          <div className="presset-icon">
                            <svg
                              width="166"
                              height="166"
                              viewBox="0 0 166 166"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="83"
                                cy="83"
                                r="80.5"
                                stroke="white"
                                strokeWidth="5"
                              />
                              <circle
                                cx="83"
                                cy="83"
                                r="10.6875"
                                fill="#F5C444"
                              />
                              <path
                                d="M83 83L124.562 41.4375"
                                stroke="#F5C444"
                                strokeWidth="5"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </SwiperSlide>
              ))}
            <SwiperSlide key="new">
              {() => (
                <div className="main-layout-content">
                  <div className="pressets-conainer">
                    <div className="presset-item presset-active">
                      <div className="presset-icon">
                        <svg
                          width="204"
                          height="204"
                          viewBox="0 0 204 204"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect width="204" height="204" fill="black" />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M104.745 99.2547V32H99.2551V99.2547H32V104.745H99.2551V172H104.745V104.745H172V99.2547H104.745Z"
                            fill="white"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </SwiperSlide>
          </Swiper>
          <Swiper
            slidesPerView={2.15}
            spaceBetween={0}
            centeredSlides={true}
            initialSlide={presets.activeIndexSwiper}
            allowTouchMove={false}
            ref={titleSwiperRef}
            onSlideChange={handlePresetSlideChange}
            className={`title-swiper ${transitioning ? 'transitioning' : ''}`}
          >
            {presets.value.map((preset) => (
              <SwiperSlide key={preset.id}>
                {() => <Title>{preset.name}</Title>}
              </SwiperSlide>
            ))}
            <SwiperSlide key="new">{() => <Title>New</Title>}</SwiperSlide>
          </Swiper>
        </>
      )}
    </div>
  );
}
