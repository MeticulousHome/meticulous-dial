import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import './bottom-status.css';

const BottomStatus = ({ hidden }: { hidden: boolean }) => {
  const stats = useAppSelector((state) => state.stats);

  return (
    <div className={`bottom-status bottom__${hidden ? 'fadeOut' : 'fadeIn'}`}>
      <div className="bottom-content">
        <div className="bottom-item">
          <div className="status-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="19"
              viewBox="0 0 12 19"
              fill="none"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.57027 10.1908V3.861C8.57027 2.62852 7.50924 1.46667 5.99981 1.46667C4.49039 1.46667 3.42936 2.62852 3.42936 3.861V10.1908L3.04304 10.6145C2.44954 11.2655 2.10459 12.097 2.09987 12.9942C2.0897 14.9224 3.74271 16.6781 5.96903 16.6942C5.96977 16.6942 5.97052 16.6942 5.97126 16.6942L5.99981 16.6943C6.00053 16.6943 6.00125 16.6943 6.00197 16.6943C8.24478 16.6932 9.89982 14.9558 9.89982 13.013C9.89982 12.1084 9.55414 11.2699 8.9566 10.6145L8.57027 10.1908ZM5.99981 18.161L5.96205 18.1609C3.04112 18.1412 0.666795 15.8137 0.681711 12.9862C0.688524 11.6912 1.18956 10.5096 2.01117 9.60836V3.861C2.01117 1.72864 3.79696 0 5.99981 0C8.20266 0 9.98845 1.72864 9.98845 3.861V9.60836C10.8158 10.5158 11.318 11.7075 11.318 13.013C11.318 15.8563 8.93716 18.161 5.99981 18.161Z"
                fill="#838383"
              />
              <path
                d="M8.48121 12.8812C8.48121 14.1772 7.37006 15.2279 5.99939 15.2279C4.62873 15.2279 3.51758 14.1772 3.51758 12.8812C3.51758 12.0128 4.01689 11.2551 4.75849 10.8493V3.93456C4.75849 3.28655 5.31406 2.76123 5.99939 2.76123C6.68473 2.76123 7.2403 3.28655 7.2403 3.93456V10.8493C7.9819 11.2551 8.48121 12.0128 8.48121 12.8812Z"
                fill="#838383"
              />
            </svg>
          </div>
          <div className="status-value">
            {formatStatValue(stats.sensors.t, 1)}
            <div className="status-unit status-temp-icon">°C</div>
          </div>
        </div>
        <div className="bottom-item">
          <div className="status-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 5.89474C10.0464 5.89474 10.8947 5.04643 10.8947 4C10.8947 2.95357 10.0464 2.10526 9 2.10526C7.95357 2.10526 7.10526 2.95357 7.10526 4C7.10526 5.04643 7.95357 5.89474 9 5.89474ZM13 4C13 6.20914 11.2091 8 9 8C6.79086 8 5 6.20914 5 4C5 1.79086 6.79086 0 9 0C11.2091 0 13 1.79086 13 4Z"
                fill="#838383"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M13.1747 8.01342H4.23092L2.06213 15.9866H15.3429L13.1747 8.01342ZM2.54172 6.80377C2.67055 6.32938 3.10058 6 3.59112 6H13.8145C14.3051 6 14.7347 6.32907 14.8639 6.80377L17.3465 15.9331C17.6297 16.974 16.8482 18 15.7726 18H1.63271C0.556796 18 -0.22473 16.974 0.0584415 15.9331L2.54172 6.80377Z"
                fill="#838383"
              />
            </svg>
          </div>
          <div className="status-value">
            {formatStatValue(stats.sensors.w, 1)}
            <div className="status-unit">g</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomStatus;
