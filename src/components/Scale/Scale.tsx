import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './scale.css';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import {
  setScreen,
  setBubbleDisplay
} from '../store/features/screens/screens-slice';

export function Scale(): JSX.Element {
  const weight = useAppSelector((state) => state.stats.sensors.w || 0);
  const dispatch = useAppDispatch();
  const { isIdle: shouldGoToIdle } = useIdleTimer();

  useEffect(() => {
    if (!shouldGoToIdle) return;
    dispatch(setScreen('idle'));
    dispatch(setBubbleDisplay({ visible: false, component: null }));
  }, [shouldGoToIdle]);

  return (
    <div
      className={`main-layout`}
      style={{
        zIndex: 50
      }}
    >
      <div className="main-layout-content">
        <div className="pressets-options-conainer">
          <div className="scale-weight">
            <div>
              <span className="weight">{weight.toFixed(1)}</span>
            </div>
            <div className="weight-data">g</div>
          </div>
        </div>
      </div>
    </div>
  );
}
