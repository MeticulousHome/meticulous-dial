import React, { useState } from 'react';
import { useSettings, useUpdateSettings } from '../..//hooks/useSettings';
import { Gauge } from '../../components/SettingNumerical/Gauge';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import { useDimScreen } from '../../hooks/useDimScreen';

const MAX_TIMEOUT = 10; // 60 minutes
const INTERVAL = 1; // 1 minute intervals

export const HeatTimeoutAfterShot: React.FC = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [localHeatingTimeout, setLocalHeatingTimeout] = useState(
    globalSettings.heating_timeout
  );

  useDimScreen();

  useHandleGestures(
    {
      left() {
        const newValue = Math.max(localHeatingTimeout - INTERVAL, 0);
        setLocalHeatingTimeout(newValue);
      },
      right() {
        const newValue = Math.min(localHeatingTimeout + INTERVAL, MAX_TIMEOUT);
        setLocalHeatingTimeout(newValue);
      },
      pressDown() {
        updateSettings.mutate({ heating_timeout: localHeatingTimeout });
        dispatch(setScreen('profileHome'));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'brewSettings' })
        );
      }
    },
    bubbleDisplay.visible
  );

  return (
    <div className="gauge-container">
      <Gauge
        value={localHeatingTimeout}
        maxValue={MAX_TIMEOUT}
        precision={0}
        unit="min"
      />
      <div className="navigation-title bottom">Time</div>
    </div>
  );
};
