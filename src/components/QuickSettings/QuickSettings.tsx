import { useEffect, useMemo, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useSocket } from '../store/SocketManager';

import {
  deletePreset,
  resetActiveSetting,
  setDefaultProfileSelected,
  setOptionPressets,
  discardSettings
} from '../store/features/preset/preset-slice';
import { useOSStatus } from '../../hooks/useDeviceOSStatus';
import { routes } from '../../navigation/routes';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { formatTime } from '../../utils';

export type QuickSettingOption = {
  key: string;
  label: string;
  longpress?: boolean;
  hasSeparator?: boolean;
  isStatusInfo?: boolean;
  status?: string;
};

const profileContextSettings: QuickSettingOption[] = [
  {
    key: 'edit',
    label: 'Edit profile'
  },
  {
    key: 'delete',
    label: 'Hold to delete profile',
    longpress: true,
    hasSeparator: true
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
    hasSeparator: true
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
  const [activeOption, setActiveOption] = useState(0);

  useEffect(() => {
    setActiveOption(osStatusVisible ? 1 : 0);
  }, [osStatusVisible]);

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
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: !bubbleDisplay.visible ? 'quick-settings' : null
          })
        );
      },
      left() {
        const minIndex = osStatusVisible ? 1 : 0;
        setActiveOption((prev) => Math.max(prev - 1, minIndex));
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
        if (settings[activeOption].longpress) {
          setHoldAnimation('running');
          return;
        }
        switch (settings[activeOption].key) {
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
            console.log('home');
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
          case 'calibrate': {
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            dispatch(setScreen('calibrateScale'));
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
      ? {
          key: 'os_update',
          label: osStatusInfo,
          isStatusInfo: true,
          status: osStatusData.status.toLowerCase()
        }
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
      dispatch(setBubbleDisplay({ visible: false, component: null }));
      dispatch(setScreen('snake'));
    }
  }, [counterESGG]);

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeOption,
        settings
      }),
    [activeOption, settings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeOption,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings
      }),
    [activeOption, settings]
  );

  const preheatTimer = useMemo(
    () =>
      PreheatTimeLeft > 0
        ? `Stop preheat ${formatTime(PreheatTimeLeft)}`
        : 'Preheat brew chamber',
    [PreheatTimeLeft]
  );
  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer
          $translateY={optionPositionOutter}
          $bringToFront={holdAnimation === 'running'}
        >
          {settings.map((option) =>
            option.key === 'os_update' ? (
              <Styled.OsStatusOption
                key={option.key}
                $status={option.status}
                $hasSeparator={option.hasSeparator}
              >
                <span>{option.label}</span>
              </Styled.OsStatusOption>
            ) : (
              <Styled.Option
                key={option.key}
                $hasSeparator={option.hasSeparator}
                $isAnimating={holdAnimation === 'running' && option.longpress}
                onAnimationEnd={handleAnimationEnd}
              >
                <span>
                  {option.key === 'preheat' ? preheatTimer : option.label}
                </span>
              </Styled.Option>
            )
          )}
        </Styled.OptionsContainer>

        <Styled.ActiveIndicator $holdAnimation={holdAnimation}>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {settings.map((option, index) =>
              option.key === 'os_update' ? (
                <Styled.OsStatusOption
                  key={option.key}
                  $status={option.status}
                  $hasSeparator={option.hasSeparator}
                >
                  <span>{option.label}</span>
                </Styled.OsStatusOption>
              ) : (
                <Styled.Option
                  key={option.key}
                  $hasSeparator={option.hasSeparator}
                  $isMarquee={
                    activeOption === index &&
                    option.label.length > MARQUEE_MIN_TEXT_LENGTH
                  }
                  onAnimationEnd={() =>
                    console.log('Termino la animacion Option::Inner ❌')
                  }
                >
                  <span>
                    {option.key === 'preheat' ? preheatTimer : option.label}
                  </span>
                </Styled.Option>
              )
            )}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
}
