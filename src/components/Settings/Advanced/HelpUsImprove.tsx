import { useEffect, useMemo, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import './HelpUsImprove.css';

export const THANKS_SCREEN_DURATION_MS = 3000;

type HelpUsImproveAction =
  'help_improve' | 'no_thanks' | 'stop_sharing' | 'back';

type ActionItem = { key: HelpUsImproveAction; label: string };

const OPT_IN_ACTIONS: ActionItem[] = [
  { key: 'help_improve', label: 'Help improve' },
  { key: 'no_thanks', label: 'No thanks' }
];

const OPT_OUT_ACTIONS: ActionItem[] = [
  { key: 'stop_sharing', label: 'Stop sharing shot data' },
  { key: 'back', label: 'Back' }
];

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
    return (
      <div className="help-improve-screen">
        <h2>Thanks!</h2>
        <p className="help-improve-copy">
          Your brews will now help make every Meticulous better.
        </p>
      </div>
    );
  }

  return (
    <div className="help-improve-screen">
      <h2>Help us improve</h2>
      {sharing ? (
        <p className="help-improve-copy">
          Anonymous sensor data from your brews is currently shared with
          Meticulous to improve brew quality and reliability. You can stop
          sharing at any time.
        </p>
      ) : (
        <p className="help-improve-copy">
          Share sensor data from your brews (pressure, flow, temperature and
          motor readings) anonymously with Meticulous. Data is sent for every
          brew until you stop sharing. It never includes your name, serial
          number or network details, and helps us improve the quality and
          reliability of every brew.
        </p>
      )}
      <div className="help-improve-actions">
        {actions.map((action, index) => (
          <div
            className={`help-improve-action ${activeIndex === index ? 'active' : ''}`}
            key={action.key}
          >
            {busy && activeIndex === index ? 'Saving...' : action.label}
          </div>
        ))}
      </div>
      {updateSettings.isError ? (
        <p className="help-improve-error">
          Could not update the setting. Please try again.
        </p>
      ) : null}
    </div>
  );
};
