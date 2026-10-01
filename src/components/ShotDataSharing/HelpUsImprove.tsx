import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import {
  ScreenType,
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  OPT_IN_ACTIONS,
  OPT_OUT_ACTIONS,
  SHOT_DATA_SHARING_OPT_IN_COPY,
  SHOT_DATA_SHARING_SHARING_COPY,
  SHOT_DATA_SHARING_TITLE,
  ShotDataSharingStopped,
  ShotDataSharingThanks,
  ShotDataSharingView,
  THANKS_SCREEN_DURATION_MS
} from './ShotDataSharingView';

/**
 * Menu > Help us improve. A full screen route opened from the quick settings
 * menu; Back and the thanks / stopped screens return to that menu.
 */
export const HelpUsImprove = () => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector((state) => state.screen);
  const bubbleDisplay = screen.bubbleDisplay;
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  // Confirmation shown after a choice before returning to the menu.
  const [outcome, setOutcome] = useState<'thanks' | 'stopped' | null>(null);
  // The screen under the menu when this route was opened.
  const returnScreen = useRef<ScreenType>(screen.prev || 'profileHome');

  const sharing = settings?.shot_data_sharing === true;
  const actions = useMemo(
    () => (sharing ? OPT_OUT_ACTIONS : OPT_IN_ACTIONS),
    [sharing]
  );
  const busy = updateSettings.isPending;

  const goBack = useCallback(() => {
    dispatch(setScreen(returnScreen.current));
    dispatch(setBubbleDisplay({ visible: true, component: 'quick-settings' }));
  }, [dispatch]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, actions.length - 1));
  }, [actions.length]);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(goBack, THANKS_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [goBack, outcome]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, actions.length - 1));
      },
      pressDown() {
        if (busy) return;
        switch (actions[activeIndex].key) {
          case 'help_improve':
            updateSettings.mutate(
              { shot_data_sharing: true },
              { onSuccess: () => setOutcome('thanks') }
            );
            break;
          case 'stop_sharing':
            updateSettings.mutate(
              { shot_data_sharing: false },
              { onSuccess: () => setOutcome('stopped') }
            );
            break;
          default:
            goBack();
            break;
        }
      }
    },
    outcome !== null || bubbleDisplay.interceptsGesture
  );

  if (outcome === 'thanks') {
    return <ShotDataSharingThanks />;
  }

  if (outcome === 'stopped') {
    return <ShotDataSharingStopped />;
  }

  return (
    <ShotDataSharingView
      title={SHOT_DATA_SHARING_TITLE}
      copy={
        sharing ? SHOT_DATA_SHARING_SHARING_COPY : SHOT_DATA_SHARING_OPT_IN_COPY
      }
      actions={actions}
      activeIndex={activeIndex}
      busy={busy}
      error={updateSettings.isError}
    />
  );
};
