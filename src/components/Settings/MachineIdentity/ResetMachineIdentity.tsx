import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useRotateMachineIdentity } from '../../../hooks/useMachine';
import {
  formatMachineFingerprint,
  RESET_MACHINE_IDENTITY_DEFAULT_INDEX,
  RESET_MACHINE_IDENTITY_OPTIONS
} from '../../../features/machineIdentity';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch } from '../../store/hooks';
import { LoadingScreen } from '../../LoadingScreen/LoadingScreen';
import Styled, { VIEWPORT_HEIGHT } from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';

export const ResetMachineIdentity = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const rotateIdentity = useRotateMachineIdentity(queryClient);
  const [activeIndex, setActiveIndex] = useState(
    RESET_MACHINE_IDENTITY_DEFAULT_INDEX
  );

  const close = (component: 'settings' | 'deviceInfo') => {
    rotateIdentity.reset();
    dispatch(setBubbleDisplay({ visible: true, component }));
  };

  useHandleGestures({
    left() {
      if (!rotateIdentity.isIdle) return;
      setActiveIndex((previous) => Math.max(previous - 1, 0));
    },
    right() {
      if (!rotateIdentity.isIdle) return;
      setActiveIndex((previous) =>
        Math.min(previous + 1, RESET_MACHINE_IDENTITY_OPTIONS.length - 1)
      );
    },
    pressDown() {
      if (rotateIdentity.isError) {
        close('settings');
        return;
      }
      if (rotateIdentity.isSuccess) {
        close('deviceInfo');
        return;
      }

      if (RESET_MACHINE_IDENTITY_OPTIONS[activeIndex].key === 'reset') {
        rotateIdentity.mutate();
      } else {
        close('settings');
      }
    }
  });

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: RESET_MACHINE_IDENTITY_OPTIONS
      }),
    [activeIndex]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: RESET_MACHINE_IDENTITY_OPTIONS
      }),
    [activeIndex]
  );

  if (rotateIdentity.isPending) return <LoadingScreen />;

  if (rotateIdentity.isError) {
    return (
      <div className="main-container response">
        <div className="connect-response-title error-entry">
          Identity reset failed
        </div>
        <div className="connect-response-message error-entry">
          {rotateIdentity.failureReason?.message}
        </div>
        <div className="settings-item active-setting connect-item">
          <div className="settings-entry connect-button">Ok</div>
        </div>
      </div>
    );
  }

  if (rotateIdentity.isSuccess) {
    const fingerprint = formatMachineFingerprint(
      rotateIdentity.data.fingerprint
    );
    return (
      <div className="main-container response">
        <div className="connect-response-title">Machine identity reset</div>
        <div className="connect-response-message">
          New identity: {fingerprint ?? 'unavailable'}. Pair your devices again.
        </div>
        <div className="settings-item active-setting connect-item">
          <div className="settings-entry connect-button">Ok</div>
        </div>
      </div>
    );
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {RESET_MACHINE_IDENTITY_OPTIONS.map((option) => (
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
            {RESET_MACHINE_IDENTITY_OPTIONS.map((option) => (
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
