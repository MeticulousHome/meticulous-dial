import { useEffect, useRef } from 'react';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { Gauge } from '../../SettingNumerical/Gauge';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useSyncedState } from '../../../hooks/useSyncedState';
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

  const [localRetractionVolume, setLocalRetractionVolume, retractionVolumeRef] =
    useSyncedState(
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
        setLocalRetractionVolume((current) =>
          Math.max(
            current - RETRACTION_VOLUME_STEP_ML,
            RETRACTION_MIN_VOLUME_ML
          )
        );
      },
      right() {
        setLocalRetractionVolume((current) =>
          Math.min(
            current + RETRACTION_VOLUME_STEP_ML,
            RETRACTION_MAX_VOLUME_ML
          )
        );
      },
      pressDown() {
        updateSettings.mutate({
          partial_retraction: volumeMlToRetractionMm(
            retractionVolumeRef.current
          )
        });
        dispatch(setScreen(prevScreen));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'brewSettings' })
        );
      }
    },
    !globalSettings
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
