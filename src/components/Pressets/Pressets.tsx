// Core modules imports are same as usual
import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useAppSelector } from '../store/hooks';
import './pressets.css';

export function Pressets(): JSX.Element {
  const { presets, screen } = useAppSelector((state) => state);

  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);

  const slideTo = (index: number) => swiper.slideTo(index);

  useEffect(() => {
    if (presets.activePresetIndex > -1 && presets.value.length > 0 && swiper) {
      slideTo(presets.activePresetIndex);
    }
  }, [presets, swiper]);

  useEffect(() => {
    if (screen.value !== 'pressets') {
      setAnimationStyle('');
    }
  }, [screen.value]);

  return (
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
        onSlideChange={() => {
          setAnimationStyle('');
        }}
        onSlideChangeTransitionStart={() => {
          setTimeout(() => {
            setAnimationStyle('animation-bounce-left');
          }, 10);
        }}
        onSlidePrevTransitionStart={() => {
          setTimeout(() => {
            setAnimationStyle('animation-bounce-right');
          }, 10);
        }}
        onSwiper={setSwiper}
      >
        {presets.value.map((_i, index) => (
          <SwiperSlide key={`${index}-slide`}>
            {() => (
              <div className={animationStyle}>
                <div className="main-layout-content ">
                  <div className="pressets-conainer">
                    <div className="presset-item presset-active">
                      <div className="presset-icon">
                        <svg
                          style={{
                            opacity: 0,
                            zIndex: 50
                          }}
                          className={`${
                            screen.value === 'pressets'
                              ? 'presset__fadeIn'
                              : screen.prev === 'pressets'
                              ? 'presset__fadeOut'
                              : 'hidden'
                          }`}
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
    </div>
  );
}
