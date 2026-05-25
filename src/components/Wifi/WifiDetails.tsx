import { useEffect, useMemo, useState } from 'react';

import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import './wifiDetails.css';
import { useNetworkConfig } from '../../hooks/useWifi';
import {
  getWifiHealthMessage,
  getWifiHealthStatusLabel,
  getWifiRecoveryMessage
} from './wifiHealthMessages';

const initialWifiItems = [
  { key: 'network', label: 'NETWORK' },
  { key: 'hostname', label: 'HOSTNAME' },
  { key: 'ap_name', label: 'AP NAME' },
  { key: 'ap_password', label: 'AP PASSWORD' },
  { key: 'ips', label: 'IP' },
  { key: 'mac', label: 'MAC' },
  { key: 'health', label: 'HEALTH' },
  { key: 'gateway', label: 'GATEWAY' },
  { key: 'dns', label: 'DNS' },
  { key: 'internet', label: 'INTERNET' },
  { key: 'last_error', label: 'LAST ERROR' },
  { key: 'recovery', label: 'RECOVERY' },
  { key: 'back', label: 'Back' }
];

import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

export const WifiDetails = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);
  const dispatch = useAppDispatch();
  const { data, isLoading, isSuccess, refetch } = useNetworkConfig();
  const wifiStatus = data?.status;
  const networkConfig = data?.config;
  const wifiHealth = data?.health;

  useEffect(() => {
    const refetchInterval = setInterval(() => {
      refetch();
    }, 500);
    return () => clearInterval(refetchInterval);
  }, []);

  const wifiItems = useMemo(() => {
    if (!isSuccess || !data) return initialWifiItems;

    const valuesMap: Record<string, string> = {
      network: wifiStatus?.connection_name || '',
      hostname: wifiStatus?.hostname || '',
      ap_name: networkConfig?.apName || '',
      ap_password: networkConfig?.apPassword || '',
      ips: wifiStatus?.ips?.[0] || '',
      mac: wifiStatus?.mac || '',
      health: getWifiHealthStatusLabel(wifiHealth, wifiStatus?.connected),
      gateway: wifiHealth
        ? wifiHealth.gateway_reachable
          ? 'OK'
          : 'FAILED'
        : '',
      dns: wifiHealth ? (wifiHealth.dns_resolves ? 'OK' : 'FAILED') : '',
      internet: wifiHealth
        ? wifiHealth.internet_reachable
          ? 'OK'
          : 'FAILED'
        : '',
      last_error: getWifiHealthMessage(wifiHealth),
      recovery: getWifiRecoveryMessage(wifiHealth)
    };

    return initialWifiItems.map((item) =>
      item.key === 'back'
        ? item
        : {
            ...item,
            label: `${item.label}: ${valuesMap[item.key] || ''}`
          }
    );
  }, [wifiStatus, networkConfig, wifiHealth, isSuccess]);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, wifiItems.length - 1));
    },
    pressDown() {
      switch (wifiItems[activeIndex].key) {
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: 'wifiSettings' })
          );
          break;

        default:
          break;
      }
    }
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: wifiItems
      }),
    [activeIndex, wifiItems]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: wifiItems
      }),
    [activeIndex, wifiItems]
  );
  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {wifiItems.map((option) => (
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
            {wifiItems.map((option, index) => (
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
