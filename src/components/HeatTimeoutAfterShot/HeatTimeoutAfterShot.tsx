import React, { useEffect } from 'react';
import { Gauge } from '../../components/SettingNumerical/Gauge';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useDispatch, useSelector } from 'react-redux';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { setTempHeatingTimeout } from '../store/features/settings/settings-slice';
import { RootState } from '../store/store';
import { AnyAction } from '@reduxjs/toolkit';

const MAX_TIMEOUT = 60; // 60 minutes
const INTERVAL = 1; // 1 minute intervals

export const HeatTimeoutAfterShot: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const globalHeatingTimeout = useSelector(
    (state: RootState) => state.settings.heating_timeout
  );
  const tempHeatingTimeout = useSelector(
    (state: RootState) => state.settings.tempHeatingTimeout
  );
  const [localHeatingTimeout, setLocalHeatingTimeout] = React.useState(
    tempHeatingTimeout ?? globalHeatingTimeout
  );

  useHandleGestures({
    left() {
      const newValue = Math.max(localHeatingTimeout - INTERVAL, 0);
      setLocalHeatingTimeout(newValue);
    },
    right() {
      const newValue = Math.min(localHeatingTimeout + INTERVAL, MAX_TIMEOUT);
      setLocalHeatingTimeout(newValue);
    },
    pressDown() {
      dispatch(setTempHeatingTimeout(localHeatingTimeout));
      dispatch(
        setBubbleDisplay({ visible: true, component: 'advancedSettings' })
      );
      dispatch(setScreen('pressets'));
    }
  });

  useEffect(() => {
    setLocalHeatingTimeout(tempHeatingTimeout ?? globalHeatingTimeout);
  }, [tempHeatingTimeout, globalHeatingTimeout]);

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
