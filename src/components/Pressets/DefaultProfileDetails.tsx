import { useEffect, useMemo, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { api } from '../../api/api';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';

const API_URL = process.env.SERVER_URL || 'http://localhost:8080';
const items = [{ key: 'content' }, { key: 'back' }];

export const DefaultProfileDetails = () => {
  const dispatch = useAppDispatch();

  const [activeIndex, setActiveIndex] = useState(0);
  const presetSwiperRef = useRef<SwiperRef | null>(null);

  const defaultProfile = useAppSelector(
    (state) => state.presets.defaultProfileSelected
  );

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    right() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: 'quick-settings' })
          );
          break;

        default:
          break;
      }
    }
  });

  useEffect(() => {
    presetSwiperRef.current?.swiper.slideTo(activeIndex);
  }, [activeIndex]);

  return (
    <div className="main-quick-settings">
      <Swiper
        ref={presetSwiperRef}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
        autoHeight={false}
        initialSlide={activeIndex}
        centeredSlides={true}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        <SwiperSlide key="content">
          <div
            style={{
              width: '100%'
            }}
          >
            <div
              style={{
                transform: 'translateX(-7%)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <img
                  src={`${API_URL}${api.getProfileImageUrl(
                    defaultProfile.display.image
                  )}`}
                  alt="No image"
                  width="50"
                  height="50"
                  className="profile-image image-prev"
                  style={{
                    border: `7px solid ${
                      defaultProfile.display.accentColor ?? '#e0dcd0'
                    }`,
                    display: 'block',
                    position: 'relative'
                  }}
                />
              </div>
              <p>{defaultProfile.name}</p>
              <p>{defaultProfile.description}</p>
            </div>
          </div>
        </SwiperSlide>
        <SwiperSlide></SwiperSlide>

        <SwiperSlide
          key="back"
          className={`settings-item ${
            items[activeIndex].key === 'back' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            <span>Back</span>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
