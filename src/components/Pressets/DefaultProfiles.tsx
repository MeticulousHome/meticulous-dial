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
import { addPresetNewOne } from '../store/features/preset/preset-slice';

export const DefaultProfiles = ({ transitioning }: RouteProps): JSX.Element => {
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const isLoading = useAppSelector((state) => state.presets.pending);
  const defaultProfiles = useAppSelector(
    (state) => state.presets.defaultProfiles
  );
  const dispatch = useAppDispatch();

  const [activeIndex, setActiveIndex] = useState(0);

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
          setActiveIndex((prev) =>
            Math.min(prev + 1, defaultProfiles.length - 1)
          );
        }
      },
      right() {
        if (!transitioning) {
          setActiveIndex((prev) => Math.max(prev - 1, 0));
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

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="preset-wrapper">
      <Swiper
        slidesPerView={2.15}
        spaceBetween={79}
        initialSlide={activeIndex}
        centeredSlides={true}
        allowTouchMove={false}
        ref={presetSwiperRef}
        onSlideChange={(e) => {
          clearSlides(e);
          handlePresetSlideChange(e);
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
                <ProfileImage preset={preset} />
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      <Swiper
        slidesPerView={2.15}
        spaceBetween={79}
        centeredSlides={true}
        initialSlide={activeIndex}
        allowTouchMove={false}
        ref={titleSwiperRef}
        onSlideChange={(e) => {
          clearSlides(e);
          handlePresetSlideChange(e);
        }}
        className={`title-swiper ${transitioning ? 'transitioning' : ''}`}
      >
        {defaultProfiles.length &&
          defaultProfiles.map((preset) => {
            return (
              <SwiperSlide
                key={preset.isTemporary ? 'temp' : preset.id.toString()}
              >
                {() => (
                  <Title
                    customClass={`presset-title-top ${
                      (preset.isTemporary || false) && 'presset-title-temp'
                    }`}
                  >
                    {preset.name}
                  </Title>
                )}
              </SwiperSlide>
            );
          })}
      </Swiper>
    </div>
  );
};
