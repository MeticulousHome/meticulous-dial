import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { USER_SETTINGS_QUERY_KEY } from '../../hooks/useSettings';
import { PROFILES_QUERY_KEY } from '../../hooks/useProfiles';
import { useAppDispatch } from '../store/hooks';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import {
  setScreen,
  setBubbleDisplay
} from '../store/features/screens/screens-slice';
import { useDeviceInfo } from '../../hooks/useDeviceOSStatus';
import { startMasterCalibration, unlockMachine } from '../../api/api';

const looksComplete = (code: string) =>
  code === 'met' || /^\d{5}$/.test(code);

export const UnlockScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState<string>('');
  const { data: deviceInfo } = useDeviceInfo();
  const inFlight = useRef(false);
  const lastRejected = useRef<string | null>(null);

  const tryUnlock = async (input: string, explicit: boolean) => {
    const code = input.trim().toLowerCase();
    if (!code || inFlight.current) return;
    if (!explicit && (!looksComplete(code) || lastRejected.current === code)) {
      return;
    }

    inFlight.current = true;
    try {
      const result = await unlockMachine(code);
      if (result.ok) {
        await queryClient.invalidateQueries({
          queryKey: [USER_SETTINGS_QUERY_KEY]
        });
        await queryClient.invalidateQueries({
          queryKey: [PROFILES_QUERY_KEY]
        });
        dispatch(setScreen('profileHome'));
        return;
      }
      if (result.ok === false && result.status === 403) {
        lastRejected.current = code;
      }
    } finally {
      inFlight.current = false;
    }
  };

  const onCancel = () => {
    dispatch(setScreen('profileHome'));
  };

  return (
    <CircleKeyboard
      name={`Unlock Code for S/N: ${deviceInfo?.serial ?? 'LOADING...'}`}
      defaultValue={password.split('')}
      onSubmit={() => void tryUnlock(password, true)}
      onCancel={onCancel}
      onChange={(text: string) => {
        setPassword(text);
        void tryUnlock(text, false);
      }}
    />
  );
};

export const UnlockMasterCalibration: React.FC = () => {
  const dispatch = useAppDispatch();
  const [password, setPassword] = useState<string>('');

  const onCancel = () => {
    dispatch(setScreen('profileHome'));
    dispatch(
      setBubbleDisplay({ visible: true, component: 'manufacturingSettings' })
    );
  };

  const onSubmitPassword = () => {
    if (password === '8888') {
      startMasterCalibration()
        .then(() => {
          dispatch(setScreen('profileHome'));
        })
        .catch((err) => {
          dispatch(setScreen('profileHome'));
          console.log(err);
        });
    }
  };

  return (
    <CircleKeyboard
      name={'Unlock Master Calibration'}
      defaultValue={password.split('')}
      onSubmit={onSubmitPassword}
      onCancel={onCancel}
      onChange={(text: string) => {
        setPassword(text);
      }}
    />
  );
};
