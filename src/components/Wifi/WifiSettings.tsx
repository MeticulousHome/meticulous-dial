import { useEffect, useMemo, useState } from 'react';

import './wifiSettings.css';
import { useAppDispatch } from '../store/hooks';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useNetworkConfig, useUpdateNetworkConfig } from '../../hooks/useWifi';
import { APMode } from '@meticulous-home/espresso-api';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

export const WifiSettings = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const [networkConfigMode, setNetworkConfigMode] = useState<APMode>(
    APMode.CLIENT
  );

  const { data: networkConfig, error, isLoading, refetch } = useNetworkConfig();
  const updateNetworkConfigMutation = useUpdateNetworkConfig();

  useEffect(() => {
    refetch();
  }, [updateNetworkConfigMutation.status]);

  useEffect(() => {
    setNetworkConfigMode(networkConfig?.config.mode);
  }, [networkConfig]);

  const isWifiConnected = networkConfig?.status.connected;

  const isApMode = isWifiConnected && networkConfigMode === APMode.AP;

  const wifiSettingItems = useMemo(
    () => [
      {
        key: 'status',
        label: `Status: ${isWifiConnected ? 'CONNECTED' : 'NOT CONNECTED'}`,
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
    [isWifiConnected, isApMode, networkConfigMode]
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
        if (updateNetworkConfigMutation.isError || error) {
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
              ...networkConfig.config,
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
              setBubbleDisplay({ visible: true, component: 'connectWifiMenu' })
            );
            break;
          }
          default:
            break;
        }
      }
    },
    updateNetworkConfigMutation.isPending
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

  if (isLoading || updateNetworkConfigMutation.isPending) {
    return <LoadingScreen />;
  }

  if (updateNetworkConfigMutation.isError || error) {
    return (
      <div className="quick-settings">
        <div
          className={` deleted-response ${
            updateNetworkConfigMutation.isError ? 'error-entry' : ''
          }`}
        >
          {updateNetworkConfigMutation.isError
            ? 'An unknown error occured. Please try again'
            : 'Connection could not be verified, please check the connection details'}
        </div>
        <br />
        <div key="back" className={`settings-item active-setting deleted-item`}>
          <div className="settings-entry deleted-button">Ok</div>
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
