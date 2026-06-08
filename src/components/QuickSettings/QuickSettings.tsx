import { useEffect, useMemo, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useUpdateSettings } from '../../hooks/useSettings';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  ScreenType,
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useContinueBrewAction, useSocket } from '../store/SocketManager';

import { useOSStatus, useDeviceInfo } from '../../hooks/useDeviceOSStatus';
import { routes } from '../../navigation/routes';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH,
  MenuAnnotation,
  ITEM_HEIGHT,
  ITEM_MARGIN
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { useProfileContext } from '../../context/ProfileContext';
import { useDeletePreset } from '../../hooks/useProfiles';
import { addSettingsToProfile } from '../../utils/profiles';
import { useIdleTimer } from '../../hooks/useIdleTimer';

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
    key: 'last_shot',
    label: 'Last shot'
  },
  {
    key: 'delete',
    label: 'Delete profile',
    longpress: true,
    hasSeparator: true
  }
];

const prevScreenSetting: QuickSettingOption = {
  key: 'prevScreen',
  label: 'Back',
  hasSeparator: true
};

const defaultSettings: QuickSettingOption[] = [
  {
    key: 'sleep',
    label: 'sleep'
  },
  {
    key: 'raise',
    label: 'raise'
  },
  {
    key: 'purge',
    label: 'purge'
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
    key: 'bug_report',
    label: 'Report an issue'
  },
  {
    key: 'exit',
    label: 'exit'
  }
];

const inBrewSettings: QuickSettingOption[] = [
  {
    key: 'skip_step',
    label: 'Skip this step'
  },
  {
    key: 'abort_brew',
    label: 'Abort Brew',
    longpress: true,
    hasSeparator: true
  },
  {
    key: 'config',
    label: 'config'
  },
  {
    key: 'bug_report',
    label: 'Report an issue'
  },
  {
    key: 'exit',
    label: 'exit'
  }
];

export type holdAnimationState = 'stopped' | 'running' | 'finished';

