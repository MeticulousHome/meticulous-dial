import { useMemo, useState } from 'react';

import './connectWifiMenu.css';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

const items = [
  { key: 'connect-via-app', label: 'Connect via APP' },
  { key: 'choose-wifi', label: 'Connect to a network' },
  { key: 'back', label: 'Back' }
];

export const ConnectWifiMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'connect-via-app': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'connectWifiViaApp' })
          );
          break;
        }
        case 'choose-wifi': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'selectWifi' })
          );
          break;
        }
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

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: items
      }),
    [activeIndex, items]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: items
      }),
    [activeIndex, items]
  );
  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {items.map((option) => (
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
            {items.map((option) => (
              <Styled.Option key={option.key}>
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
