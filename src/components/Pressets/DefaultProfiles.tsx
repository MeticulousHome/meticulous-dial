import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper';

import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
import { ProfileImage } from './ProfileImage';
import { RouteProps, Title } from '../../navigation';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import {
  addPresetNewOne,
  resetDefaultProfileConfig,
  setNextDefaultProfileOption,
  setPrevDefaultProfileOption
} from '../store/features/preset/preset-slice';
import './defaultProfile.css';
import { api } from '../../api/api';

const API_URL = process.env.SERVER_URL || 'http://localhost:8080';

export const DefaultProfiles = ({ transitioning }: RouteProps): JSX.Element => {
  const activeIndex = useAppSelector(
    (state) => state.presets.defaultProfileActiveIndexSwiper
  );
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const isLoading = useAppSelector((state) => state.presets.pending);
  const defaultProfiles = useAppSelector(
    (state) => state.presets.defaultProfiles
  );
  const dispatch = useAppDispatch();

  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);

  useHandleGestures(
    {
      pressDown() {
        if (!transitioning && defaultProfiles && defaultProfiles[activeIndex]) {
          dispatch(addPresetNewOne({ profile: defaultProfiles[activeIndex] }));
          dispatch(setScreen('pressets'));
        }
      },
      left() {
        if (!transitioning) {
          dispatch(setNextDefaultProfileOption());
        }
      },
      right() {
        if (!transitioning) {
          dispatch(setPrevDefaultProfileOption());
        }
      }
    },
    bubbleDisplay.visible
  );

  useEffect(() => {
    presetSwiperRef.current?.swiper.slideTo(activeIndex);
    titleSwiperRef.current?.swiper.slideTo(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (!isLoading && defaultProfiles.length === 0) {
      setScreen('pressetSettings');
    }
  }, [isLoading, defaultProfiles]);

  useEffect(() => {
    dispatch(resetDefaultProfileConfig());
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div id="default-profile-container" className="preset-wrapper">
      <Swiper
        slidesPerView={4}
        spaceBetween={0}
        initialSlide={activeIndex}
        centeredSlides={true}
        allowTouchMove={false}
        ref={presetSwiperRef}
        direction="vertical"
        onSlideChange={(e) => {
          clearSlides(e);
          handlePresetSlideChange(e, 'vertical');
        }}
        modules={[PaginationSwiper]}
        pagination={{
          dynamicBullets: false,
          bulletActiveClass: 'swiper-pagination-bullet-active',
          bulletClass: 'swiper-pagination-bullet'
        }}
      >
        {defaultProfiles.map((preset) => (
          <SwiperSlide key={preset.isTemporary ? 'temp' : preset.id.toString()}>
            {() => (
              <div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <img
                    src={`${API_URL}${api.getProfileImageUrl(
                      preset.display.image
                    )}`}
                    alt="No image"
                    width="50"
                    height="50"
                    className="profile-image image-prev"
                    style={{
                      border: `7px solid ${
                        preset.display.accentColor ?? '#e0dcd0'
                      }`,
                      display: 'block',
                      position: 'relative'
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      marginLeft: '10px'
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        textAlign: 'left',
                        marginBottom: '10px'
                      }}
                    >
                      {preset.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        textAlign: 'left',
                        maxWidth: '155px',
                        wordBreak: 'break-all'
                      }}
                    >
                      {preset.description}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};
