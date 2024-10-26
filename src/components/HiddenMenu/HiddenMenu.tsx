import { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import './HiddenMenu.css';

const VALID_PASSWORD = '0000';

export function HiddenMenu(): JSX.Element {
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState('Insert Password');

  const handlePasswordSubmit = (text: string) => {
    if (text === VALID_PASSWORD) {
      dispatch(setScreen('test-options'));
    } else {
      setTitle('Invalid Password');
      setTimeout(() => {
        setTitle('Insert Password');
      }, 1500);
    }
  };

  const handleCancel = () => {
    dispatch(setScreen('pressets'));
  };

  return (
    <CircleKeyboard
      name={title}
      defaultValue={[]}
      onSubmit={handlePasswordSubmit}
      onCancel={handleCancel}
    />
  );
}

export default HiddenMenu;
