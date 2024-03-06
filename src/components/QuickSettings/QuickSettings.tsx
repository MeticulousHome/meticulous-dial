import './quick-settings.css';
import { useEffect, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';
import { Swiper, SwiperSlide } from 'swiper/react';
import { WifiSettings } from '../Wifi/WifiSettings';

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
    key: 'wifi',
    label: 'wifi'
  },
  {
    key: 'exit',
    label: 'exit'
  }
] as const;

export function QuickSettings(): JSX.Element {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const stats = useAppSelector((state) => state.stats);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useHandleGestures(
    {
      context() {
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: QuickSettings
          })
        );
      },
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
            dispatch(setScreen('pressets'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'purge': {
            socket.emit('action', 'purge');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'calibrate': {
            socket.emit('calibrate', '');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'wifi': {
            // dispatch(setScreen('wifiSettings'));
            dispatch(
              setBubbleDisplay({ visible: true, component: WifiSettings })
            );
            break;
          }
          case 'exit': {
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible || stats.waitingForActionAlreadySent
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
        {settings.map((setting, index: number) => {
          const isActive = index === activeIndex;
          return (
            <SwiperSlide
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
              key={`option-${index}`}
            >
              <div
                style={{
                  height: '30px !important'
                }}
              >
                {setting.label}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
