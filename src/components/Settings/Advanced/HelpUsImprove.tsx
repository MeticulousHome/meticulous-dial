import { useEffect, useMemo, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
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

export const HelpUsImprove = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showThanks, setShowThanks] = useState(false);

  const sharing = settings?.shot_data_sharing === true;
  const actions = useMemo(
    () => (sharing ? OPT_OUT_ACTIONS : OPT_IN_ACTIONS),
    [sharing]
  );
  const busy = updateSettings.isPending;

  const goBack = () => {
    dispatch(
      setBubbleDisplay({ visible: true, component: 'advancedSettings' })
    );
  };

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, actions.length - 1));
  }, [actions.length]);

  useEffect(() => {
    if (!showThanks) return;
    const timer = setTimeout(() => {
      dispatch(
        setBubbleDisplay({ visible: true, component: 'advancedSettings' })
      );
    }, THANKS_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [dispatch, showThanks]);

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
    showThanks || !bubbleDisplay.interceptsGesture
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
