import React, { useCallback } from 'react';
import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';

const BottomStatus = () => {
  const { screen, stats } = useAppSelector((state) => state);

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (
      (screen.value === 'scale' &&
        (screen.prev === 'pressets' ||
          screen.prev === 'pressetSettings' ||
          screen.prev === 'settingNumerical')) ||
      (screen.prev === 'scale' &&
        (screen.value === 'pressets' ||
          screen.value === 'pressetSettings' ||
          screen.value === 'settingNumerical')) ||
      screen.value === 'settingNumerical' ||
      (screen.prev === 'settingNumerical' && screen.value === 'pressetSettings')
    ) {
      animation = '';
    } else if (
      (screen.prev === 'barometer' ||
        screen.prev === 'circleKeyboard' ||
        screen.prev === 'onOff') &&
      (screen.value === 'pressetSettings' || screen.value === 'pressets')
    ) {
      animation = 'bottom__fadeIn';
    } else if (
      (screen.value === 'barometer' &&
        (screen.prev === 'pressetSettings' || screen.prev === 'pressets')) ||
      screen.value === 'circleKeyboard' ||
      screen.value === 'onOff'
    ) {
      animation = 'bottom__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className={`bottom-status ${getAnimation()}`}>
      <div className="flex">
        <div className="status-icon">
          {/* 
            <svg
            width="11"
            height="19"
            viewBox="0 0 11 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.79957 12.8812C7.79957 14.1773 6.68842 15.2279 5.31776 15.2279C3.94709 15.2279 2.83594 14.1773 2.83594 12.8812C2.83594 12.0128 3.33525 11.2551 4.07685 10.8493V3.93456C4.07685 3.28655 4.63242 2.76123 5.31776 2.76123C6.00309 2.76123 6.55867 3.28655 6.55867 3.93456V10.8493C7.30026 11.2551 7.79957 12.0128 7.79957 12.8812Z"
              fill="#838383"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.88864 10.1908V3.861C7.88864 2.62853 6.8276 1.46667 5.31818 1.46667C3.80875 1.46667 2.74772 2.62853 2.74772 3.861V10.1908L2.3614 10.6145C1.7679 11.2655 1.42295 12.097 1.41823 12.9942C1.40806 14.9224 3.06107 16.6781 5.28739 16.6942C5.28813 16.6942 5.28888 16.6942 5.28962 16.6942L5.31818 16.6943C5.31889 16.6943 5.31961 16.6943 5.32033 16.6943C7.56315 16.6932 9.21818 14.9558 9.21818 13.013C9.21818 12.1084 8.87251 11.2699 8.27496 10.6145L7.88864 10.1908ZM5.31818 18.161L5.28041 18.1609C2.35948 18.1413 -0.014846 15.8137 6.98952e-05 12.9862C0.00688382 11.6912 0.507915 10.5096 1.32953 9.60836V3.861C1.32953 1.72864 3.11532 0 5.31818 0C7.52103 0 9.30682 1.72864 9.30682 3.861V9.60836C10.1341 10.5158 10.6364 11.7075 10.6364 13.013C10.6364 15.8563 8.25552 18.161 5.31818 18.161Z"
              fill="#838383"
            />
          </svg>
            */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15.0034 3.49726C15.0034 -1.16575 7.91109 -1.16575 7.91109 3.49726V13.3802C6.98909 14.294 6.41797 15.5609 6.41797 16.9607C6.41797 19.7439 8.67407 22 11.4572 22C14.2404 22 16.4965 19.7439 16.4965 16.9607C16.4965 15.5609 15.9254 14.294 15.0034 13.3802V3.49726ZM11.4572 20.8488C9.29222 20.8488 7.53781 19.0936 7.53781 16.9286C7.53781 15.7692 8.04099 14.7278 8.84056 14.0103L8.84429 14.0073L8.84877 13.9984C8.94582 13.9073 9.00928 13.7819 9.02122 13.6423V13.64C9.02197 13.6296 9.02645 13.6221 9.0272 13.6117L9.03167 13.59V3.49651C9.02944 3.45695 9.02794 3.41066 9.02794 3.36363C9.02794 2.09149 10.0589 1.06049 11.3311 1.06049C11.3759 1.06049 11.4207 1.06198 11.4647 1.06422H11.4587C11.4968 1.06198 11.5416 1.06049 11.5857 1.06049C12.8578 1.06049 13.8888 2.09149 13.8888 3.36363C13.8888 3.41066 13.8873 3.45694 13.8843 3.50249V3.49651V13.59L13.8888 13.6117C13.8888 13.6221 13.8933 13.6296 13.8948 13.64C13.9067 13.7819 13.9702 13.9073 14.0665 13.9976L14.071 14.0066C14.8743 14.7278 15.3774 15.7692 15.3774 16.9279C15.3774 19.0929 13.623 20.8473 11.458 20.8481L11.4572 20.8488ZM12.0172 14.9637V3.49129C12.0172 3.18221 11.7663 2.93137 11.4572 2.93137C11.1482 2.93137 10.8973 3.18221 10.8973 3.49129V14.9637C10.0283 15.216 9.40421 16.0044 9.40421 16.9391C9.40421 18.0731 10.3232 18.9921 11.4572 18.9921C12.5913 18.9921 13.5103 18.0731 13.5103 16.9391C13.5103 16.0044 12.8862 15.216 12.0314 14.9674L12.0172 14.9637Z"
              fill="#838383"
            />
          </svg>
        </div>
        <div className="status-value">
          {formatStatValue(stats.sensors.t, 1)}
        </div>
        <div className="status-data status-temp-icon">°c</div>
      </div>
      <div className="flex">
        <div className="status-icon">
          {/*
            <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M13.1747 8.01342H4.23092L2.06213 15.9866H15.3429L13.1747 8.01342ZM2.54172 6.80377C2.67055 6.32938 3.10058 6 3.59112 6H13.8145C14.3051 6 14.7347 6.32907 14.8639 6.80377L17.3465 15.9331C17.6297 16.974 16.8482 18 15.7726 18H1.63271C0.556796 18 -0.22473 16.974 0.0584415 15.9331L2.54172 6.80377Z"
              fill="#838383"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 5.89474C10.0464 5.89474 10.8947 5.04643 10.8947 4C10.8947 2.95357 10.0464 2.10526 9 2.10526C7.95357 2.10526 7.10526 2.95357 7.10526 4C7.10526 5.04643 7.95357 5.89474 9 5.89474ZM13 4C13 6.20914 11.2091 8 9 8C6.79086 8 5 6.20914 5 4C5 1.79086 6.79086 0 9 0C11.2091 0 13 1.79086 13 4Z"
              fill="#838383"
            />
          </svg>
            */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.16242 20.6797L5.88791 9.09634C6.03671 8.46394 6.60102 8.01699 7.2507 8.01699H16.916C17.5656 8.01699 18.13 8.46393 18.2788 9.09634L21.0042 20.6797C21.211 21.5585 20.5442 22.4003 19.6415 22.4003H4.5252C3.62241 22.4003 2.95565 21.5585 3.16242 20.6797Z"
              stroke="#838383"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
            <circle
              cx="12.0846"
              cy="4.66667"
              r="3.06667"
              stroke="#838383"
              stroke-width="1.2"
            />
          </svg>
        </div>
        <div className="status-value">
          {formatStatValue(stats.sensors.w, 1)}
        </div>
        <div className="status-data">g</div>
      </div>
    </div>
  );
};

export default BottomStatus;
