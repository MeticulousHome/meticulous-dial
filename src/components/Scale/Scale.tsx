import { useAppSelector } from '../store/hooks';
import './scale.css';

export function Scale(): JSX.Element {
  const { screen } = useAppSelector((state) => state);
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
            <div className="weight">
              <span>00</span>
              8.1
            </div>
            <div className="weight-data">g</div>
          </div>
        </div>
      </div>
    </div>
  );
}
