import { useCallback, useEffect } from 'react';
import { CircleKeyboard } from '../../../../CircleKeyboard/CircleKeyboard';
import { useAppDispatch } from '../../../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../../../store/features/screens/screens-slice';
import { setCountryLetter } from '../../../../store/features/settings/settings-slice';
import { useIdleTimer } from '../../../../../hooks/useIdleTimer';

export default function SelectLetterCountry() {
  const dispatch = useAppDispatch();
  const { isIdle: shouldGoToIdle } = useIdleTimer();

  useEffect(() => {
    if (!shouldGoToIdle) return;

    dispatch(setScreen('idle'));
    dispatch(setBubbleDisplay({ visible: false, component: null }));
  }, [shouldGoToIdle]);

  const onCancel = useCallback(() => {
    dispatch(setScreen('pressets'));
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
