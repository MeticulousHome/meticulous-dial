import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { useAppSelector } from '../store/hooks';
import './scale.css';
import { Fragment } from 'react/jsx-runtime';
import { memo } from 'react';

const Weight = () => {
  const weight = useAppSelector((state) => state.stats.sensors.w || 0);
  const formatted = weight.toFixed(1);
  const padded = formatted.padStart(5, '0');

  return (
    <div className="scale-weight">
      <span className="weight">
        {padded.split('').map((char, i) => (
          <span
            key={i}
            className={
              i < padded.length - formatted.length ? 'dimmed' : undefined
            }
          >
            {char}
          </span>
        ))}
      </span>
      <div className="weight-unit">g</div>
    </div>
  );
};

export const Scale = memo(
  ({ visible, size }: { visible: boolean; size: 'small' | 'full' }) => (
    <SwitchTransition>
      <CSSTransition
        key={visible ? 'off' : 'on'}
        in={visible}
        timeout={300}
        classNames="animate"
      >
        {visible ? (
          <div
            className={`main-layout scale-container scale-container--${size}`}
          >
            <div className="main-layout-content">
              <Weight />
            </div>
          </div>
        ) : (
          <Fragment />
        )}
      </CSSTransition>
    </SwitchTransition>
  )
);
