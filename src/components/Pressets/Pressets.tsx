// Core modules imports are same as usual
import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '../store/hooks';
import { nextPreset, prevPreset } from '../store/features/preset/preset-slice';

import 'swiper/swiper-bundle.min.css';
import './pressets.css';

export function Pressets(): JSX.Element {
  const dispatch = useDispatch();
  const { gesture, presets, screen } = useAppSelector((state) => state);

  const [animationStyle, setAnimationStyle] = useState('');

  const [swiper, setSwiper] = useState(null);

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (presets.activePreset > -1) {
      slideTo(presets.activePreset);
    }
  }, [presets.activePreset]);

  const handleKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if (screen.value !== 'pressets') return;
      switch (e.code) {
        case 'ArrowLeft':
          //dispatch(setGesture('left'));
          dispatch(prevPreset());
          break;
        case 'ArrowRight':
          dispatch(nextPreset());
          break;
        case 'Space':
          break;
        default:
          break;
      }
    },
    [screen.value]
  );

  // useEffect(() => {
  //   window.addEventListener('keydown', handleKeyboard);
  //   return () => {
  //     window.removeEventListener('keydown', handleKeyboard);
  //   };
  // }, []);

  //register handleKeyboard and remove when gesture.value === 'right'
  useEffect(() => {
    if (screen.value === 'pressets') {
      window.addEventListener('keydown', handleKeyboard);
    } else {
      window.removeEventListener('keydown', handleKeyboard);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyboard);
    };
  }, [screen.value]);

  return (
    // <div className="main-layout">
    //   <div className="title-main-1">pressets</div>
    <div className="preset-wrapper">
      {screen.value === 'pressets' && (
        <>
          <div className="blur blur-left"></div>
          <div className="blur blur-right"></div>
        </>
      )}
      <Swiper
        slidesPerView={2}
        spaceBetween={100}
        centeredSlides={true}
        allowTouchMove={false}
        initialSlide={0}
        onSlideChangeTransitionStart={(e) => {
          setAnimationStyle('animation-bounce-left');
        }}
        onSlidePrevTransitionStart={(e) => {
          setAnimationStyle('animation-bounce-right');
        }}
        onSwiper={setSwiper}
        // onDragStart={() => setAnimationStyle('')}
        // onSlideChange={(e) => dispatch(setActivePreset(e.activeIndex))}
      >
        {presets.value.map((_i, index) => (
          <SwiperSlide key={`${index}-slide`}>
            {({ isActive }) => (
              <div className={isActive ? animationStyle : ''}>
                <div className="main-layout-content ">
                  <div className="pressets-conainer">
                    <div className="presset-item presset-active">
                      {/* <div className="title-main-2">Filter 2.1</div> */}
                      <div className="presset-icon">
                        <svg
                          style={{
                            opacity: 0,
                            zIndex: 50
                          }}
                          className={`${
                            screen.value === 'pressets'
                              ? 'presset__fadeIn'
                              : 'presset__fadeOut'
                          }`}
                          // style={{
                          //   opacity: gesture.value === 'click' ? 1 : 0,
                          //   transform:
                          //     gesture.value === 'click' ? 'scale(1)' : 'scale(2.3)'
                          // }}
                          viewBox="0 0 206 204"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M116.193 99.0966C117.814 105.545 113.978 112.132 107.534 113.883C104.871 114.607 102.175 114.394 99.7962 113.444L45.8578 165.201L39.1532 158.214L92.9505 106.593C92.7833 106.17 92.6378 105.734 92.5158 105.285C90.7431 98.7635 94.5928 92.0397 101.114 90.267C103.591 89.5938 106.097 89.7315 108.35 90.5186L126.963 72.7627L134.984 81.1708L116.193 99.0966Z"
                            fill="#F5C444"
                          />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M111.745 97.8112L129.329 81.0375L126.83 78.418L109.341 95.1017L107.031 94.2947C105.516 93.7657 103.836 93.6723 102.164 94.127C97.7738 95.3202 95.1825 99.8461 96.3758 104.236C96.4587 104.541 96.5572 104.836 96.6698 105.121L97.6584 107.619L44.8089 158.33L45.9745 159.545L98.886 108.774L101.279 109.729C102.88 110.368 104.688 110.512 106.485 110.024C110.822 108.845 113.404 104.411 112.313 100.072L111.745 97.8112ZM45.8578 165.201L39.1532 158.214L92.9505 106.593C92.7833 106.17 92.6378 105.734 92.5158 105.285C90.7431 98.7635 94.5928 92.0397 101.114 90.267C103.591 89.5938 106.097 89.7315 108.35 90.5186L126.963 72.7627L134.984 81.1708L116.193 99.0966C117.814 105.545 113.978 112.132 107.534 113.883C104.871 114.607 102.175 114.394 99.7962 113.444L45.8578 165.201Z"
                            fill="#F5C444"
                          />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M102 197.544C154.768 197.544 197.544 154.768 197.544 102C197.544 49.2323 154.768 6.4557 102 6.4557C49.2323 6.4557 6.4557 49.2323 6.4557 102C6.4557 154.768 49.2323 197.544 102 197.544ZM102 204C158.333 204 204 158.333 204 102C204 45.667 158.333 0 102 0C45.667 0 0 45.667 0 102C0 158.333 45.667 204 102 204Z"
                            fill="#E4E4E4"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* <div className="bottom-status">
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
          <div className="status-value">5.38</div>
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
    // </div>
  );
}
