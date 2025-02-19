import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper/modules';

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

import './defaultProfiles.less';

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

const DefaultProfileContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  align-items: start;
  justify-content: center;
  padding-top: 30px;
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

const Fade = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  z-index: 50;

  &.fade-top {
    top: 0;
    height: 200px;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 1) 25%,
      rgba(0, 0, 0, 0.7) 85%,
      rgba(0, 0, 0, 0.7) 95%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  &.fade-bottom {
    bottom: 0;
    height: 200px;
    background: linear-gradient(
      0deg,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 1) 25%,
      rgba(0, 0, 0, 0.7) 60%,
      rgba(0, 0, 0, 0.7) 95%,
      rgba(0, 0, 0, 0) 100%
    );
  }
`;

export const DefaultIcon = ({
  profile,
  index
}: {
  profile: Profile;
  index: number;
}) => {
  let url = `assets/images/${(index % 24) + 1}.png`;
  if (profile.display?.image) {
    url = `${API_URL}${api.getProfileImageUrl(profile.display.image)}`;
  }
  return (
    <img
      src={url}
      alt="No image"
      width="50"
      height="50"
      style={{
        border: `8px solid ${profile.display?.accentColor ?? '#e0dcd0'}`
      }}
    />
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
          modules={[PaginationSwiper]}
          pagination={{
            dynamicBullets: false
          }}
        >
          {defaultProfiles?.map((profile, index) => (
            <SwiperSlide key={profile.id.toString()}>
              {() => (
                <DefaultProfileContainer>
                  <DefaultIcon profile={profile} index={index} />
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
      <Fade className="fade-top" />
      <Fade className="fade-bottom" />
    </>
  );
};
