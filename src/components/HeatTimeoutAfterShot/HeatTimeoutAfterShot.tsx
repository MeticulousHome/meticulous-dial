import { useSettings, useUpdateSettings } from '../..//hooks/useSettings';
import { Gauge } from '../../components/SettingNumerical/Gauge';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSyncedState } from '../../hooks/useSyncedState';
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

  const [localHeatingTimeout, setLocalHeatingTimeout, heatingTimeoutRef] =
    useSyncedState(globalSettings?.heating_timeout || MAX_TIMEOUT);

  useDimScreen();

  useHandleGestures(
    {
      left() {
        setLocalHeatingTimeout((current) => Math.max(current - INTERVAL, 0));
      },
      right() {
        setLocalHeatingTimeout((current) =>
          Math.min(current + INTERVAL, MAX_TIMEOUT)
        );
      },
      pressDown() {
        updateSettings.mutate({ heating_timeout: heatingTimeoutRef.current });
        dispatch(setScreen('profileHome'));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'brewSettings' })
        );
      }
    },
    bubbleDisplay.interceptsGesture
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