export function QuickSettings(): JSX.Element {
  const socket = useSocket();
  const skipStep = useContinueBrewAction();
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const updateSettings = useUpdateSettings();

  const [settings, setSettings] = useState(defaultSettings);

  const {
    profileQuery: { data: profiles },
    localProfile,
    detailProfileSelected: defaultProfileSelectedForDetails,
    setSettingsIndex: setProfileSettingsIndex,
    setSettingsProfile: setProfileSettings
  } = useProfileContext();
  const deletePresetMutation = useDeletePreset();
  const currentScreen = useAppSelector((state) => state.screen.value);
  const statsName = useAppSelector((state) => state.stats.name);

  const [counterESGG, setCounterESGG] = useState(0);
  const [holdAnimation, setHoldAnimation] =
    useState<holdAnimationState>('stopped');

  const { forceIdle } = useIdleTimer();

  const { data: deviceInfo, isPending } = useDeviceInfo();
  const { data: osStatusData, error: osStatusError } = useOSStatus();

  const HIDDEN_OS_STATUS_SCREENS: ScreenType[] = [
    'heating',
    'brewComplete',
    'barometer'
  ];

  const osStatusVisible =
    osStatusData.status !== 'IDLE' &&
    !HIDDEN_OS_STATUS_SCREENS.includes(currentScreen);
  const [activeOption, setActiveOption] = useState(0);

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
      case 'FAILED':
        return `Update Failed: ${osStatusData.info}%`;
    }
    return '';
  }, [osStatusData, osStatusError]);

  const handleAnimationEnd = () => {
    setHoldAnimation('finished');
    if (localProfile?.temporary) return; //To prevent deleting an existing profile based on a temporary profile that has modifications.
    switch (settings[activeOption].key) {
      case 'delete': {
        deletePresetMutation.mutate(localProfile?.id);
        dispatch(setScreen('profileHome'));
        dispatch(setBubbleDisplay({ visible: false, component: undefined }));
        break;
      }
      case 'abort_brew': {
        socket.emit('action', 'abort');
        dispatch(setBubbleDisplay({ visible: false, component: undefined }));
        break;
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
          dispatch(setScreen('profileHome'));
          dispatch(setBubbleDisplay({ visible: false, component: undefined }));
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

            dispatch(setScreen(routes[currentScreen].parent));
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          case 'sleep': {
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            forceIdle();
            break;
          }
          case 'raise': {
            socket.emit('action', 'home');
            console.log('raise/home');
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          case 'details': {
            dispatch(setScreen('defaultProfileDetails'));
            break;
          }
          case 'disable_ui_features': {
            updateSettings.mutate({
              disable_ui_features: true
            });
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          case 'edit': {
            if (!localProfile) {
              console.error('No profile selected');
              break;
            }
            setProfileSettingsIndex(0);
            setProfileSettings(addSettingsToProfile(localProfile));
            dispatch(setScreen('pressetSettings'));
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          case 'last_shot': {
            dispatch(setScreen('shot_history'));
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          case 'purge': {
            socket.emit('action', 'purge');
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          case 'calibrate': {
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
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
          case 'bug_report': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'bug-report' })
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
            setTimeout(() => {
              setBubbleDisplay({
                visible: false,
                component: undefined,
                interceptsGesture: false
              });
            }, 100);

            dispatch(
              setBubbleDisplay({
                visible: false,
                component: undefined,
                interceptsGesture: true
              })
            );
            break;
          }

          // In Brew Settings
          case 'skip_step': {
            skipStep();
            dispatch(
              setBubbleDisplay({
                visible: false,
                component: undefined
              })
            );
            break;
          }
          // abort_brew is a longpress option
        }
      }
    },
    !bubbleDisplay.interceptsGesture
  );

  const requiresProfileContext: boolean =
    profiles?.length > 0 && currentScreen === 'profileHome';

  useEffect(() => {
    const context: QuickSettingOption[] = profileContextSettings;

    const backAvailable = !!routes[currentScreen].parent;

    switch (currentScreen) {
      case 'defaultProfiles':
        setSettings([
          ...(defaultProfileSelectedForDetails
            ? [{ key: 'details', label: 'Show details' }]
            : []),
          ...(backAvailable ? [prevScreenSetting] : []),
          ...defaultSettings
        ]);
        break;
      case 'heating':
      case 'brewComplete':
        if (statsName === 'idle') {
          setSettings(defaultSettings);
        } else {
          setSettings(inBrewSettings);
        }
        break;
      case 'barometer':
        setSettings(inBrewSettings);
        break;
      default:
        {
          const newContext = localProfile?.temporary
            ? context.filter((c) => c.key !== 'delete')
            : context;
          setSettings([
            ...(requiresProfileContext ? newContext : []),
            ...(backAvailable ? [prevScreenSetting] : []),
            ...defaultSettings
          ]);
        }
        break;
    }
  }, [currentScreen, osStatusInfo, osStatusVisible]);

  useEffect(() => {
    if (counterESGG >= 20) {
      dispatch(setBubbleDisplay({ visible: false, component: undefined }));
      dispatch(setScreen('snake'));
    }
  }, [counterESGG]);

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeOption,
        adjustmentFn: (position) =>
          osStatusVisible ? position - (ITEM_HEIGHT + ITEM_MARGIN) : position,
        settings
      }),
    [activeOption, settings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeOption,
        adjustmentFn: (position) =>
          osStatusVisible
            ? position - (ITEM_HEIGHT + ITEM_MARGIN + VIEWPORT_HEIGHT / 2)
            : position - VIEWPORT_HEIGHT / 2,
        settings
      }),
    [activeOption, settings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport className="Viewport">
        <Styled.OptionsContainer
          $translateY={optionPositionOutter}
          $bringToFront={holdAnimation === 'running'}
          $osStatus={osStatusVisible ? osStatusData.status.toLowerCase() : null}
          $osInfo={osStatusVisible ? osStatusInfo : null}
          $SWVersion={`${!isPending ? deviceInfo.image_version : 'loading ...'}`}
        >
          {settings.map((option) => (
            <Styled.Option
              key={option.key}
              $hasSeparator={option.hasSeparator}
              $isAnimating={holdAnimation === 'running' && option.longpress}
              onAnimationEnd={handleAnimationEnd}
            >
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>

        <Styled.ActiveIndicator $holdAnimation={holdAnimation}>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
            $osStatus={
              osStatusVisible ? osStatusData.status.toLowerCase() : null
            }
            $osInfo={osStatusVisible ? osStatusInfo : null}
          >
            {settings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $hasSeparator={option.hasSeparator}
                $isMarquee={
                  activeOption === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
                $isMultiItem={option.longpress}
              >
                <span>{option.label}</span>
                {option.longpress && <MenuAnnotation>HOLD</MenuAnnotation>}
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
}
