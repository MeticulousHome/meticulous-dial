// Core modules imports are same as usual
import { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';

import {
  clearSlides,
  handleAddEnterAnimation,
  handleAddLeaveAnimation,
  handleAddDecreseAnimation,
  handleAddIncreseAnimation,
  handlePresetSlideChange,
  handleAddOpacityTitleActive,
  handleAddOpacityTitleInactive,
  handleRemoveOpacityTitleActive,
  handleRemoveOpacityTitleInactive
} from '../../utils/preset';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './pressets.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  addPresetNewOne,
  setNextPreset,
  setOptionPressets,
  setPrevPreset
} from '../store/features/preset/preset-slice';
import { Title, RouteProps } from '../../navigation';
import { Pagination } from './Pagination';
import '../../navigation/navigation.less';

export function Pressets({ transitioning }: RouteProps): JSX.Element {
  // console.log('transitioning', transitioning);
  const dispatch = useAppDispatch();
  const { presets } = useAppSelector((state) => state);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [pressetSwiper, setPressetsSwiper] = useState(null);
  const [pressetTitleSwiper, setPressetTitleSwiper] = useState(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [option, setOption] = useState<{
    screen: 'HOME' | 'PRESETS';
    animating: boolean;
  }>({
    screen: 'HOME',
    animating: false
  });

  const slideTo = useCallback((index: number) => {
    try {
      presetSwiperRef.current?.swiper.slideTo(index);
      titleSwiperRef.current?.swiper.slideTo(index);
    } catch (error) {
      console.log({ error, location: 'Pressets' });
    }
  }, []);

  useHandleGestures(
    {
      click() {
        if (presets.activeIndexSwiper === presets.value.length) {
          dispatch(addPresetNewOne());
        } else {
          if (option.screen === 'PRESETS') {
            setOption({
              screen: 'HOME',
              animating: true
            });
            dispatch(setOptionPressets('HOME'));

            document
              .querySelector('div.navigation-title.parent')
              .classList.remove('animation-move-title-top-two');

            document
              .querySelector('div.navigation-title.parent')
              .nextElementSibling.classList.remove(
                'animation-move-title-bottom'
              );

            document
              .querySelector('div.navigation-title.parent')
              .nextElementSibling.classList.add('animation-move-title-top');

            handleAddOpacityTitleInactive(pressetTitleSwiper);
            handleRemoveOpacityTitleActive(pressetTitleSwiper);

            document
              .querySelector('div.navigation-title.parent')
              .classList.add('animation-move-title-top-two');

            // document
            //   .querySelector('div.navigation-title.parent')
            //   .nextElementSibling.classList.add('animation-title-opacity-zero');

            clearSlides(pressetSwiper);
            clearSlides(pressetTitleSwiper);

            handleAddIncreseAnimation(pressetSwiper);

            handleAddLeaveAnimation(pressetSwiper);
            handleAddLeaveAnimation(pressetTitleSwiper);

            setTimeout(() => {
              setOption((prev) => ({
                ...prev,
                animating: false
              }));
            }, 200);
          }
        }
      },
      left() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESETS') {
            dispatch(setNextPreset());
          } else {
            dispatch(setOptionPressets('PRESSETS'));
            document
              .querySelector('div.navigation-title.parent')
              .classList.remove('animation-move-title-top-two');

            document
              .querySelector('div.navigation-title.parent')
              .nextElementSibling.classList.remove(
                'animation-move-title-bottom'
              );

            handleRemoveOpacityTitleInactive(pressetTitleSwiper);

            // document
            //   .querySelector('div.navigation-title.parent')
            //   .nextElementSibling.classList.remove('animation-title-opacity-zero');

            document
              .querySelector('div.navigation-title.parent')
              .nextElementSibling.classList.add('animation-move-title-bottom');

            clearSlides(pressetSwiper);
            clearSlides(pressetTitleSwiper);

            handleAddOpacityTitleActive(pressetTitleSwiper);
            handleAddDecreseAnimation(pressetSwiper);

            handleAddEnterAnimation(pressetSwiper);
            handleAddEnterAnimation(pressetTitleSwiper);

            setOption({
              screen: 'PRESETS',
              animating: true
            });
            setTimeout(() => {
              dispatch(setNextPreset());
              setOption((prev) => ({ ...prev, animating: false }));
            }, 250);
          }
        }
      },
      right() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESETS') {
            dispatch(setPrevPreset());
          } else {
            dispatch(setOptionPressets('PRESSETS'));
            document
              .querySelector('div.navigation-title.parent')
              .classList.remove('animation-move-title-top-two');
            //

            document
              .querySelector('div.navigation-title.parent')
              .nextElementSibling.classList.remove(
                'animation-move-title-bottom'
              );

            handleRemoveOpacityTitleInactive(pressetTitleSwiper);

            // document
            //   .querySelector('div.navigation-title.parent')
            //   .nextElementSibling.classList.remove('animation-title-opacity-zero');

            document
              .querySelector('div.navigation-title.parent')
              .nextElementSibling.classList.add('animation-move-title-bottom');

            clearSlides(pressetSwiper);
            clearSlides(pressetTitleSwiper);

            handleAddOpacityTitleActive(pressetTitleSwiper);
            handleAddDecreseAnimation(pressetSwiper);

            handleAddEnterAnimation(pressetSwiper);
            handleAddEnterAnimation(pressetTitleSwiper);

            setOption({
              screen: 'PRESETS',
              animating: true
            });
            setTimeout(() => {
              dispatch(setPrevPreset());
              setOption((prev) => ({ ...prev, animating: false }));
            }, 250);
          }
        }
      }
    },
    bubbleDisplay.visible
  );

  useEffect(() => {
    slideTo(presets.activeIndexSwiper);
  }, [presets.activeIndexSwiper, slideTo]);

  useEffect(() => {
    if (pressetTitleSwiper) {
      handleAddOpacityTitleInactive(pressetTitleSwiper);
      clearSlides(pressetTitleSwiper);
      handleAddLeaveAnimation(pressetTitleSwiper);
    }
  }, [pressetTitleSwiper]);

  useEffect(() => {
    if (pressetSwiper) {
      clearSlides(pressetSwiper);
      handleAddIncreseAnimation(pressetSwiper);
      handleAddLeaveAnimation(pressetSwiper);
    }
  }, [pressetSwiper]);

  useEffect(() => {
    dispatch(setOptionPressets('HOME'));
  }, []);

  return (
    <div className="preset-wrapper">
      {presets.defaultPresetIndex > -1 && (
        <>
          <Swiper
            onSwiper={setPressetsSwiper}
            slidesPerView={2.15}
            spaceBetween={0}
            initialSlide={presets.activeIndexSwiper}
            centeredSlides={true}
            allowTouchMove={false}
            ref={presetSwiperRef}
            onSlideChange={handlePresetSlideChange}
          >
            {presets.value.length &&
              presets.value.map((preset) => (
                <SwiperSlide key={preset.id}>
                  {() => (
                    <div>
                      <div className="pressets-conainer">
                        <div className="presset-item presset-active">
                          <div className="presset-icon">
                            <svg
                              width="166"
                              height="166"
                              viewBox="0 0 166 166"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="83"
                                cy="83"
                                r="80.5"
                                stroke="white"
                                strokeWidth="5"
                              />
                              <circle
                                cx="83"
                                cy="83"
                                r="10.6875"
                                fill="#F5C444"
                              />
                              <path
                                d="M83 83L124.562 41.4375"
                                stroke="#F5C444"
                                strokeWidth="5"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </SwiperSlide>
              ))}
            <SwiperSlide key="new">
              {() => (
                <div className="main-layout-content">
                  <div className="pressets-conainer">
                    <div className="presset-item presset-active">
                      <div className="presset-icon">
                        <svg
                          width="204"
                          height="204"
                          viewBox="0 0 204 204"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect width="204" height="204" fill="black" />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M104.745 99.2547V32H99.2551V99.2547H32V104.745H99.2551V172H104.745V104.745H172V99.2547H104.745Z"
                            fill="white"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </SwiperSlide>
          </Swiper>
          <Swiper
            style={{
              display: option.screen === 'PRESETS' ? 'title-opacity-zero' : ' '
            }}
            onSwiper={setPressetTitleSwiper}
            slidesPerView={2.15}
            spaceBetween={0}
            centeredSlides={true}
            initialSlide={presets.activeIndexSwiper}
            allowTouchMove={false}
            ref={titleSwiperRef}
            onSlideChange={handlePresetSlideChange}
            className={`title-swiper ${transitioning ? 'transitioning' : ''}`}
          >
            {presets.value.length &&
              presets.value.map((preset) => (
                <SwiperSlide key={preset.id}>
                  {() => <Title>{preset.name}</Title>}
                </SwiperSlide>
              ))}
            <SwiperSlide key="new">{() => <Title>New</Title>}</SwiperSlide>
          </Swiper>
          {option.screen === 'PRESETS' && (
            <Pagination
              page={presets.activeIndexSwiper}
              pages={presets.value.length + 1}
            />
          )}
        </>
      )}
    </div>
  );
}
