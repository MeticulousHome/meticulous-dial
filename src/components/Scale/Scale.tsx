import { useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import { roundPrecision, addRightComplement } from '../../utils';
import './scale.css';

export function Scale(): JSX.Element {
  const { screen, stats } = useAppSelector((state) => state);

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
      className={`main-layout ${
        screen.value === 'scale'
          ? 'scale__fadeIn'
          : screen.prev === 'scale'
          ? 'scale__fadeOut'
          : 'hidden'
      }`}
      style={{
        zIndex: 50
      }}
    >
      <div className="main-layout-content">
        <div className="pressets-options-conainer">
          <div
            className="title-main-2"
            style={{
              fontWeight: 'bold'
            }}
          >
            scale
          </div>
          <div className="scale-weight">
            <div className="weight">{getTotalScale()}</div>
            <div className="weight-data">g</div>
          </div>
        </div>
      </div>
    </div>
  );
}
