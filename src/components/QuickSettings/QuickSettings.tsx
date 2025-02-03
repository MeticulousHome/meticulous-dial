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
  setOptionPressets,
  discardSettings
} from '../store/features/preset/preset-slice';

import { useOSStatus } from '../../hooks/useDeviceOSStatus';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { formatTime } from '../../utils';
import { routes } from '../../navigation/routes';

interface QuickSettingOption {
  key: string;
  label: string;
  longpress?: boolean;
  seperator_after?: boolean;
}

const profileContextSettings: QuickSettingOption[] = [
  {
    key: 'edit',
    label: 'Edit profile'
  },
  {
    key: 'delete',
    label: 'Hold to delete profile',
    longpress: true,
    seperator_after: true
  }
];

const prevScreenSetting: QuickSettingOption = {
  key: 'prevScreen',
  label: 'Back'
};

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
    label: 'Preheat brew chamber'
  },
  {
    key: 'brew_config',
    label: 'Brew Settings',
    seperator_after: true
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
  const waitingForActionAlreadySent = useAppSelector(
    (state) => state.stats.waitingForActionAlreadySent
  );
  const PreheatTimeLeft = useAppSelector(
    (state) => state.stats.preheatTimeLeft
  );
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
        return `Downloading Update: ${Math.round(osStatusData.progress)}%`;
      case 'INSTALLING':
        return `Installing Update: ${Math.round(osStatusData.progress)}%`;
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
        setActiveIndex(1);
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
          case 'prevScreen': {
            if (!routes[currentScreen].parent) {
              console.error("return to previous screen doesn't exist");
              break;
            }

            if (currentScreen === 'pressetSettings')
              dispatch(discardSettings());

            dispatch(setScreen(routes[currentScreen].parent));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
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
            socket.emit('action', 'preheat');
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
          case 'brew_config': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'brewSettings' })
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
    !bubbleDisplay.visible || waitingForActionAlreadySent
  );

  useEffect(() => {
    const context: QuickSettingOption[] = profileContextSettings;

    const requiresProfileContext: boolean =
      !(
        presets.value.length === 0 ||
        presets.activeIndexSwiper === presets.value.length ||
        (presets.option !== 'HOME' && presets.option !== 'PRESSETS')
      ) && currentScreen === 'pressets';

    const backAvailable = !!routes[currentScreen].parent;

    const osStatusSettingOption: QuickSettingOption = {
      key: 'os_update',
      label: osStatusInfo
    };

    switch (currentScreen) {
      case 'defaultProfiles':
        setSettings([
          osStatusSettingOption,
          ...[{ key: 'details', label: 'Show details' }],
          ...(backAvailable ? [prevScreenSetting] : []),
          ...defaultSettings
        ]);
        break;
      default:
        setSettings([
          osStatusSettingOption,
          ...(requiresProfileContext === true ? context : []),
          ...(backAvailable ? [prevScreenSetting] : []),
          ...defaultSettings
        ]);
        break;
    }
  }, [
    presets.value.length,
    presets.activeIndexSwiper,
    presets.option,
    currentScreen,
    osStatusInfo
  ]);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    if (counterESGG >= 20) {
      console.log('Easter Egg on');
      dispatch(setBubbleDisplay({ visible: false, component: null }));
      dispatch(setScreen('snake'));
    }
  }, [counterESGG]);

  const getSettingClasses = useCallback(
    (isActive: boolean, key: string) => {
      return `
      settings-item ${isActive ? 'active-setting' : ''}
      ${isActive && holdAnimation === 'running' ? 'animated-setting' : ''}
      ${key === 'os_update' ? `os-info-${osStatusData.status.toLowerCase()}` : ''}
      `;
    },
    [holdAnimation, osStatusData]
  );

  return (
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={16}
        autoHeight={false}
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        {settings.map((setting, index: number) => {
          const isActive = index === activeIndex;
          if (setting.key === 'os_update' && !osStatusVisible) {
            return <></>;
          }
          return (
            <div key={`option-${index}-${setting.key}`}>
              <SwiperSlide
                className={getSettingClasses(isActive, setting.key)}
                key={`option-${index}-${setting.key}`}
                onAnimationEnd={handleAnimationEnd}
              >
                <div className="text-container">
                  {marqueeIfNeeded({
                    enabled: isActive,
                    val:
                      setting.key === 'preheat'
                        ? PreheatTimeLeft > 0
                          ? `Stop preheat ${formatTime(PreheatTimeLeft)}`
                          : 'Preheat brew chamber'
                        : setting.label
                  })}
                </div>
              </SwiperSlide>

              {setting.seperator_after && (
                <SwiperSlide
                  key={`seperator-${index}`}
                  className="separator"
                ></SwiperSlide>
              )}
            </div>
          );
        })}
      </Swiper>
    </div>
  );
}
