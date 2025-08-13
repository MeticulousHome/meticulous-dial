import React, { useState } from 'react';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { Gauge } from '../../SettingNumerical/Gauge';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import { useDimScreen } from '../../../hooks/useDimScreen';

const MIN_VOLUME = 100; // ml
const MAX_VOLUME = 150; // ml
const INTERVAL = 1; // 1 ml interval

const cylinder_radius = 26.5; //mm

const pi_r_squared = Math.PI * cylinder_radius * cylinder_radius;

export const RetractionSettingGauge: React.FC = () => {
  const dispatch = useAppDispatch();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [localRetractionVolume, setLocalRetractionVolume] = useState(
    Math.round((pi_r_squared * globalSettings.partial_retraction) / 1000.0)
  );

  useDimScreen();

  useHandleGestures({
    left() {
      const newValue = Math.max(localRetractionVolume - INTERVAL, MIN_VOLUME);
      setLocalRetractionVolume(newValue);
    },
    right() {
      const newValue = Math.min(localRetractionVolume + INTERVAL, MAX_VOLUME);
      setLocalRetractionVolume(newValue);
    },
    pressDown() {
      updateSettings.mutate({
        partial_retraction:
          Math.round((localRetractionVolume * 1000 * 100) / pi_r_squared) / 100
      });
      dispatch(setScreen(prevScreen));
      dispatch(
        setBubbleDisplay({ visible: true, component: 'advancedSettings' })
      );
    }
  });

  return (
    <div className="gauge-container">
      <Gauge
        value={localRetractionVolume}
        maxValue={MAX_VOLUME}
        minValue={MIN_VOLUME}
        precision={0}
        unit="volume"
      />
    </div>
  );
};
