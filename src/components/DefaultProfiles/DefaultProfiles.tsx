import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper/modules';

import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
import { RouteProps } from '../../navigation';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import {
  addPresetNewOne,
  setDefaultProfileActiveIndex
} from '../store/features/preset/preset-slice';
import { Profile } from '@meticulous-home/espresso-profile';
import { v4 as uuidv4 } from 'uuid';
import { useDefaultProfiles } from '../../hooks/useProfiles';

import { styled } from 'styled-components';
import { api } from '../../api/api';

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

const DefaultProfileContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
`;

const DefaultProfileContentInfo = styled.div`
  width: 250px;
  padding-left: 10px;
  padding-right: 30px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
`;

const DefaultProfileContentInfoText = styled.span<{ $active?: boolean }>`
  display: block;
  text-align: left;
  word-break: break-word;
  word-break: auto-phrase; /* Not supported outside of chrome based browsers as of early 2025 */
  margin-bottom: 10px;

  ${({ $active }) => $active && 'color: #f5c444;'}
`;

const DefaultProfileWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;

  .swiper-pagination {
    position: absolute !important;
    top: 50% !important;
  }

  .swiper-slide {
    justify-content: flex-start;
  }
`;

export const DefaultIcon = ({ profile }: { profile: Profile }) => {
  if (profile.display?.image) {
    return (
      <img
        src={`${API_URL}${api.getProfileImageUrl(profile.display.image)}`}
        alt="No image"
        width="50"
        height="50"
        className="profile-image image-prev"
        style={{
          border: `8px solid ${profile.display?.accentColor ?? '#e0dcd0'}`,
          display: 'block',
          position: 'relative'
        }}
      />
    );
  }

  return (
    <svg
      width="60"
      height="60"
      viewBox="0 0 204 204"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M104.745 99.2547V32H99.2551V99.2547H32V104.745H99.2551V172H104.745V104.745H172V99.2547H104.745Z"
        fill="white"
      />
    </svg>
  );
};

export const DefaultProfiles = ({ transitioning }: RouteProps): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const { data: defaultProfiles, isLoading } = useDefaultProfiles();
  const dispatch = useAppDispatch();

  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);

  useHandleGestures(
    {
      pressDown() {
        if (transitioning) return;

        // back button
        if (activeIndex === defaultProfiles.length)
          dispatch(setScreen('profileHome'));

        if (defaultProfiles && defaultProfiles[activeIndex]) {
          const { ...profileSelected } = defaultProfiles[
            activeIndex
          ] as Profile;
          dispatch(
            addPresetNewOne({
              profile: {
                ...profileSelected,
                id: uuidv4(),
                display: {
                  shortDescription: profileSelected.display.shortDescription,
                  description: profileSelected.display.description
                }
              } as unknown as Profile
            })
          );
          dispatch(setScreen('profileHome'));
        }
      },
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, defaultProfiles?.length || 0)
        );
      }
    },
    bubbleDisplay.visible
  );

  useEffect(() => {
    presetSwiperRef.current?.swiper.slideTo(activeIndex);
    titleSwiperRef.current?.swiper.slideTo(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (!defaultProfiles) {
      return;
    }
    dispatch(setDefaultProfileActiveIndex(activeIndex));
  }, [activeIndex, defaultProfiles]);

  if (!defaultProfiles && isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <DefaultProfileWrapper>
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
          {defaultProfiles?.map((profile, index) => (
            <SwiperSlide key={profile.id.toString()}>
              {() => (
                <DefaultProfileContainer>
                  <DefaultIcon profile={profile} />
                  <DefaultProfileContentInfo>
                    <DefaultProfileContentInfoText
                      style={{
                        fontSize: '20px'
                      }}
                      $active={activeIndex === index}
                    >
                      {profile.name}
                    </DefaultProfileContentInfoText>
                    <DefaultProfileContentInfoText>
                      {profile.display.shortDescription}
                    </DefaultProfileContentInfoText>
                  </DefaultProfileContentInfo>
                </DefaultProfileContainer>
              )}
            </SwiperSlide>
          ))}
          <SwiperSlide key="back">
            <div
              style={{
                width: '100%',
                height: '50%'
              }}
            >
              <DefaultProfileContainer>
                <DefaultProfileContentInfoText
                  style={{
                    fontSize: '20px'
                  }}
                  $active={activeIndex === defaultProfiles.length}
                >
                  Back
                </DefaultProfileContentInfoText>
              </DefaultProfileContainer>
            </div>
          </SwiperSlide>
        </Swiper>
      </DefaultProfileWrapper>
      <div
        className="fade fade-top"
        style={{
          height: '200px',
          zIndex: 50
        }}
      ></div>
      <div
        className="fade fade-bottom"
        style={{
          height: '195px',
          zIndex: 50
        }}
      ></div>
    </>
  );
};
