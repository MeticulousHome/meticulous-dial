import { useCallback, useEffect, useRef, useState } from 'react';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import {
  DISTURBANCE_RESILIENCE_OPTIONS,
  DISTURBANCE_RESILIENCE_TITLE,
  disturbanceResilienceCopy,
  initialDisturbanceResilienceIndex
} from '../../utils/disturbanceResilience';
import { ShotDataSharingView } from '../ShotDataSharing/ShotDataSharingView';
import {
  ScreenType,
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

/**
 * Config > disturbance resilience. A full screen route opened from the config
 * menu; pushing a pill saves it and, once the backend confirmed, returns to
 * that menu. There is no Back pill: pushing the current value leaves.
 */
export const DisturbanceResilience = () => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector((state) => state.screen);
  const bubbleDisplay = screen.bubbleDisplay;
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(() =>
    initialDisturbanceResilienceIndex(settings)
  );
  const [save, setSave] = useState<'idle' | 'saving' | 'failed'>('idle');
  // The screen under the menu when this route was opened.
  const returnScreen = useRef<ScreenType>(screen.prev || 'profileHome');
  const initializedFromSettings = useRef(Boolean(settings));

  // Settings not loaded at open: focus the stored value once they arrive.
  useEffect(() => {
    if (!initializedFromSettings.current && settings) {
      setActiveIndex(initialDisturbanceResilienceIndex(settings));
      initializedFromSettings.current = true;
    }
  }, [settings]);

  const goBack = useCallback(() => {
    dispatch(setScreen(returnScreen.current));
    dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
  }, [dispatch]);

  // mutateAsync settles even if another setting is saved meanwhile, whereas
  // per-call mutate() callbacks are dropped for all but the latest call.
  const saveChoice = async (value: boolean) => {
    setSave('saving');
    try {
      await updateSettings.mutateAsync({ disturbance_resilience: value });
      goBack();
    } catch (error) {
      console.error(
        'Could not save disturbance_resilience:',
        (error as Error)?.message
      );
      setSave('failed');
    }
  };

  useHandleGestures(
    {
      // The focus stays on the pill being saved.
      left() {
        if (save === 'saving') return;
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        if (save === 'saving') return;
        setActiveIndex((prev) =>
          Math.min(prev + 1, DISTURBANCE_RESILIENCE_OPTIONS.length - 1)
        );
      },
      pressDown() {
        if (save === 'saving') return;
        void saveChoice(DISTURBANCE_RESILIENCE_OPTIONS[activeIndex].value);
      }
    },
    bubbleDisplay.interceptsGesture
  );

  return (
    <ShotDataSharingView
      title={DISTURBANCE_RESILIENCE_TITLE}
      copy={disturbanceResilienceCopy(activeIndex)}
      actions={DISTURBANCE_RESILIENCE_OPTIONS}
      activeIndex={activeIndex}
      busy={save === 'saving'}
      error={save === 'failed'}
    />
  );
};
