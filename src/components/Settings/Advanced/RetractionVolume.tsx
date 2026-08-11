import { useEffect, useRef, useState } from 'react';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { Gauge } from '../../SettingNumerical/Gauge';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import { useDimScreen } from '../../../hooks/useDimScreen';
import { LoadingScreen } from '../../LoadingScreen/LoadingScreen';
import {
  RETRACTION_DEFAULT_VOLUME_ML,
  RETRACTION_MAX_VOLUME_ML,
  RETRACTION_MIN_VOLUME_ML,
  RETRACTION_VOLUME_STEP_ML,
  retractionMmToVolumeMl,
  volumeMlToRetractionMm
} from '../../../utils/retraction';

export const RetractionSettingGauge: React.FC = () => {
  const dispatch = useAppDispatch();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [localRetractionVolume, setLocalRetractionVolume] = useState(
    globalSettings
      ? retractionMmToVolumeMl(globalSettings.partial_retraction)
      : RETRACTION_DEFAULT_VOLUME_ML
  );
  const initializedFromSettings = useRef(Boolean(globalSettings));

  useEffect(() => {
    if (!initializedFromSettings.current && globalSettings) {
      setLocalRetractionVolume(
        retractionMmToVolumeMl(globalSettings.partial_retraction)
      );
      initializedFromSettings.current = true;
    }
  }, [globalSettings]);

  useDimScreen();

  useHandleGestures(
    {
      left() {
        const newValue = Math.max(
          localRetractionVolume - RETRACTION_VOLUME_STEP_ML,
          RETRACTION_MIN_VOLUME_ML
        );
        setLocalRetractionVolume(newValue);
      },
      right() {
        const newValue = Math.min(
          localRetractionVolume + RETRACTION_VOLUME_STEP_ML,
          RETRACTION_MAX_VOLUME_ML
        );
        setLocalRetractionVolume(newValue);
      },
      pressDown() {
        updateSettings.mutate({
          partial_retraction: volumeMlToRetractionMm(localRetractionVolume)
        });
        dispatch(setScreen(prevScreen));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'brewSettings' })
        );
      }
    },
    Boolean(globalSettings)
  );

  if (!globalSettings) {
    return <LoadingScreen />;
  }

  return (
    <div className="gauge-container">
      <Gauge
        value={localRetractionVolume}
        maxValue={RETRACTION_MAX_VOLUME_ML}
        minValue={RETRACTION_MIN_VOLUME_ML}
        precision={0}
        unit="volume"
      />
    </div>
  );
};
