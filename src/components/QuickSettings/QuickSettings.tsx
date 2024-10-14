import { useCallback, useEffect, useMemo, useState } from 'react';

import './quick-settings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../OSStatus/OSStatus.css';

import {
  deletePreset,
  resetActiveSetting,
  setDefaultProfileSelected,
  setOptionPressets
} from '../store/features/preset/preset-slice';

import { useOSStatus } from '../../hooks/useOSStatus';

interface QuickSettingOption {
  key: string;
  label: string;
  longpress?: boolean;
}

const profileContextSettings: QuickSettingOption[] = [
  {
    key: 'os_update',
    label: 'test'
  },
  {
    key: 'edit',
    label: 'Edit profile'
  },
  {
    key: 'delete',
    label: 'Hold to delete profile',
    longpress: true
  }
];

const defaultSettings: QuickSettingOption[] = [
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

type holdAnimationState = 'stopped' | 'running' | 'finished';

export function QuickSettings(): JSX.Element {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const {
    defaultProfilesInfo: { defaultProfileActiveIndexSwiper, defaultProfiles }
  } = useAppSelector((state) => state.presets);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(1);
  const stats = useAppSelector((state) => state.stats);
  const { auto_preheat } = useAppSelector((state) => state.settings);
  const [preheatValue, setPreheatValue] = useState<string>('');
  const [settings, setSettings] = useState(defaultSettings);

  const presets = useAppSelector((state) => state.presets);
  const currentScreen = useAppSelector((state) => state.screen.value);
  const [counterESGG, setCounterESGG] = useState(0);
  const [holdAnimation, setHoldAnimation] =
    useState<holdAnimationState>('stopped');

  const { data: osStatusData, error: osStatusError } = useOSStatus();
  const osStatusVisible = osStatusData.status !== 'IDLE';
  const osStatusInfo = useMemo(() => {
    if (osStatusError) {
      return '';
    }
    switch (osStatusData.status) {
      case 'COMPLETE':
        return 'Update Complete';
      case 'DOWNLOADING':
        return `Downloading Update: ${osStatusData.progress}%`;
      case 'INSTALLING':
        return `Installing Update: ${osStatusData.progress}%`;
    }
    return '';
  }, [osStatusData, osStatusError]);

  const handleAnimationEnd = () => {
    setHoldAnimation('finished');
    switch (settings[activeIndex].key) {
      case 'delete': {
        dispatch(deletePreset());
        dispatch(setScreen('pressets'));
        dispatch(setOptionPressets('PRESSETS'));
        dispatch(setBubbleDisplay({ visible: false, component: null }));
      }
    }
  };

  useHandleGestures(
    {
      context() {
        setActiveIndex(0);
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: !bubbleDisplay.visible ? 'quick-settings' : null
          })
        );
      },
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 1));
        setCounterESGG(0);
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
        if (settings[activeIndex].key === 'exit') {
          setCounterESGG(counterESGG + 1);
        }
      },
      pressUp() {
        if (holdAnimation == 'finished') {
          dispatch(setScreen('pressets'));
          dispatch(setBubbleDisplay({ visible: false, component: null }));
        }
        setHoldAnimation('stopped');
      },
      pressDown() {
        if (settings[activeIndex].longpress) {
          setHoldAnimation('running');
          return;
        }
        switch (settings[activeIndex].key) {
          case 'home': {
            socket.emit('action', 'home');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'details': {
            dispatch(
              setDefaultProfileSelected(
                defaultProfiles[defaultProfileActiveIndexSwiper]
              )
            );
            dispatch(
              setBubbleDisplay({
                visible: true,
                component: 'defaultProfileDetails'
              })
            );
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

  const indexSeparator = useMemo(() => {
    const contextSettings = profileContextSettings;

    const contextItems = settings.filter((setting) =>
      contextSettings.map((cx) => cx.key).includes(setting.key)
    );

    return contextItems.length - 1;
  }, [settings.length]);

  useEffect(() => {
    if (
      presets.value.length === 0 ||
      presets.activeIndexSwiper === presets.value.length ||
      (presets.option !== 'HOME' && presets.option !== 'PRESSETS')
    ) {
      return;
    }

    const context: QuickSettingOption[] = profileContextSettings;

    switch (currentScreen) {
      case 'defaultProfiles':
        setSettings([
          ...[{ key: 'details', label: 'Show details' }],
          ...defaultSettings
        ]);
        break;
      default:
        setSettings([...context, ...defaultSettings]);
        break;
    }
  }, [
    presets.value.length,
    presets.activeIndexSwiper,
    presets.option,
    currentScreen
  ]);

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

  const getSettingClasses = useCallback(
    (isActive: boolean) => {
      return `settings-item ${isActive ? 'active-setting' : ''} ${
        isActive && holdAnimation === 'running' ? 'animated-setting' : ''
      }`;
    },
    [holdAnimation]
  );

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
          if (setting.key === 'os_update') {
            const SWIPER_SLIDE_OS_ELEMENT: JSX.Element = (
              <>
                <SwiperSlide
                  className={getSettingClasses(isActive)}
                  key={`default_option-${index}`}
                  onAnimationEnd={handleAnimationEnd}
                >
                  <span
                    className={`os-info-${osStatusData.status.toLowerCase()}`}
                  >
                    {info}
                  </span>
                </SwiperSlide>
              </>
            );

            return osStatusData.status === 'IDLE' ||
              osStatusData.status === 'FAILED'
              ? null
              : SWIPER_SLIDE_OS_ELEMENT;
          }
          return (
            <>
              <SwiperSlide
                className={getSettingClasses(isActive)}
                key={`default_option-${index}`}
                onAnimationEnd={handleAnimationEnd}
              >
                {setting.label} {setting.key === 'preheat' && preheatValue}
              </SwiperSlide>

              {indexSeparator === index && (
                <SwiperSlide key="seperator" className="separator" />
              )}
            </>
          );
        })}
      </Swiper>
    </div>
  );
}
