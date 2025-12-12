import { useState } from 'react';
import { useUpdateSettings } from '../../hooks/useSettings';
import { useAppDispatch } from '../store/hooks';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import {
  setScreen,
  setBubbleDisplay
} from '../store/features/screens/screens-slice';
import { useDeviceInfo } from '../../hooks/useDeviceOSStatus';
import { startMasterCalibration } from '../../api/api';

export const UnlockScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const updateSettings = useUpdateSettings();
  const [password, setPassword] = useState<string>('');
  const { data: deviceInfo } = useDeviceInfo();

  const updateSetting = (input: string) => {
    if (input !== 'met') {
      return;
    }
    updateSettings.mutate({ update_channel: 'stable' });
    dispatch(setScreen('profileHome'));
  };

  const onCancel = () => {
    dispatch(setScreen('profileHome'));
  };

  return (
    <CircleKeyboard
      name={`Unlock Code for S/N: ${deviceInfo?.serial ?? 'LOADING...'}`}
      defaultValue={password.split('')}
      onSubmit={() => updateSetting(password)}
      onCancel={onCancel}
      onChange={(text: string) => {
        setPassword(text);
        updateSetting(text);
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
