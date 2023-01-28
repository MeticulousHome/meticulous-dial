import React from 'react';
import { LogoWrapper } from './barometer.style';

const Logo = () => {
  return (
    <LogoWrapper>
      <div className="bar-needle__logo">
        <svg
          width="36"
          height="27"
          viewBox="0 0 36 27"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M26.1291 0V26.1291H0V0L13.0646 13.0646L26.1291 0Z"
            fill="white"
          />
          <path
            d="M32.5938 26.4C33.9975 26.4 35.1427 25.2549 35.1427 23.8511C35.1427 22.4474 33.9975 21.3022 32.5938 21.3022C31.1901 21.3022 30.0449 22.4474 30.0449 23.8511C30.0449 25.2549 31.1901 26.4 32.5938 26.4Z"
            fill="white"
          />
        </svg>
      </div>
    </LogoWrapper>
  );
};
export default Logo;
