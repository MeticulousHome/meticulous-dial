import { useCallback } from 'react';
import { CircleKeyboard } from '../../../../CircleKeyboard/CircleKeyboard';
import { useAppDispatch } from '../../../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../../../store/features/screens/screens-slice';
import { setCountryLetter } from '../../../../store/features/settings/settings-slice';
import { useDimScreen } from '../../../../../hooks/useDimScreen';

export default function SelectLetterCountry() {
  const dispatch = useAppDispatch();
  useDimScreen();
  const onCancel = useCallback(() => {
    dispatch(setScreen('profileHome'));
    dispatch(setBubbleDisplay({ visible: true, component: 'timeZoneConfig' }));
  }, []);

  return (
    <CircleKeyboard
      name="Your country"
      defaultValue={[]}
      onlyLetters
      onSubmit={() => ''}
      onCancel={onCancel}
      onChange={(contryLetter: string) => {
        dispatch(setCountryLetter(contryLetter));
        dispatch(setScreen('countrySettings'));
      }}
    />
  );
}
