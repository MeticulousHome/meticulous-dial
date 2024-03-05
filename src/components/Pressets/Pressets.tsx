// Core modules imports are same as usual
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import SwiperS, { Pagination as PaginationSwiper } from 'swiper';

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
import './pressets.less';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  addPresetNewOne,
  resetActiveSetting,
  setNextPreset,
  setOptionPressets,
  setPrevPreset
} from '../store/features/preset/preset-slice';
import { Title, RouteProps } from '../../navigation';
// import { Pagination } from './Pagination';
import '../../navigation/navigation.less';
import { ProfileImage } from './ProfileImage';
import { setScreen } from '../store/features/screens/screens-slice';
import { generateSimplePayload } from '../../utils/preheat';
import { useSocket } from '../store/SocketManager';
import { KIND_PROFILE, LCD_EVENT_EMIT } from '../../constants';
import {
  circumference,
  getDashArray,
  getValue
} from '../SettingNumerical/Gauge';
import styled, { RuleSet, css, keyframes } from 'styled-components';

const radius = 237;
const transform = `rotate(90, ${radius}, ${radius})`;

const dashValue = getDashArray(0, 100);
const dashFinalValues = getDashArray(0, 100);

// let scroll = keyframes`
//       0% {
//         troke-dashoffset: ${dashValue}
//       }
//       100% {
//         troke-dashoffset: ${dashFinalValues}
//       }`;

// const scrollAnimation = () => css`
//   ${scroll} 2s ease-out forwards
// `;

// const SlideTrackContainer = styled.circle``;

const Circle = React.memo(
  ({ value1, value2 }: { value1: number; value2: number; timing: number }) => {
    const value1Ref = useRef(getDashArray(value1, 100));
    const value2Ref = useRef(getDashArray(value2, 100));

    const scroll = keyframes`
    0% {
      stroke-dasharray: ${value1Ref.current}
    }
    100% {
      stroke-dasharray: ${value2Ref.current}
    }`;

    const scrollAnimation = () => css`
      ${scroll} ${value2 > 0
        ? (value2 - value1) * 20
        : value1 * 30}ms linear forwards
    `;

    const SlideTrackContainer = styled.circle`
      animation: ${scrollAnimation};
    `;

    return (
      <SlideTrackContainer
        data-counter={value1}
        id="bar"
        cx={radius}
        cy={radius - 3}
        r={radius}
        fill="transparent"
        // strokeDasharray={getDashArray(100, 100)}
        strokeDashoffset="0"
        strokeLinecap="butt"
        transform={transform}
      />
    );
  }
);

export default Circle;

