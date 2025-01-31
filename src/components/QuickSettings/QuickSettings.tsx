import { useCallback, useEffect, useMemo, useState } from 'react';

import './quick-settings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';
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
import * as Styled from './QuickSettings.styled';

import {
  calculateOptionPosition,
  VIEWPORT_HEIGHT
} from './QuickSettings.utils';

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
    label: 'Preheat brew chamber with long text'
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

  const [activeOption, setActiveOption] = useState(0);

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
    console.log('Termino la animacion ✔');
    switch (settings[activeOption].key) {
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
        setActiveOption((prev) => Math.max(prev - 1, 0));
        setCounterESGG(0);
      },
      right() {
        setActiveOption((prev) => Math.min(prev + 1, settings.length - 1));
        if (settings[activeOption].key === 'exit') {
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
        console.log('activeOption', activeOption);
        console.log('settings[activeOption]', settings[activeOption]);

        if (settings[activeOption].longpress) {
          console.log("we're on longpress?"); //✔
          setHoldAnimation('running');
          return;
        }
        switch (settings[activeOption].key) {
          case 'prevScreen': {
            if (!routes[currentScreen].parent) {
              console.error("return to previous screen doesn't exist");
              break;
            }
            //✔
            if (currentScreen === 'pressetSettings')
              dispatch(discardSettings());

            dispatch(setScreen(routes[currentScreen].parent));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'home': {
            //✔
            socket.emit('action', 'home');
            console.log('home');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'details': {
            //✔
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
            //✔
            dispatch(resetActiveSetting());
            dispatch(setScreen('pressetSettings'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'purge': {
            //✔
            socket.emit('action', 'purge');
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
          case 'preheat': {
            //❌
            socket.emit('action', 'preheat');
            break;
          }
          case 'calibrate': {
            //✔
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            dispatch(setScreen('calibrateScale'));
            break;
          }
          case 'wifi': {
            //✔
            dispatch(
              setBubbleDisplay({ visible: true, component: 'wifiSettings' })
            );
            break;
          }
          case 'config': {
            //✔
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
            //✔
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible || waitingForActionAlreadySent
  );

  const requiresProfileContext: boolean =
    !(
      presets.value.length === 0 ||
      presets.activeIndexSwiper === presets.value.length ||
      (presets.option !== 'HOME' && presets.option !== 'PRESSETS')
    ) && currentScreen === 'pressets';

  useEffect(() => {
    const context: QuickSettingOption[] = profileContextSettings;

    const backAvailable = !!routes[currentScreen].parent;

    const osStatusSettingOption: QuickSettingOption | null = osStatusVisible
      ? { key: 'os_update', label: osStatusInfo }
      : null;

    switch (currentScreen) {
      case 'defaultProfiles':
        setSettings([
          ...(osStatusSettingOption ? [osStatusSettingOption] : []),
          ...[{ key: 'details', label: 'Show details' }],
          ...(backAvailable ? [prevScreenSetting] : []),
          ...defaultSettings
        ]);
        break;
      default:
        setSettings([
          ...(osStatusSettingOption ? [osStatusSettingOption] : []),
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
    osStatusInfo,
    osStatusVisible
  ]);

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

  const lastProfileContextIndex = useMemo(() => {
    const profileKeys = profileContextSettings.map((opt) => opt.key);
    const indices = settings
      .map((opt, index) => (profileKeys.includes(opt.key) ? index : -1))
      .filter((idx) => idx !== -1);
    return indices.length > 0 ? Math.max(...indices) : -1;
  }, [settings]);

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeOption,
        lastProfileContextIndex: lastProfileContextIndex
      }),
    [activeOption]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeOption,
        lastProfileContextIndex: lastProfileContextIndex,
        adjustmentFn: (position: number) => position - VIEWPORT_HEIGHT / 2
      }),
    [activeOption]
  );

  return (
    <Styled.QuickSettingsContainer>
      {/* <Swiper
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
          const isActive = index === activeIndex; // ---> 👁‍🗨
          if (setting.key === 'os_update' && !osStatusVisible) {
            return <></>;
          }
          return (
            <div key={`option-${index}-${setting.key}`}>
              <SwiperSlide
                className={getSettingClasses(isActive, setting.key)} //<<<<<<< Verify this
                key={`option-${index}-${setting.key}`}
                onAnimationEnd={handleAnimationEnd} //<<<<<<< Verify this
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
      </Swiper> */}
      <Styled.Viewport>
        <Styled.OptionsContainer
          translateY={optionPositionOutter}
          bringToFront={holdAnimation === 'running'}
        >
          {settings.map((option, index) => {
            const isLastProfileContext = index === lastProfileContextIndex;
            return (
              <Styled.Option
                key={option.key}
                isLastProfileContext={isLastProfileContext}
                isAnimating={holdAnimation === 'running' && option.longpress}
                onAnimationEnd={handleAnimationEnd}
              >
                <span>{option.label}</span>
              </Styled.Option>
            );
          })}
        </Styled.OptionsContainer>

        <Styled.ActiveIndicator holdAnimation={holdAnimation}>
          <Styled.OptionsContainer
            translateY={optionPositionInner}
            isInner={true}
          >
            {settings.map((option, index) => {
              const isLastProfileContext = index === lastProfileContextIndex;
              return (
                <Styled.Option
                  key={option.key}
                  isLastProfileContext={isLastProfileContext}
                  isMarquee={activeOption === index && option.label.length > 24}
                  onAnimationEnd={() =>
                    console.log('Termino la animacion Option::Inner ❌')
                  }
                >
                  <span>{option.label}</span>
                </Styled.Option>
              );
            })}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.QuickSettingsContainer>
  );
}
