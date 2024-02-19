import './quick-settings.css';
import { useEffect, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';
import { Swiper, SwiperSlide } from 'swiper/react';

const settings = [
  {
    key: 'wifi',
    label: 'wifi'
  },
  {
    key: 'power',
    label: 'power'
  },
  {
    key: 'idle',
    label: 'idle'
  },
  {
    key: 'setting',
    label: 'setting'
  },
  {
    key: 'sleep',
    label: 'sleep'
  }
] as const;

export function QuickSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [animationStyle, setAnimationStyle] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const socket = useSocket();

  useHandleGestures({
    longTare() {
      dispatch(setBubbleDisplay({ visible: false, component: null }));
    },
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
    },
    click() {
      socket.emit('action', settings[activeIndex].key);
      dispatch(setBubbleDisplay({ visible: false, component: null }));
    }
  });

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  return (
    <div className="main-quick-settings">
      <div className="presset-container">
        <div className="presset-options">
          <Swiper
            onSwiper={setSwiper}
            slidesPerView={9}
            allowTouchMove={false}
            direction="vertical"
            autoHeight={false}
            centeredSlides={true}
            initialSlide={activeIndex}
            onSlideNextTransitionStart={() => {
              setAnimationStyle('animation-next');
            }}
            onSlidePrevTransitionStart={() => {
              setAnimationStyle('animation-prev');
            }}
            onSlideChangeTransitionEnd={() => setAnimationStyle('')}
          >
            {settings.map((setting, index: number) => {
              const isActive = index === activeIndex;
              return (
                <SwiperSlide
                  className={`${animationStyle} settings-item ${
                    isActive ? 'active-setting' : ''
                  }`}
                  key={`option-${index}`}
                >
                  <div>{setting.label}</div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
    </div>
  );
}
