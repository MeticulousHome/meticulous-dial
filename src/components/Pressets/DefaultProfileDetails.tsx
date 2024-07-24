import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { useAppSelector } from '../store/hooks';
import { FormatSetting } from '../PressetSettings/FormatSetting';
// import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useHandleGestures } from '../../hooks/useHandleGestures';

export const DefaultProfileDetails = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const presetSwiperRef = useRef<SwiperRef | null>(null);

  const defaultProfile = useAppSelector(
    (state) => state.presets.defaultProfileSelected
  );

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, defaultProfile.settings.length - 1)
        );
      },
      right() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      pressDown() {}
    }
    // bubbleDisplay.visible
  );

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
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        {defaultProfile.settings.map((setting, index: number) => {
          const isActive = index === activeIndex;

          return (
            <SwiperSlide
              key={`option-${index}`}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
            >
              <div
                className={` ${
                  setting.key === 'delete' ? 'delete-option-item' : ''
                }`}
              >
                <FormatSetting
                  customActiveClass="defaultProfileActive"
                  setting={setting}
                  isActive={
                    defaultProfile.settings[activeIndex].label === setting.label
                  }
                />
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};
