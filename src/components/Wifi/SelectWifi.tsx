import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';

import './selectWifi.css';
import { selectWifi } from '../store/features/wifi/wifi-slice';

const MOCK_NETWORKS = [
  {
    key: 'wifi1',
    label: 'network 1'
  },
  {
    key: 'wifi2',
    label: 'network 2'
  },
  {
    key: 'wifi3',
    label: 'network 3'
  },
  {
    key: 'wifi4',
    label: 'network 4'
  },
  {
    key: 'wifi5',
    label: 'network 5'
  },
  {
    key: 'cancel',
    label: 'cancel'
  }
];

export const SelectWifi = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');

  const swiperRef = useRef<SwiperRef>(null);

  const dispatch = useAppDispatch();

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, MOCK_NETWORKS.length - 1));
    },
    click() {
      if (MOCK_NETWORKS[activeIndex].key === 'cancel') {
        dispatch(setScreen('wifiSettings'));
      } else {
        dispatch(selectWifi(MOCK_NETWORKS[activeIndex].key));
        dispatch(setScreen('enterWifiPassword'));
      }
    }
  });

  useEffect(() => {
    if (swiperRef.current?.swiper) {
      try {
        swiperRef.current.swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error, location: 'Wifi' });
      }
    }
  }, [activeIndex]);

  return (
    <div className="main-layout">
      <div className="settings-options">
        <Swiper
          ref={swiperRef}
          slidesPerView={9}
          allowTouchMove={false}
          initialSlide={activeIndex}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          onSlideNextTransitionStart={() => {
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {MOCK_NETWORKS.map((network, index) => (
            <SwiperSlide
              className="setting-option-item"
              key={`option-${index}`}
            >
              {({ isActive }) => (
                <div
                  className={`${animationStyle} ${
                    isActive ? `item-active` : ''
                  } network-option`}
                >
                  <span>{network.label}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    fill="currentColor"
                    className="bi bi-wifi"
                    viewBox="0 0 16 16"
                  >
                    {' '}
                    <path d="M15.384 6.115a.485.485 0 0 0-.047-.736A12.444 12.444 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.518.518 0 0 0 .668.05A11.448 11.448 0 0 1 8 4c2.507 0 4.827.802 6.716 2.164.205.148.49.13.668-.049z" />{' '}
                    <path d="M13.229 8.271a.482.482 0 0 0-.063-.745A9.455 9.455 0 0 0 8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065A8.46 8.46 0 0 1 8 7a8.46 8.46 0 0 1 4.576 1.336c.206.132.48.108.653-.065zm-2.183 2.183c.226-.226.185-.605-.1-.75A6.473 6.473 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.407.19.611.09A5.478 5.478 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.61-.091l.016-.015zM9.06 12.44c.196-.196.198-.52-.04-.66A1.99 1.99 0 0 0 8 11.5a1.99 1.99 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .707 0l.707-.707z" />{' '}
                  </svg>
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div className="fade fade-top"></div>
      <div className="fade fade-bottom"></div>
    </div>
  );
};
