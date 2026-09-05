import { useMemo, useState } from 'react';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useRevokePairedDevice } from '../../hooks/usePairedDevices';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

import '../Wifi/wifiResult.css';
import { useQueryClient } from '@tanstack/react-query';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

const items = [
  { key: 'revoke', label: 'revoke access' },
  { key: 'back', label: 'back' }
];

export const RevokeDeviceMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const { selectedDeviceId, selectedDeviceName } = useAppSelector(
    (state) => state.pairing
  );
  const queryClient = useQueryClient();
  const revokeDeviceMutation = useRevokePairedDevice(queryClient);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      if (revokeDeviceMutation.isError) {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'pairedDevices' })
        );
        return;
      }
      switch (items[activeIndex].key) {
        case 'revoke': {
          revokeDeviceMutation.mutate(selectedDeviceId);
          break;
        }
        case 'back': {
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

  if (revokeDeviceMutation.isSuccess) {
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

  if (revokeDeviceMutation.isPending) {
    return <LoadingScreen />;
  }

  if (revokeDeviceMutation.isError) {
    return (
      <div className="main-container response">
        <div className="connect-response-title error-entry">
          An error occured. Please try again
        </div>
        <div className="connect-response-message error-entry">
          {revokeDeviceMutation.failureReason?.message}
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
              <span>
                {option.key === 'revoke'
                  ? `revoke '${selectedDeviceName}'`
                  : option.label}
              </span>
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
                <span>
                  {option.key === 'revoke'
                    ? `revoke '${selectedDeviceName}'`
                    : option.label}
                </span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
