import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { setScreen } from '../store/features/screens/screens-slice';
import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
import { RouteProps } from '../../navigation';
import { useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { IPresetImage, IPresetSetting } from '../../types';
import { useDispatch } from 'react-redux';
import { useDimScreen } from '../../hooks/useDimScreen';
import { api } from '../../api/api';
import { useProfileDefaultImages } from '../../hooks/useProfiles';
import { useProfileContext } from '../../context/ProfileContext';
import { styled } from 'styled-components';

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

const SwiperWrapper = styled.div`
  width: 100%;
  height: 100%;

  .swiper-pagination {
    top: 352px;
    line-height: 0;
  }

  .swiper {
    width: 100%;
    height: 100%;
  }
`;

export const PressetProfileImage = ({ transitioning }: RouteProps) => {
  const dispatch = useDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { value: currentScreen } = useAppSelector((state) => state.screen);
  const { settingsIndex, settingsProfile, setSettingsProfile } =
    useProfileContext();
  const setting = settingsProfile.settings[settingsIndex] as IPresetImage;

  const { data: images, isLoading: isLoadingImages } =
    useProfileDefaultImages();
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useDimScreen();
  const updateSetting = (updatedText: string) => {
    const updatedSetting = {
      ...setting,
      value: updatedText
        ? updatedText.replace('/api/v1/profile/image/', '')
        : ''
    } as IPresetSetting;
    setSettingsProfile((prev) => ({
      ...prev,
      settings: [
        ...prev.settings.slice(0, settingsIndex),
        updatedSetting,
        ...prev.settings.slice(settingsIndex + 1)
      ]
    }));
    dispatch(setScreen('pressetSettings'));
  };

  useHandleGestures(
    {
      pressDown() {
        const newImageUrl = images[activeIndex];
        updateSetting(newImageUrl);
      },
      left() {
        if (!transitioning) {
          setActiveIndex((prev) => Math.min(prev + 1, images.length - 1));
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
    if (currentScreen !== 'pressetProfileImage') {
      setActiveIndex(0);
    }
  }, [currentScreen]);

  useEffect(() => {
    presetSwiperRef.current?.swiper.slideTo(activeIndex);
  }, [activeIndex]);

  if (isLoadingImages) {
    return <></>;
  }

  return (
    <SwiperWrapper>
      <Swiper
        effect={'coverflow'}
        coverflowEffect={{
          rotate: 20,
          stretch: -50,
          scale: 1.1,
          depth: 200,
          modifier: 1.0,
          slideShadows: false
        }}
        slidesPerView={2}
        spaceBetween={20}
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
          type: 'fraction'
        }}
      >
        {images.length &&
          images.map((image) => (
            <SwiperSlide
              key={image}
              style={{
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {() => (
                <div>
                  <img
                    src={`
                      ${API_URL}${api.getProfileImageUrl(image)}
                      `}
                    alt="No image"
                    width="164"
                    height="164"
                    className="profile-image"
                    style={{ border: '8px solid #e0dcd0' }}
                  />
                </div>
              )}
            </SwiperSlide>
          ))}
      </Swiper>
    </SwiperWrapper>
  );
};
