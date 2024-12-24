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
import { styled } from 'styled-components';

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

type Option = {
  key: string;
  label: string;
  longpress?: boolean;
};

type Styles = {
  [key: string]: React.CSSProperties;
};

const styles: Styles = {
  wrapper: {
    width: '480px',
    height: '480px',
    backgroundColor: '#1d1d1d',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  button: {
    width: '100%',
    height: '48px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: 'none',
    backgroundColor: '#1d1d1d',
    cursor: 'pointer'
  },
  buttonUp: {
    borderBottom: '1px solid #333333'
  },
  buttonDown: {
    borderTop: '1px solid #333333'
  },
  buttonDisabled: {
    color: '#666666',
    cursor: 'not-allowed'
  },
  buttonEnabled: {
    color: '#f5c444'
  },
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1d1d1d',
    height: '480px',
    paddingLeft: '28px'
  },

  optionContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%'
    /*  paddingLeft: "22px", */
  },
  label: {
    fontSize: '22px',
    letterSpacing: '1.3px'
  },
  holdText: {
    fontSize: '12px',
    textTransform: 'none',
    letterSpacing: 'normal'
  },

  optionDark: {
    color: '#1d1d1d',
    pointerEvents: 'none'
  },

  /** aproved C:*/
  option: {
    textTransform: 'uppercase',
    borderRadius: '4px',
    fontSize: '22px',
    color: '#dddddd',
    textAlign: 'left',
    width: '90%',
    letterSpacing: '1.3px',
    whiteSpace: 'nowrap',
    marginBottom: '25px',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    height: '38px', //this should't be a fixed value
    paddingLeft: '18px'
    /* fontFamily: 'Abc_mono' */
  }
};

const OptionsContainer = styled.div<{ translateY: number; isInner?: boolean }>`
  position: absolute;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Abc_mono';
  transform: ${(props) =>
    props.isInner
      ? `translate(-50%, 0) translateY(${props.translateY}px)`
      : `translateY(${props.translateY}px)`};

  ${(props) =>
    props.isInner &&
    `color: #1d1d1d;
     top: 50%;
     left: 50%;
    `}
`;

const OptionsList = ({
  options,
  translateY,
  isInner,
  isDark = false
}: {
  options: Option[];
  translateY: number;
  isInner?: boolean;
  isDark?: boolean;
}) => (
  <OptionsContainer translateY={translateY} isInner={isInner}>
    {options.map((option) => (
      <div
        key={option.key}
        className={`${option.key === 'delete' ? 'option-delete' : ''}`}
        style={{
          ...styles.option,
          ...(isDark ? styles.optionDark : {})
        }}
      >
        <div style={styles.optionContent}>
          <span style={styles.label}>{option.label}</span>
        </div>
      </div>
    ))}
  </OptionsContainer>
);

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
  const ITEM_HEIGHT = 38;
  const ITEM_MARGIN = 25;
  const EXTRA_MARGIN_AFTER_DELETE = 10;
  const VIEWPORT_HEIGHT = 480; // altura del viewport (contenedor principal)

  // Calcula la posición para el OptionsList blanco
  const calculatePosition = (activeOption: number) => {
    const halfContainer = VIEWPORT_HEIGHT / 2;
    const halfItem = ITEM_HEIGHT / 2;
    let totalOffset = activeOption * (ITEM_HEIGHT + ITEM_MARGIN);

    if (activeOption > 1) {
      totalOffset += EXTRA_MARGIN_AFTER_DELETE;
    }

    return halfContainer - totalOffset - halfItem;
  };

  // Calcula la posición para el texto negro dentro del active-indicator
  const calculateDarkTextPosition = (activeOption: number) => {
    // Calculamos la posición igual que el texto blanco
    const halfContainer = VIEWPORT_HEIGHT / 2;
    const halfItem = ITEM_HEIGHT / 2;
    let totalOffset = activeOption * (ITEM_HEIGHT + ITEM_MARGIN);

    if (activeOption > 1) {
      totalOffset += EXTRA_MARGIN_AFTER_DELETE;
    }

    // Ajustamos por el translate(-50%, -50%) del contenedor padre
    const position = halfContainer - totalOffset - halfItem;
    const heightCompensation = VIEWPORT_HEIGHT / 2;

    return position - heightCompensation;
  };

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
    switch (
      settings[activeIndex].key //<<<<<<< Verify this
    ) {
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
        /* setActiveOption((prev) => {
          console.log('Math.max(prev - 1, 0)', Math.max(prev - 1, 0));
          return Math.max(prev - 1, 1);
        }); */
        setActiveOption((prev) => (prev > 0 ? prev - 1 : prev));
        setCounterESGG(0);
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
        //setActiveOption((prev) => Math.min(prev + 1, menuOptions.length - 1));
        setActiveOption((prev) =>
          prev < settings.length - 1 ? prev + 1 : prev
        );
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
          console.log("we're on longpress?");
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
          /* osStatusSettingOption, */
          ...[{ key: 'details', label: 'Show details' }],
          ...(backAvailable ? [prevScreenSetting] : []),
          ...defaultSettings
        ]);
        break;
      default:
        setSettings([
          /* osStatusSettingOption, */
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
      swiper.slideTo(activeIndex, 0, false); //<<<<<<<<< Verify this
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
          const isActive = index === activeIndex;
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

      <div style={styles.viewport}>
        <OptionsList
          options={settings}
          translateY={calculatePosition(activeOption)}
        />

        <div className="active-indicator">
          <OptionsList
            options={settings}
            translateY={calculateDarkTextPosition(activeOption)}
            isInner={true}
            isDark={true}
          />
        </div>
      </div>
    </div>
  );
}
