import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { roundPrecision, addRightComplement } from '../../utils';
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

  const getTotalScale = useCallback(() => {
    const toLayout = addRightComplement(roundPrecision(weight, 1).toString());
    const withPads = toLayout.padStart(5, '0');

    if (/^0*$/.test(toLayout.replace('.', ''))) {
      return <span>{withPads}</span>;
    }

    const pads: JSX.Element[] = [];
    withPads.split(toLayout).map((i: string) => {
      for (let y = 1; y <= i.length; y++) {
        pads.push(<span className="weight">0</span>);
      }
    });

    pads.push(<span key={1}>{toLayout}</span>);
    return pads;
  }, [weight]);

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
            <div>{getTotalScale()}</div>
            <div className="weight-data">g</div>
          </div>
        </div>
      </div>
    </div>
  );
}
