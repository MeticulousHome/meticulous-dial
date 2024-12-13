import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { marqueeIfNeeded } from '../../shared/MarqueeValue';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import { DeviceInfo } from '@meticulous-home/espresso-api';

export const DeviceInfoScreen = () => {
  const dispatch = useAppDispatch();
  const { data: deviceInfo } = useDeviceInfo();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const settingsKeys = Object.keys(deviceInfo || []).concat('back');

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settingsKeys.length - 1));
      },
      pressDown() {
        const activeItem = settingsKeys[activeIndex];
        switch (activeItem) {
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          default: {
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible
  );

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  return (
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
        autoHeight={false}
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        {Object.entries(settingsKeys).map((item, index: number) => {
          const isActive = index === activeIndex;
          const name = item[1] as keyof DeviceInfo;
          return (
            <SwiperSlide
              key={index}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
            >
              <div style={{ height: '30px' }}>
                <div className="settings-entry text-container">
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {marqueeIfNeeded({
                      val: `${name}${deviceInfo[name] !== undefined ? `: ${deviceInfo[name] || 'UNSET'}` : ''}`,
                      enabled: isActive
                    })}
                  </span>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};