export function Pressets({ transitioning }: RouteProps): JSX.Element {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const { presets } = useAppSelector((state) => state);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [pressetSwiper, setPressetsSwiper] = useState<SwiperS | null>(null);
  const [pressetTitleSwiper, setPressetTitleSwiper] = useState(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);
  const circleOne = useRef<SVGCircleElement>(null);
  const intervalReturn = useRef(null);
  const animationInProgress = useRef(false);

  const [animation, setAnimation] = useState<{
    key: number;
    value1: number;
    value2: number;
    timming: number;
  }>({
    key: 1,
    value1: 0,
    value2: 0,
    timming: 0
  });

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [option, setOption] = useState<{
    screen: 'HOME' | 'PRESSETS';
    animating: boolean;
  }>({
    screen: presets.value.length === 0 ? 'PRESSETS' : 'HOME',
    animating: false
  });

  const navigationTitleParentRef = useRef<HTMLDivElement | null>(null);
  const navigationTitleRef = useRef<HTMLDivElement | null>(null);
  const pressetsTitleContentRef = useRef<HTMLDivElement | null>(null);
  const [percentaje, setPercentaje] = useState(0);
  const percentajeRef = useRef(0);
  const [startCoffe, setStartCoffe] = useState(false);
  const ready = useRef(false);

  // console.log('percentaje', percentaje);

  const pressetTitleContenExistValidation = useCallback(() => {
    if (!pressetsTitleContentRef.current) {
      const element = document.getElementById('pressets-title-content');

      if (!element) return false;

      pressetsTitleContentRef.current = element as HTMLDivElement;
    }
    return true;
  }, []);

  const navigationTitleExistValidation = useCallback((): boolean => {
    if (!navigationTitleRef.current) {
      if (!navigationTitleParentExistValidation()) return false;

      const element: HTMLDivElement = navigationTitleParentRef.current
        .nextElementSibling as HTMLDivElement;

      if (!element || !element.classList.contains('navigation-title'))
        return false;

      navigationTitleRef.current = element;
    }

    return true;
  }, []);

  const navigationTitleParentExistValidation = useCallback((): boolean => {
    if (!navigationTitleParentRef.current) {
      const element: HTMLDivElement = document.querySelector(
        'div.navigation-title.parent'
      );

      if (!element) return false;

      navigationTitleParentRef.current = element;
    }

    return true;
  }, []);

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
        switch (option.screen) {
          case 'HOME': {
            if (ready.current) return;

            circleOne.current = document.getElementById(
              'bar'
            ) as unknown as SVGCircleElement;

            // console.log('Current VALUES');

            clearInterval(intervalReturn.current);
            intervalReturn.current = null;

            circleOne.current.onanimationend = (e) => {
              setStartCoffe(true);
            };

            const valueACTUAL = Math.round(
              (+getComputedStyle(circleOne.current)
                .strokeDasharray.split(',')[0]
                .replace('px', '') /
                circumference) *
                100
            );

            // console.log('valueACTUAL', valueACTUAL);

            return setPercentaje((prev) => {
              percentajeRef.current =
                prev === 0 && valueACTUAL > 0 ? valueACTUAL : prev + 1;

              if (!animationInProgress.current) {
                // console.log('set animation');

                for (const [, dato] of circleOne.current.classList.entries()) {
                  circleOne.current.classList.remove(dato);
                }
                setAnimation((prev2) => ({
                  key: prev2.key + 1,
                  value1:
                    prev === 0 && valueACTUAL > 0 ? valueACTUAL : prev + 1,
                  value2: 100,
                  timming: 1000
                }));
              }

              animationInProgress.current = true;

              return prev === 0 && valueACTUAL > 0 ? valueACTUAL : prev + 1;
            });
          }
          case 'PRESSETS': {
            if (presets.activeIndexSwiper === presets.value.length) {
              if (navigationTitleExistValidation()) {
                navigationTitleRef.current.classList.add('title-bottom');
              }
              return dispatch(addPresetNewOne());
            }

            if (
              pressetSwiper &&
              pressetSwiper.pagination &&
              pressetSwiper.pagination.el
            ) {
              pressetSwiper.pagination.el.classList.add('bullet-hidden');
            }

            setOption({
              screen: 'HOME',
              animating: true
            });

            if (pressetTitleContenExistValidation()) {
              pressetsTitleContentRef.current.classList.remove(
                'animation-pressets-content-bottom'
              );
              pressetsTitleContentRef.current.classList.remove(
                'animation-pressets-content-top'
              );
              pressetsTitleContentRef.current.classList.add(
                'animation-pressets-content-top'
              );
            }

            handleRemoveOpacityTitleActive(pressetTitleSwiper);
            handleAddOpacityTitleInactive(pressetTitleSwiper);

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
            break;
          }
          default:
            break;
        }
      },
      left() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESSETS') {
            dispatch(setNextPreset());
          } else {
            if (
              pressetSwiper &&
              pressetSwiper.pagination &&
              pressetSwiper.pagination.el
            ) {
              pressetSwiper.pagination.el.classList.remove('bullet-hidden');
            }

            setOption({
              screen: 'PRESSETS',
              animating: true
            });

            if (!navigationTitleExistValidation()) {
              navigationTitleParentRef.current = null;
            }

            if (pressetTitleContenExistValidation()) {
              pressetsTitleContentRef.current.classList.remove(
                'animation-pressets-content-bottom'
              );
              pressetsTitleContentRef.current.classList.remove(
                'animation-pressets-content-top'
              );
              pressetsTitleContentRef.current.classList.add(
                'animation-pressets-content-bottom'
              );
            }

            handleRemoveOpacityTitleInactive(pressetTitleSwiper);

            clearSlides(pressetSwiper);
            clearSlides(pressetTitleSwiper);

            handleAddOpacityTitleActive(pressetTitleSwiper);
            handleAddDecreseAnimation(pressetSwiper);

            handleAddEnterAnimation(pressetSwiper);
            handleAddEnterAnimation(pressetTitleSwiper);

            setTimeout(() => {
              setOption((prev) => ({ ...prev, animating: false }));
            }, 300);
          }
        }
      },
      right() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESSETS') {
            dispatch(setPrevPreset());
          } else {
            if (
              pressetSwiper &&
              pressetSwiper.pagination &&
              pressetSwiper.pagination.el
            ) {
              pressetSwiper.pagination.el.classList.remove('bullet-hidden');
            }

            setOption({
              screen: 'PRESSETS',
              animating: true
            });

            if (!navigationTitleExistValidation()) {
              navigationTitleParentRef.current = null;
            }

            if (pressetTitleContenExistValidation()) {
              pressetsTitleContentRef.current.classList.remove(
                'animation-pressets-content-bottom'
              );
              pressetsTitleContentRef.current.classList.remove(
                'animation-pressets-content-top'
              );
              pressetsTitleContentRef.current.classList.add(
                'animation-pressets-content-bottom'
              );
            }

            handleRemoveOpacityTitleInactive(pressetTitleSwiper);

            clearSlides(pressetSwiper);
            clearSlides(pressetTitleSwiper);

            handleAddOpacityTitleActive(pressetTitleSwiper);
            handleAddDecreseAnimation(pressetSwiper);

            handleAddEnterAnimation(pressetSwiper);
            handleAddEnterAnimation(pressetTitleSwiper);

            setTimeout(() => {
              setOption((prev) => ({ ...prev, animating: false }));
            }, 0);
          }
        }
      },
      longEncoder() {
        if (option.screen === 'HOME') {
          dispatch(resetActiveSetting());
          dispatch(setScreen('pressetSettings'));
        }
      }
    },
    bubbleDisplay.visible || option.animating
  );

  useEffect(() => {
    slideTo(presets.activeIndexSwiper);
  }, [presets.activeIndexSwiper, slideTo]);

  useEffect(() => {
    if (pressetTitleSwiper && pressetSwiper) {
      if (option.screen === 'HOME') {
        pressetSwiper.pagination.el.classList.add('bullet-hidden');
        clearSlides(pressetSwiper);
        handleAddIncreseAnimation(pressetSwiper);
        handleAddLeaveAnimation(pressetSwiper);

        clearSlides(pressetTitleSwiper);
        handleAddOpacityTitleInactive(pressetTitleSwiper);
        handleAddLeaveAnimation(pressetTitleSwiper);

        if (pressetTitleContenExistValidation()) {
          pressetsTitleContentRef.current.classList.add(
            'animation-pressets-content-top'
          );
        }
      } else {
        clearSlides(pressetTitleSwiper);
        handleAddLeaveAnimation(pressetTitleSwiper);
      }
    }
  }, [pressetTitleSwiper, pressetSwiper]);

  useEffect(() => {
    if (presets.value.length > 5 || presets.value.length <= 5) {
      if (
        pressetSwiper &&
        pressetSwiper.pagination &&
        pressetSwiper.pagination.el
      ) {
        pressetSwiper.pagination.destroy();
        pressetSwiper.pagination.init();
        pressetSwiper.pagination.update();
      }
    }
  }, [presets.value.length]);

  useEffect(() => {
    dispatch(setOptionPressets(option.screen));
  }, [option.screen]);

  useEffect(() => {
    circleOne.current = document.getElementById(
      'bar'
    ) as unknown as SVGCircleElement;

    if (circleOne.current) {
      if (percentaje > 0) {
        intervalReturn.current = setInterval(() => {
          // console.log('CLEAR');

          for (const [, dato] of circleOne.current.classList.entries()) {
            circleOne.current.classList.remove(dato);
          }

          setStartCoffe(false);
          const valueACTUAL = Math.round(
            (+getComputedStyle(circleOne.current)
              .strokeDasharray.split(',')[0]
              .replace('px', '') /
              circumference) *
              100
          );
          animationInProgress.current = false;

          if (ready.current) return;

          setPercentaje(() => {
            setAnimation((prev) => ({
              key: prev.key + 1,
              value1: valueACTUAL,
              value2: 0,
              timming: 0
            }));

            return 0;
          });
        }, 300);
      }

      // const dashValue = getDashArray(percentaje, 100);

      if (percentaje > 0) {
        percentajeRef.current = percentaje;
      }

      // for (const [, dato] of circleOne.current.classList.entries()) {
      //   circleOne.current.classList.remove(dato);
      // }
      // circleOne.current.style.strokeDasharray = `${dashValue.toString()}`;
    }

    return () => {
      clearInterval(intervalReturn.current);
      intervalReturn.current = null;
    };
  }, [percentaje]);

  useEffect(() => {
    if (startCoffe) {
      ready.current = true;
      console.log('INICIA COFFEEE');
      dispatch(setScreen('barometer'));
    }
  }, [startCoffe]);

  return (
    <div className="preset-wrapper">
      <div className="cicle-container">
        <svg id="svg" width="460" height="460" viewBox="-1 -2 480 480">
          <circle
            cx={radius}
            cy={radius - 3}
            r={radius}
            fill="transparent"
            strokeDasharray={getDashArray(0, 100)}
            strokeDashoffset="0"
            transform={transform}
          ></circle>

          <Circle
            timing={animation.timming}
            key={animation.key}
            value1={animation.value1}
            value2={animation.value2}
          />
        </svg>
      </div>
      {presets.defaultPresetIndex > -1 && (
        <>
          <Swiper
            onSwiper={setPressetsSwiper}
            slidesPerView={2.15}
            spaceBetween={79}
            initialSlide={presets.activeIndexSwiper}
            centeredSlides={true}
            allowTouchMove={false}
            ref={presetSwiperRef}
            onSlideChange={(e) => {
              clearSlides(e);
              handlePresetSlideChange(e);
            }}
            modules={[PaginationSwiper]}
            pagination={{
              dynamicBullets: presets.value.length > 5,
              bulletActiveClass: 'swiper-pagination-bullet-active',
              bulletClass: 'swiper-pagination-bullet'
            }}
          >
            {presets.value.length &&
              presets.value.map((preset) => (
                <SwiperSlide key={preset.id}>
                  {() => (
                    <div>
                      <ProfileImage
                        image={preset.image}
                        borderColor={preset.borderColor}
                      />
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
            onSwiper={setPressetTitleSwiper}
            slidesPerView={2.15}
            spaceBetween={79}
            centeredSlides={true}
            initialSlide={presets.activeIndexSwiper}
            allowTouchMove={false}
            ref={titleSwiperRef}
            onSlideChange={(e) => {
              clearSlides(e);
              handlePresetSlideChange(e);
            }}
            className={`title-swiper ${transitioning ? 'transitioning' : ''}`}
          >
            {presets.value.length &&
              presets.value.map((preset) => (
                <SwiperSlide key={preset.id}>
                  {() => (
                    <Title customClass="presset-title-top">{preset.name}</Title>
                  )}
                </SwiperSlide>
              ))}
            <SwiperSlide key="new">
              {() => <Title customClass="presset-title-top">New</Title>}
            </SwiperSlide>
          </Swiper>
          {/* {option.screen === 'PRESETS' && (
            <Pagination
              page={presets.activeIndexSwiper}
              pages={presets.value.length + 1}
            />
          )} */}
        </>
      )}
    </div>
  );
}
