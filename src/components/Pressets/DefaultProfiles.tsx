import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper';

import { profiles } from '../../data/defaultProfiles';
import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
import { ProfileValue } from '../store/features/preset/preset-slice';
import { ProfileImage } from './ProfileImage';
import { RouteProps, Title } from '../../navigation';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppSelector } from '../store/hooks';

export const DefaultProfiles = ({ transitioning }: RouteProps): JSX.Element => {
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const [activeIndex, setActiveIndex] = useState(0);
  const [defaultProfiles] = useState<Array<ProfileValue>>(profiles);

  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);

  useHandleGestures(
    {
      pressDown() {
        console.log('Selecting....');
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
