import { useEffect, useState } from 'react';

import './quick-settings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';
import { Swiper, SwiperSlide } from 'swiper/react';
import { resetActiveSetting } from '../store/features/preset/preset-slice';

const defaultSettings = [
  {
    key: 'edit',
    label: 'Edit profile'
  },
  {
    key: 'home',
    label: 'home'
  },
  {
    key: 'purge',
    label: 'purge'
  },
  {
    key: 'preheat',
    label: 'preheat'
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
    key: 'config',
    label: 'config'
  },
  {
    key: 'exit',
    label: 'exit'
  }
];

export function QuickSettings(): JSX.Element {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const stats = useAppSelector((state) => state.stats);
  const { auto_preheat } = useAppSelector((state) => state.settings);
  const [preheatValue, setPreheatValue] = useState<string>('');
  const [settings, setSettings] = useState(defaultSettings);
  const presets = useAppSelector((state) => state.presets);
  const currentScreen = useAppSelector((state) => state.screen.value);
  const [counterESGG, setCounterESGG] = useState(0);

  useHandleGestures(
    {
      context() {
        setActiveIndex(0);
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: 'quick-settings'
          })
        );
      },
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        setCounterESGG(0);
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
        if (settings[activeIndex].key === 'exit') {
          setCounterESGG(counterESGG + 1);
        }
      },
      pressDown() {
        switch (settings[activeIndex].key) {
          case 'home': {
            socket.emit('action', 'home');
            dispatch(setScreen('pressets'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'edit': {
            dispatch(resetActiveSetting());
            dispatch(setScreen('pressetSettings'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'purge': {
            socket.emit('action', 'purge');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'preheat': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-preheat' })
            );
            break;
          }
          case 'calibrate': {
            socket.emit('calibrate', '');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'wifi': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'wifiSettings' })
            );
            break;
          }
          case 'config': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
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
    if (
      presets.option !== 'HOME' ||
      presets.activeIndexSwiper === presets.value.length
    ) {
      setSettings(defaultSettings.filter((item) => item.key !== 'edit'));
    } else {
      setSettings(defaultSettings);
    }
  }, [presets, currentScreen]);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    setPreheatValue(auto_preheat === 0 ? '' : `${auto_preheat}°C`);
  }, [auto_preheat]);

  useEffect(() => {
    if (counterESGG >= 20) {
      console.log('Easter Egg on');
      dispatch(setBubbleDisplay({ visible: false, component: null }));
      dispatch(setScreen('snake'));
    }
  }, [counterESGG]);

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
              {setting.label} {setting.key === 'preheat' && preheatValue}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
