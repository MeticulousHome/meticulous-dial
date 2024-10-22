import React from 'react';
import classNames from 'classnames';
import './funnel.css';

interface FunnelProps {
  preheatEnabled: boolean;
}

const Funnel: React.FC<FunnelProps> = ({ preheatEnabled }) => (
  <svg
    className="funnel-svg"
    width="27"
    height="25"
    viewBox="0 0 27 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      className={classNames('main-path', {
        'blink-glow': preheatEnabled,
        'static-color': !preheatEnabled
      })}
      d="M3.81286 17.4812C3.88007 11.957 3.42126 8.87114 1.06123 2.35297C0.823644 1.69677 1.30674 1 2.00463 1H25.1209C25.8188 1 26.3019 1.69677 26.0643 2.35297C23.7043 8.87114 23.2455 11.957 23.3127 17.4812L23.3128 17.49V22.9832C23.3128 23.4828 21.0628 24.5 13.5628 24.5C6.06279 24.5 3.81279 23.4828 3.81279 22.9832V17.49L3.81286 17.4812Z"
    />
  </svg>
);

export default Funnel;
