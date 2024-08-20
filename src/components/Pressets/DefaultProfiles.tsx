import { useEffect, useRef } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper';

import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
import { RouteProps } from '../../navigation';
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
import { Profile } from 'meticulous-typescript-profile';

const API_URL = process.env.SERVER_URL || 'http://localhost:8080';

export const DefaultProfiles = ({ transitioning }: RouteProps): JSX.Element => {
  const activeIndex = useAppSelector(
    (state) => state.presets.defaultProfilesInfo.defaultProfileActiveIndexSwiper
  );
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const isLoading = useAppSelector(
    (state) => state.presets.defaultProfilesInfo.status === 'pending'
  );
  const defaultProfiles = useAppSelector(
    (state) => state.presets.defaultProfilesInfo.defaultProfiles
  );
  const dispatch = useAppDispatch();

  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);

  useHandleGestures(
    {
      pressDown() {
        if (transitioning) return;

        if (activeIndex === defaultProfiles.length)
          dispatch(setScreen('pressets'));

        if (defaultProfiles && defaultProfiles[activeIndex]) {
          const { ...profileSelected } = defaultProfiles[
            activeIndex
          ] as Profile;
          dispatch(
            addPresetNewOne({
              profile: {
                ...profileSelected,
                display: {
                  shortDescription: profileSelected.display.shortDescription,
                  description: profileSelected.display.description
                }
              } as unknown as Profile
            })
          );
          dispatch(setScreen('pressets'));
        }
      },
      left() {
        if (!transitioning) {
          dispatch(setPrevDefaultProfileOption());
        }
      },
      right() {
        if (!transitioning) {
          dispatch(setNextDefaultProfileOption());
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
      // if there is not default profile user is sent to pressets screen
      dispatch(setScreen('pressets'));
    }
  }, [isLoading, defaultProfiles]);

  useEffect(() => {
    dispatch(resetDefaultProfileConfig());
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
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
          {defaultProfiles.map((preset, index) => (
            <SwiperSlide key={preset.id.toString()}>
              {() => (
                <div
                  style={{
                    width: '100%'
                  }}
                >
                  <div className="default-profile-container">
                    <div></div>
                    <div className="default-profile-container__content">
                      <div className="default-profile-container__content__info">
                        <img
                          src={`${API_URL}${api.getProfileImageUrl(
                            preset.display.image
                          )}`}
                          alt="No image"
                          width="60"
                          height="60"
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
                              fontSize: '20px'
                            }}
                            className={`default-profile-container__content__info__text default-profile-container__content__info__text--mb-10 ${
                              activeIndex === index
                                ? 'default-profile-container__content__info__text--active'
                                : ''
                            }`}
                          >
                            {preset.name}
                          </span>
                          <span className="default-profile-container__content__info__text">
                            {preset.display.shortDescription}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div></div>
                  </div>
                </div>
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
              <div className="default-profile-container">
                <div></div>
                <div
                  className={`default-profile-container__content ${
                    activeIndex === defaultProfiles.length
                      ? 'default-profile-container__content__info__text--active '
                      : ''
                  }`}
                >
                  <div className="default-profile-container__content__info">
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        marginLeft: '10px',
                        fontSize: '20px'
                      }}
                    >
                      <span>Back</span>
                    </div>
                  </div>
                </div>
                <div></div>
              </div>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
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
