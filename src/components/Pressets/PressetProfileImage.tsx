import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import SwiperS, { Pagination as PaginationSwiper } from 'swiper';

import { getProfileDefaultImages } from '../../api/profile';
import { setScreen } from '../store/features/screens/screens-slice';
import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
// import { ProfileImage } from "./ProfileImage";
import { RouteProps } from '../../navigation';
import { useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { IPresetImage, IPresetSetting } from '../../types';
import { useDispatch } from 'react-redux';
import { updatePresetSetting } from '../store/features/preset/preset-slice';

const API_URL = process.env.SERVER_URL || 'http://localhost:8080';

// const colors: string[] = [
//     '#FFFFFF',
//     '#7E9970',
//     '#FF5E5E',
//     '#2F3C61',
//     '#FC5217',
//     '#3D1E2E',
//     '#74AFD3',
//     '#212630',
//     '#9A9EAD',
//     '#7B6B85',
//     '#281E35',
//     '#A6C8C6',
//     '#81B5A9',
//     '#8D7D5C',
//     '#547D98',
//     '#485434',
//     '#1F254F',
//     '#86C4B5',
//     '#AA7A55',
//     '#8CC4DB',
//     '#5FAD92',
//     '#313E38',
//     '#ADC1D3',
//     '#A7A27A',
//     '#FA8888',
//     '#9CAEA0'
// ];
// const cLength = colors.length - 1;

export const PressetProfileImage = ({ transitioning }: RouteProps) => {
  const dispatch = useDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const presets = useAppSelector((state) => state.presets);
  const setting = presets.updatingSettings.settings[
    presets.activeSetting
  ] as IPresetImage;

  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  // const [pressetSwiper, setPressetsSwiper] = useState<SwiperS | null>(null);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const imagesStore = useAppSelector((state) => state.images);

  const updateSetting = (updatedText: string) => {
    const updatedSetting = {
      ...setting,
      value: updatedText.replace('/api/v1/profile/image/', '')
    } as IPresetSetting;
    dispatch(updatePresetSetting(updatedSetting));
    dispatch(setScreen('pressetSettings'));
  };

  const loadImages = useCallback(async () => {
    const images = await getProfileDefaultImages();
    if (images.length <= 0) return setScreen('pressetSettings');

    setImages(images);
    setIsLoadingImages(false);
  }, []);

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
    loadImages();
  }, []);

  useEffect(() => {
    presetSwiperRef.current?.swiper.slideTo(activeIndex);
  }, [activeIndex]);

  if (isLoadingImages) {
    return <></>;
  }

  return (
    <div className="preset-wrapper">
      <Swiper
        // onSwiper={setPressetsSwiper}
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
          dynamicBullets: images.length > 5,
          bulletActiveClass: 'swiper-pagination-bullet-active',
          bulletClass: 'swiper-pagination-bullet'
        }}
      >
        {images.length &&
          images.map((image) => (
            <SwiperSlide key={image}>
              {() => (
                <div>
                  <img
                    src={`${API_URL}${
                      image.includes('/api/v1/profile/image/')
                        ? image
                        : `/api/v1/profile/image/${image}`
                    }`}
                    alt="No image"
                    width="164"
                    height="164"
                    className="profile-image"
                    style={{ border: '7px solid #e0dcd0' }}
                  />
                </div>
              )}
            </SwiperSlide>
          ))}
      </Swiper>
    </div>
  );
};
