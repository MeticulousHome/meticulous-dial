import { useState } from 'react';

import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import { useAppDispatch } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';

const LAB_MENU_PASSWORD = '0000';

export function LabUnlock(): JSX.Element {
  const dispatch = useAppDispatch();
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('Lab password');

  const openLabMenu = () => {
    dispatch(
      setBubbleDisplay({ visible: true, component: 'labCertification' })
    );
  };

  const submitPassword = (value: string) => {
    if (value === LAB_MENU_PASSWORD) {
      openLabMenu();
      return;
    }

    setTitle('Invalid password');
    setPassword('');
    window.setTimeout(() => setTitle('Lab password'), 1200);
  };

  return (
    <CircleKeyboard
      name={title}
      defaultValue={password.split('')}
      onSubmit={submitPassword}
      onCancel={() =>
        dispatch(setBubbleDisplay({ visible: true, component: 'settings' }))
      }
      onChange={(text) => setPassword(text)}
    />
  );
}
