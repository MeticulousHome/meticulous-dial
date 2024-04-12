import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperRef } from 'swiper/react';
import classnames from 'classnames';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import './swiperWrapper.css';

interface IProps {
  children: React.ReactNode;
  largeContentFadeClassNameTop?: string;
  largeContentFadeClassNameBottom?: string;
  largeContentIds?: string[];
  largeContentIndices?: number[];
  onClick?: (activeSlideId: string, activeIndex: number) => void;
  setAnimationStyle: (animationStyle: string) => void;
}

export const SwiperWrapper = ({
  children,
  largeContentFadeClassNameTop = 'fade-top-large',
  largeContentFadeClassNameBottom = 'fade-bottom-large',
  largeContentIds = [],
  largeContentIndices = [],
  onClick,
  setAnimationStyle
}: IProps): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0);

  const swiperRef = useRef<SwiperRef>(null);
  const activeSlideId = swiperRef?.current?.swiper?.slides[activeIndex].id;
  const isDisplayingLargeContent =
    largeContentIds.includes(activeSlideId) ||
    largeContentIndices.includes(activeIndex);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) =>
        Math.min(
          prev + 1,
          (swiperRef?.current?.swiper?.slides || []).length - 1
        )
      );
    },
    pressDown() {
      if (typeof onClick === 'function') {
        onClick(activeSlideId, activeIndex);
      }
    }
  });

  useEffect(() => {
    if (swiperRef.current?.swiper) {
      try {
        swiperRef.current.swiper.slideTo(activeIndex);
      } catch (error) {
        console.log({ error });
      }
    }
  }, [activeIndex]);

  return (
    <>
      <Swiper
        ref={swiperRef}
        slidesPerView="auto"
        allowTouchMove={false}
        initialSlide={activeIndex}
        direction="vertical"
        centeredSlides={true}
        onSlideNextTransitionStart={() => {
          setAnimationStyle('animation-next');
        }}
        onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
        onSlideChangeTransitionEnd={() => setAnimationStyle('')}
      >
        {children}
      </Swiper>
      <div
        className={classnames('fade fade-top', {
          [largeContentFadeClassNameTop]: isDisplayingLargeContent
        })}
      />
      <div
        className={classnames('fade fade-bottom', {
          [largeContentFadeClassNameBottom]: isDisplayingLargeContent
        })}
      />
    </>
  );
};
