import { useMemo, useState } from 'react';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useRevokeAllPairedDevices } from '../../hooks/usePairedDevices';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

import '../Wifi/wifiResult.css';
import { useQueryClient } from '@tanstack/react-query';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

// 'cancel' first so the destructive option is never the default selection.
const items = [
  { key: 'cancel', label: 'cancel' },
  { key: 'revoke-all', label: 'remove all devices' }
];

export const RevokeAllConfirmMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const queryClient = useQueryClient();
  const revokeAllMutation = useRevokeAllPairedDevices(queryClient);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      if (revokeAllMutation.isError) {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'pairedDevices' })
        );
        return;
      }
      switch (items[activeIndex].key) {
        case 'revoke-all': {
          revokeAllMutation.mutate();
          break;
        }
        case 'cancel': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'pairedDevices' })
          );
          break;
        }
        default:
          break;
      }
    }
  });

  if (revokeAllMutation.isSuccess) {
    dispatch(setBubbleDisplay({ visible: true, component: 'pairedDevices' }));
  }

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: items
      }),
    [activeIndex]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: items
      }),
    [activeIndex]
  );

  if (revokeAllMutation.isPending) {
    return <LoadingScreen />;
  }

  if (revokeAllMutation.isError) {
    return (
      <div className="main-container response">
        <div className="connect-response-title error-entry">
          An error occured. Please try again
        </div>
        <div className="connect-response-message error-entry">
          {revokeAllMutation.failureReason?.message}
        </div>
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
