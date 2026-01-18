import { useState, useEffect } from 'react';
import { Gauge } from '../SettingNumerical/Gauge';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useDimScreen } from '../../hooks/useDimScreen';
import { useSoundVolume, useUpdateSoundVolume } from '../../hooks/useSoundVolume';

const MIN_VOLUME = 0;
const MAX_VOLUME = 100; 
const INTERVAL = 5;

export const SoundVolumeGauge: React.FC = () => {
  const dispatch = useAppDispatch();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: currentVolume, isLoading } = useSoundVolume();
  const updateVolume = useUpdateSoundVolume();
  const [localVolume, setLocalVolume] = useState(70);

  useDimScreen();

  // Update local volume when data loads
  useEffect(() => {
    if (currentVolume !== undefined) {
      setLocalVolume(Math.round(currentVolume));
    }
  }, [currentVolume]);

  useHandleGestures({
    left() {
      const newValue = Math.max(localVolume - INTERVAL, MIN_VOLUME);
      setLocalVolume(newValue);
    },
    right() {
      const newValue = Math.min(localVolume + INTERVAL, MAX_VOLUME);
      setLocalVolume(newValue);
    },
    pressDown() {
      updateVolume.mutate(localVolume, {
        onSuccess: () => {
          dispatch(setScreen(prevScreen));
          dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
        }
      });
    }
  });

  return (
    <div className="gauge-container">
      <Gauge
        value={isLoading ? 0 : localVolume}
        maxValue={MAX_VOLUME}
        minValue={MIN_VOLUME}
        precision={0}
        unit="percentage"
      />
    </div>
  );
};
