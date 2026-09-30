import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import {
  ScreenType,
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  OPT_IN_ACTIONS,
  OPT_OUT_ACTIONS,
  SHOT_DATA_SHARING_OPT_IN_COPY,
  SHOT_DATA_SHARING_SHARING_COPY,
  SHOT_DATA_SHARING_TITLE,
  ShotDataSharingThanks,
  ShotDataSharingView,
  THANKS_SCREEN_DURATION_MS
} from '../../ShotDataSharing/ShotDataSharingView';

/**
 * Config > Advanced settings > Help us improve. A full screen route opened
 * from the Advanced bubble; Back and the thanks screen return to that bubble.
 */
export const HelpUsImprove = () => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector((state) => state.screen);
  const bubbleDisplay = screen.bubbleDisplay;
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showThanks, setShowThanks] = useState(false);
  // The screen under the Advanced bubble when this route was opened.
  const returnScreen = useRef<ScreenType>(screen.prev || 'profileHome');

  const sharing = settings?.shot_data_sharing === true;
  const actions = useMemo(
    () => (sharing ? OPT_OUT_ACTIONS : OPT_IN_ACTIONS),
    [sharing]
  );
  const busy = updateSettings.isPending;

  const goBack = useCallback(() => {
    dispatch(setScreen(returnScreen.current));
    dispatch(
      setBubbleDisplay({ visible: true, component: 'advancedSettings' })
    );
  }, [dispatch]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, actions.length - 1));
  }, [actions.length]);

  useEffect(() => {
    if (!showThanks) return;
    const timer = setTimeout(goBack, THANKS_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [goBack, showThanks]);

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
              { onSuccess: () => setShowThanks(true) }
            );
            break;
          case 'stop_sharing':
            updateSettings.mutate(
              { shot_data_sharing: false },
              { onSuccess: goBack }
            );
            break;
          default:
            goBack();
            break;
        }
      }
    },
    showThanks || bubbleDisplay.interceptsGesture
  );

  if (showThanks) {
    return <ShotDataSharingThanks />;
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
