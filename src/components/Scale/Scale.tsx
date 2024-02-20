import { useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import { roundPrecision, addRightComplement } from '../../utils';
import './scale.css';

export function Scale(): JSX.Element {
  const { stats } = useAppSelector((state) => state);

  const getTotalScale = useCallback(() => {
    const toLayout = addRightComplement(
      roundPrecision(parseFloat(stats.sensors.w) || 0, 1).toString()
    );
    const withPads = toLayout.padStart(5, '0');

    if (/^0*$/.test(toLayout.replace('.', ''))) {
      return <span>{withPads}</span>;
    }

    const pads: JSX.Element[] = [];
    withPads.split(toLayout).map((i: string) => {
      for (let y = 1; y <= i.length; y++) {
        pads.push(<span>0</span>);
      }
    });

    pads.push(<>{toLayout}</>);
    return pads;
  }, [stats.sensors.w]);

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
            <div className="weight">{getTotalScale()}</div>
            <div className="weight-data">g</div>
          </div>
        </div>
      </div>
    </div>
  );
}
