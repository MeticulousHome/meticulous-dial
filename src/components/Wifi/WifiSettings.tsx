import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import './wifiSettings.css';
import { useAppDispatch } from '../store/hooks';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  useNetworkConfig,
  useRepairWiFi,
  useUpdateNetworkConfig
} from '../../hooks/useWifi';
import { APMode } from '@meticulous-home/espresso-api';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { getWifiHealthStatusLabel } from './wifiHealthMessages';

export const WifiSettings = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [networkConfigMode, setNetworkConfigMode] = useState<APMode>(
    APMode.CLIENT
  );

  const { data: networkConfig, error, isLoading, refetch } = useNetworkConfig();
  const updateNetworkConfigMutation = useUpdateNetworkConfig();
  const repairWiFiMutation = useRepairWiFi(queryClient);

  useEffect(() => {
    if (!networkConfig?.config.mode) {
      return;
    }
    setNetworkConfigMode(networkConfig?.config.mode);
  }, [networkConfig]);

  const isWifiConnected = networkConfig?.status.connected;
  const wifiHealth = networkConfig?.health;

  const isApMode = networkConfigMode === APMode.AP;
  const healthLabel = getWifiHealthStatusLabel(wifiHealth, isWifiConnected);
  const loadingState = isLoading
    ? 'loading'
    : updateNetworkConfigMutation.isPending
      ? `update-${networkConfigMode}`
      : repairWiFiMutation.isPending
        ? 'repair'
        : 'idle';
  const loadingMessages = useMemo(() => {
    if (loadingState === 'loading') {
      return ['Loading WiFi settings'];
    }

    if (loadingState === `update-${APMode.AP}`) {
      return [
        'Starting hotspot',
        'Trying WiFi channels',
        'Checking hotspot',
        'Keeping current WiFi safe'
      ];
    }

    if (loadingState === `update-${APMode.CLIENT}`) {
      return ['Joining WiFi mode', 'Checking connection', 'Updating WiFi'];
    }

    if (loadingState === 'repair') {
      return ['Checking WiFi', 'Trying recovery', 'Verifying connection'];
    }

    return [];
  }, [loadingState]);

  useEffect(() => {
    setLoadingMessageIndex(0);

    if (loadingMessages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex(
        (current) => (current + 1) % loadingMessages.length
      );
    }, 7000);

    return () => clearInterval(interval);
  }, [loadingMessages]);

  const wifiSettingItems = useMemo(
    () => [
      {
        key: 'status',
        label: `Status: ${healthLabel}`,
        visible: true
      },
      {
        key: 'qr_code',
        label: 'Show connection code',
        visible: isWifiConnected
      },
      {
        key: 'details',
        label: 'See network details',
        visible: true
      },
      {
        key: 'network_mode',
        label: `Wifi mode: ${isApMode ? 'Create standalone wifi' : 'Machine joins existing wifi'}`,
        visible: true
      },
      {
        key: 'known_wifis',
        label: 'Known Wifis',
        visible: true
      },
      {
        key: 'connect_new_network',
        label: 'Connect to a new network',
        visible: true
      },
      {
        key: 'repair',
        label: 'Repair WiFi',
        visible: true
      },
      {
        key: 'save',
        label: 'Save',
        visible: networkConfigMode !== networkConfig?.config.mode
      },
      {
        key: 'back',
        label: 'Back',
        visible: true
      }
    ],
    [healthLabel, isWifiConnected, isApMode, networkConfigMode]
  );

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(
            prev + 1,
            wifiSettingItems.filter((item) => item.visible).length - 1
          )
        );
      },
      pressDown() {
        // In case of error we go back
        if (
          updateNetworkConfigMutation.isError ||
          repairWiFiMutation.isError ||
          error
        ) {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'quick-settings' })
          );
        }
        const filter = wifiSettingItems.filter((item) => item.visible)[
          activeIndex
        ].key;
        switch (filter) {
          case 'network_mode': {
            const mode =
              networkConfigMode === APMode.AP ? APMode.CLIENT : APMode.AP;
            setNetworkConfigMode(mode);
            break;
          }
          case 'qr_code': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'wifiQrMenu' })
            );
            break;
          }
          case 'details': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'wifiDetails' })
            );
            break;
          }
          case 'save': {
            updateNetworkConfigMutation.mutate({
              ...networkConfig?.config,
              mode: networkConfigMode
            });
            setActiveIndex(0);
            break;
          }
          case 'known_wifis': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'KnownWifi' })
            );
            break;
          }
          case 'back': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
          }
          case 'connect_new_network': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'selectWifi' })
            );
            break;
          }
          case 'repair': {
            repairWiFiMutation.mutate(undefined, {
              onSuccess: () => {
                refetch();
              }
            });
            setActiveIndex(0);
            break;
          }
          default:
            break;
        }
      }
    },
    updateNetworkConfigMutation.isPending || repairWiFiMutation.isPending
  );
  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: wifiSettingItems
      }),
    [activeIndex, wifiSettingItems]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: wifiSettingItems
      }),
    [activeIndex, wifiSettingItems]
  );

  if (
    isLoading ||
    updateNetworkConfigMutation.isPending ||
    repairWiFiMutation.isPending
  ) {
    return <LoadingScreen message={loadingMessages[loadingMessageIndex]} />;
  }

  if (
    updateNetworkConfigMutation.isError ||
    repairWiFiMutation.isError ||
    error
  ) {
    const title = repairWiFiMutation.isError
      ? 'Network issue'
      : 'Could not update WiFi';
    const message = updateNetworkConfigMutation.isError
      ? updateNetworkConfigMutation.error?.message ||
        'Could not update WiFi. Please try again.'
      : repairWiFiMutation.isError
        ? repairWiFiMutation.error?.message ||
          'WiFi repair could not complete. Please check the network.'
        : 'Connection could not be verified. Please check the connection details.';

    return (
      <div className="main-container response">
        <div className="connect-response-title error-entry">{title}</div>
        <div className="connect-response-message error-entry">{message}</div>
        <div key="back" className="settings-item active-setting connect-item">
          <div className="settings-entry connect-button">Ok</div>
        </div>
      </div>
    );
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {wifiSettingItems
            .filter((item) => item.visible)
            .map((option) => (
              <Styled.Option key={option.key}>
                <span>{option.label}</span>
              </Styled.Option>
            ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {wifiSettingItems
              .filter((item) => item.visible)
              .map((option, index) => (
                <Styled.Option
                  key={option.key}
                  $isMarquee={
                    activeIndex === index &&
                    option.label.length > MARQUEE_MIN_TEXT_LENGTH
                  }
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
