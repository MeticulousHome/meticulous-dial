import { useState } from 'react';
import { useUpdateSettings } from '../../hooks/useSettings';
import { useAppDispatch } from '../store/hooks';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import { setScreen } from '../store/features/screens/screens-slice';
import { useDeviceInfo } from '../../hooks/useDeviceOSStatus';

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
