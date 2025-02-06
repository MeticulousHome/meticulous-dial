import { useMemo, useState } from 'react';
import './selectWifi.css';
import { WifiIcon } from './WifiIcon';
import { useAppDispatch } from '../store/hooks';
import { selectWifi } from '../store/features/wifi/wifi-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { WiFiNetwork } from '@meticulous-home/espresso-api';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAvailableWiFiList } from '../../hooks/useWifi';

import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

export const SelectWifi = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data, isLoading } = useAvailableWiFiList();

  const wifiList = useMemo(() => {
    if (!data) return [];

    const wifiList = data.map((wifi: WiFiNetwork) => ({
      key: wifi.ssid,
      label: wifi.ssid
    }));
    return [...wifiList, ...[{ key: 'back', label: 'Back' }]];
  }, [data, isLoading]);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, wifiList.length - 1));
    },
    pressDown() {
      if (wifiList[activeIndex].key === 'back') {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'connectWifiMenu' })
        );
      } else {
        dispatch(setBubbleDisplay({ visible: false, component: null }));
        dispatch(selectWifi(wifiList[activeIndex].key));
        dispatch(setScreen('enterWifiPassword'));
      }
    }
  });

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: wifiList
      }),
    [activeIndex, wifiList]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: wifiList
      }),
    [activeIndex, wifiList]
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {wifiList.map((option, index) =>
            option.key === 'back' ? (
              <Styled.Option key={option.key}>
                <span>{option.label}</span>
              </Styled.Option>
            ) : (
              <Styled.NetworkOption key={option.key}>
                <span>
                  <WifiIcon level={Math.min(wifiList.length - index, 4)} />
                  {option.label}
                </span>
              </Styled.NetworkOption>
            )
          )}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {wifiList.map((option, index) =>
              option.key === 'back' ? (
                <Styled.Option key={option.key}>
                  <span>{option.label}</span>
                </Styled.Option>
              ) : (
                <Styled.NetworkOption
                  key={option.key}
                  $isMarquee={
                    activeIndex === index &&
                    option.label.length > MARQUEE_MIN_TEXT_LENGTH
                  }
                >
                  <span>
                    <WifiIcon level={Math.min(wifiList.length - index, 4)} />
                    {option.label}
                  </span>
                </Styled.NetworkOption>
              )
            )}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
