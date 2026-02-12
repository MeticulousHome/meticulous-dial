import { useMemo, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { SettingsItem } from '../../../types';
import {
  useSettings,
  useUpdateSettings,
  useRootPassword
} from '../../../hooks/useSettings';
import { useManufacturingSchema } from '../../../hooks/useManufacturing';
import {
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';
import { IdleScreens } from '../../../components/Settings/Advanced/IdleScreenSetting';
import type { Settings } from '@meticulous-home/espresso-api';

const initialSettings: SettingsItem[] = [
  {
    key: 'usb_mode',
    label: 'USB mode',
    getLabel: (settings: Settings) => settings.usb_mode
  },
  {
    key: 'ssh_enabled',
    label: 'SSH',
    getLabel: (settings: Settings) =>
      settings.ssh_enabled ? 'ENABLED' : 'DISABLED'
  },
  {
    key: 'displayAlignment',
    label: 'Display Alignment Screen',
    visible: true
  },
  {
    key: 'telemetry_opt_in',
    label: 'Share debug motor data',
    getLabel: (settings: Settings) =>
      settings.allow_debug_sending ? 'ENABLED' : 'DISABLED',
    visible: true
  },
  {
    key: 'set_update_channel',
    label: 'Update channel',
    getLabel: (settings: Settings) => settings.update_channel,
    visible: true
  },
  {
    key: 'idle_screen',
    label: 'Select Idle Screen',
    getLabel: (settings: Settings) =>
      IdleScreens.find((item) => item.key === settings.idle_screen)?.shortLabel,
    visible: true
  },
  {
    key: 'root_password',
    label: 'ROOT PASSWORD',
    visible: true,
    caseSensitive: true
  },
  {
    key: 'factory_reset',
    label: 'Factory reset',
    visible: true,
    caseSensitive: false
  }
];

export const AdvancedSettings = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings, isSuccess: isSettingsSuccess } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { refetch: fetchDeviceStatus } = useDeviceInfo();
  const { data: rootPW } = useRootPassword();

  const { data: manufacturingSettings, isSuccess: isManufacturingSuccess } =
    useManufacturingSchema();

  const updatedSettings = useMemo(() => {
    if (!isSettingsSuccess) {
      return initialSettings.map((item) => ({
        ...item
      }));
    }
    const formattedInitialSettings = initialSettings.map((item) => ({
      ...item,
      label:
        item.key === 'root_password'
          ? `${item.label}: ${rootPW || '*****'}`
          : item.getLabel
            ? `${item.label}: ${item.getLabel(globalSettings)}`
            : item.label
    }));

    const manufacturingOption =
      manufacturingSettings != null
        ? {
            key: 'manufacturing',
            label: 'Manufacturing Options'
          }
        : manufacturingSettings;

    if (manufacturingOption) {
      return [
        ...formattedInitialSettings,
        manufacturingOption as SettingsItem,
        {
          key: 'back',
          label: 'Back',
          visible: true
        }
      ];
    }

    return [
      ...formattedInitialSettings,
      {
        key: 'back',
        label: 'Back',
        visible: true
      }
    ];
  }, [
    globalSettings,
    isManufacturingSuccess,
    isSettingsSuccess,
    manufacturingSettings,
    rootPW
  ]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, updatedSettings.length - 1)
        );
      },
      pressDown() {
        const activeItem = updatedSettings[activeIndex].key;
        switch (activeItem) {
          case 'device_info':
            fetchDeviceStatus();
            dispatch(
              setBubbleDisplay({ visible: true, component: 'deviceInfo' })
            );
            break;
          case 'ssh_enabled':
            updateSettings.mutate({
              ssh_enabled: !globalSettings.ssh_enabled
            });
            break;
          case 'telemetry_opt_in':
            updateSettings.mutate({
              allow_debug_sending: !globalSettings.allow_debug_sending
            });
            break;
          case 'set_update_channel':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'updateChannel' })
            );
            break;
          case 'idle_screen':
            dispatch(
              setBubbleDisplay({
                visible: true,
                component: 'idleScreenSettings'
              })
            );
            break;
          case 'factory_reset':
            dispatch(
              setBubbleDisplay({
                visible: true,
                component: 'factoryReset'
              })
            );
            break;
          case 'manufacturing':
            dispatch(
              setBubbleDisplay({
                visible: true,
                component: 'manufacturingSettings'
              })
            );
            break;
          case 'displayAlignment':
            dispatch(
              setBubbleDisplay({
                visible: false,
                component: null
              })
            );
            dispatch(setScreen('displayAlignment'));
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          default: {
            break;
          }
        }
      }
    },
    !bubbleDisplay.interceptsGesture
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {updatedSettings.map((option) => (
            <Styled.Option
              key={option.key}
              $caseSensitive={option.caseSensitive}
            >
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {updatedSettings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $isMarquee={
                  activeIndex === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
                $caseSensitive={option.caseSensitive}
              >
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
