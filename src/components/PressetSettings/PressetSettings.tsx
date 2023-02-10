import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppSelector } from '../store/hooks';

import './pressetSettings.css';

const presetSettingOptionsMock = [
  {
    name: '',
    id: -1
  },
  {
    name: '',
    id: -1
  },
  {
    name: 'name: Filter 2.1',
    id: 1
  },
  {
    name: 'pressure',
    id: 2
  },
  {
    name: 'temperature: 86°c',
    id: 3
  },
  {
    name: 'stop weight',
    id: 4
  },
  {
    name: 'flow',
    id: 5
  },
  {
    name: 'pre-infusion',
    id: 6
  },
  {
    name: 'Ok',
    id: 7
  },
  {
    name: '',
    id: -1
  },
  {
    name: '',
    id: -1
  }
];

export function PressetSettings(): JSX.Element {
  const [swiper, setSwiper] = useState(null);
  const { presetSetting } = useAppSelector((state) => state);
  const [animationStyle, setAnimationStyle] = useState('');
  const [init, setInit] = useState(false);

  const { screen } = useAppSelector((state) => state);

  // useEffect(() => {
  //   if (swiper) {
  //     swiper.slideTo(2);
  //   }
  // }, [swiper]);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(presetSetting.activeSetting);
    }
  }, [presetSetting.activeSetting]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  return (
    <div
      className={`presset-container ${
        screen.value === 'pressetSettings' ? 'pressetSettings__fadeIn' : ''
      }`}
    >
      {/* <div className="presset-title title-main-2">Filter 2.1</div> */}
      <div className="blur blur-top"></div>
      <div className="blur blur-bottom"></div>
      {/* <div className="test-mid-screen"></div> */}
      <div className="presset-options">
        {/* <div className="presset-option-item">stop weight</div>
            <div className="presset-option-item">flow</div>
            <div className="presset-option-item item-active">
              temperature: 86°c
            </div>
            <div className="presset-option-item">presset</div>
            <div className="presset-option-item">style</div>
            <div className="presset-option-item">stop weight</div>
            <div className="presset-option-item">flow</div>
            <div className="presset-option-item">temperature: 86°c</div>
            <div className="presset-option-item">presset</div>
            <div className="presset-option-item">style</div>
            <div className="presset-option-item">save changes</div> */}
        <Swiper
          initialSlide={2}
          slidesPerView={8}
          onSwiper={setSwiper}
          allowTouchMove={false}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          onSlideNextTransitionStart={() => {
            if (!init) {
              setInit(true);
              return;
            }
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {presetSettingOptionsMock.map((option, index) => (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index}`}
            >
              {({ isActive }) => (
                <div
                  className={`${animationStyle} ${
                    isActive ? `item-active` : ''
                  }`}
                >
                  {option.name}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* <div className="bottom-status z2">
        <div className="flex">
          <div className="status-icon">
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
          </div>
          <div className="status-value">53.8</div>
          <div className="status-data status-temp-icon">°C</div>
        </div>
        <div className="flex">
          <div className="status-icon">
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
          </div>
          <div className="status-value">256.2</div>
          <div className="status-data">g</div>
        </div>
      </div> */}
    </div>
  );
}
