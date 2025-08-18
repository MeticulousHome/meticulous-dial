import { useEffect, useMemo, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useContinueBrewAction, useSocket } from '../store/SocketManager';

import { useOSStatus } from '../../hooks/useDeviceOSStatus';
import { routes } from '../../navigation/routes';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH,
  MenuAnnotation
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { formatTime, hidden_ui_elements_enabled } from '../../utils';
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

const disable_ui_features: QuickSettingOption = {
  key: 'disable_ui_features',
  label: 'Magenta was refilled',
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
    key: 'preheat',
    label: ''
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

  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();

  const preheatTimeLeft = useAppSelector(
    (state) => state.stats.preheatTimeLeft
  );
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

  const [counterESGG, setCounterESGG] = useState(0);
  const [holdAnimation, setHoldAnimation] =
    useState<holdAnimationState>('stopped');

  const { forceIdle } = useIdleTimer();

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
          case 'preheat': {
            socket.emit('action', 'preheat');
            if (preheatTimeLeft <= 0) {
              dispatch(setScreen('preheatScreen'));
              dispatch(
                setBubbleDisplay({ visible: false, component: undefined })
              );
            }
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
          case 'brew_config': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'brewSettings' })
            );
            break;
          }

          case 'exit': {
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }

          // In Brew Settings
          case 'skip_step': {
            skipStep();
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          }
          // abort_brew is a longpress option
        }
      }
    },
    !bubbleDisplay.visible
  );

  const requiresProfileContext: boolean =
    profiles?.length > 0 && currentScreen === 'profileHome';

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
          ...(defaultProfileSelectedForDetails
            ? [{ key: 'details', label: 'Show details' }]
            : []),
          ...(backAvailable ? [prevScreenSetting] : []),
          ...(hidden_ui_elements_enabled(globalSettings)
            ? [disable_ui_features]
            : []),
          ...defaultSettings
        ]);
        break;
      case 'heating':
      case 'brewComplete':
      case 'barometer':
        setSettings(inBrewSettings);
        break;
      default:
        {
          const newContext = localProfile?.temporary
            ? context.filter((c) => c.key !== 'delete')
            : context;
          setSettings([
            ...(osStatusSettingOption ? [osStatusSettingOption] : []),
            ...(requiresProfileContext ? newContext : []),
            ...(backAvailable ? [prevScreenSetting] : []),
            ...(hidden_ui_elements_enabled(globalSettings)
              ? [disable_ui_features]
              : []),
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
      preheatTimeLeft > 0
        ? `Stop pre-heat ${formatTime(preheatTimeLeft)}`
        : 'Pre-heat',
    [preheatTimeLeft]
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
                  $isMultiItem={option.longpress}
                >
                  <span>
                    {option.key === 'preheat' ? preheatTimer : option.label}
                  </span>
                  {option.longpress && <MenuAnnotation>HOLD</MenuAnnotation>}
                </Styled.Option>
              )
            )}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
}
