import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import {
  Pagination as PaginationSwiper,
  EffectCoverflow
} from 'swiper/modules';
import 'swiper/css';

import { getProfileDefaultImages } from '../../api/profile';
import { setScreen } from '../store/features/screens/screens-slice';
import { clearSlides, handlePresetSlideChange } from '../../utils/preset';
import { RouteProps } from '../../navigation';
import { useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { IPresetImage, IPresetSetting } from '../../types';
import { useDispatch } from 'react-redux';
import { updatePresetSetting } from '../store/features/preset/preset-slice';
import { api } from '../../api/api';

const API_URL = process.env.SERVER_URL || 'http://localhost:8080';

export const PressetProfileImage = ({ transitioning }: RouteProps) => {
  const dispatch = useDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { value: currentScreen } = useAppSelector((state) => state.screen);
  const presets = useAppSelector((state) => state.presets);
  const setting = presets.updatingSettings.settings[
    presets.activeSetting
  ] as IPresetImage;

  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateSetting = (updatedText: string) => {
    const updatedSetting = {
      ...setting,
      value: updatedText
        ? updatedText.replace('/api/v1/profile/image/', '')
        : ''
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
    <div className="image-swiper">
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
        slidesPerView={8}
        spaceBetween={20}
        initialSlide={activeIndex}
        centeredSlides={true}
        allowTouchMove={false}
        ref={presetSwiperRef}
        onSlideChange={(e) => {
          clearSlides(e);
          handlePresetSlideChange(e);
        }}
        modules={[PaginationSwiper, EffectCoverflow]}
        pagination={{
          type: 'fraction'
        }}
      >
        {images.length &&
          images.map((image) => (
            <SwiperSlide key={image}>
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
