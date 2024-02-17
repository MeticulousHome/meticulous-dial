import { Swiper, SwiperRef, SwiperSlide } from 'swiper/react';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useEffect, useRef, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';

const settings = [
  {
    key: 'home',
    label: 'home'
  },
  {
    key: 'purge',
    label: 'purge'
  },
  {
    key: 'calibrate',
    label: 'calibrate scale'
  },
  {
    key: 'exit',
    label: 'exit'
  }
] as const;

export function Settings(): JSX.Element {
  const dispatch = useAppDispatch();
  const screen = useAppSelector((state) => state.screen);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');
  const swiperRef = useRef<SwiperRef>(null);
  const socket = useSocket();

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
      },
      click() {
        switch (settings[activeIndex].key) {
          case 'home': {
            socket.emit('action', 'home');
            dispatch(setScreen('barometer'));
            break;
          }
          case 'purge': {
            socket.emit('action', 'purge');
            dispatch(setScreen('barometer'));
            break;
          }
          case 'calibrate': {
            socket.emit('calibrate', '');
            dispatch(setScreen('barometer'));
            break;
          }
          case 'exit': {
            dispatch(
              setScreen(screen.prev === 'scale' ? 'barometer' : screen.prev)
            );
            break;
          }
        }
      }
    },
    bubbleDisplay.visible
  );

  useEffect(() => {
    if (swiperRef.current?.swiper) {
      try {
        swiperRef.current.swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error, location: 'Settings' });
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
          {settings.map((setting, index) => (
            <SwiperSlide
              className="setting-option-item"
              key={`option-${index}`}
            >
              {({ isActive }) => (
                <div
                  className={`${animationStyle} ${
                    isActive ? `item-active` : ''
                  } `}
                >
                  {setting.label}
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
}
