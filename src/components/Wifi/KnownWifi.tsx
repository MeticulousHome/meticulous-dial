import { useMemo, useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { selectWifiToDelete } from '../store/features/wifi/wifi-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { WifiIcon } from './WifiIcon';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { useNetworkConfig } from '../../hooks/useWifi';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

export const KnownWifi = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data, isLoading } = useNetworkConfig();

  const knownWifis = useMemo(() => {
    if (!data?.known_wifis) return [];

    const wifiSettings = Object.keys(data.known_wifis).map((ssid: string) => ({
      key: ssid,
      label: ssid
    }));
    return [...wifiSettings, ...[{ key: 'back', label: 'Back' }]];
  }, [data]);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, knownWifis.length - 1));
    },
    pressDown() {
      if (knownWifis[activeIndex].key === 'back') {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'wifiSettings' })
        );
      } else {
        dispatch(selectWifiToDelete(knownWifis[activeIndex].key));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'deleteKnowWifiMenu' })
        );
      }
    }
  });

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: knownWifis
      }),
    [activeIndex, knownWifis]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: knownWifis
      }),
    [activeIndex, knownWifis]
  );
  if (isLoading) {
    return <LoadingScreen />;
  }
  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {knownWifis.map((option, index) =>
            option.key === 'back' ? (
              <Styled.Option key={option.key}>
                <span>{option.label}</span>
              </Styled.Option>
            ) : (
              <Styled.NetworkOption key={option.key}>
                <span>
                  <WifiIcon level={Math.min(knownWifis.length - index, 4)} />
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
            {knownWifis.map((option, index) =>
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
                    <WifiIcon level={Math.min(knownWifis.length - index, 4)} />
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
