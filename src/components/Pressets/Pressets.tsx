// Core modules imports are same as usual
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { circumference, getDashArray } from '../SettingNumerical/Gauge';
import { setWaitingForAction } from '../store/features/stats/stats-slice';
import { Circle, radius, transform } from './Circle';
import { TitleCircle } from './Title';
import { getDeviceInfo } from '../store/features/settings/settings-slice';
import { loadProfileData, startProfile } from '../../api/profile';
import { Profile } from 'meticulous-typescript-profile';

interface AnimationData {
  circlekey: number;
  titlekey: number;
  strokeDashValueInitial: number;
  strokeDashValueEnd: number;
  fillInitial: number;
  fillEnd: number;
  titleOpacityInitial: number;
  titleOpacityEnd: number;
  timeFunc: 'linear' | 'ease-in';
  extraDelay: number;
}

const initialValue: AnimationData = {
  circlekey: 1,
  titlekey: 20,
  strokeDashValueInitial: 0,
  strokeDashValueEnd: 0,
  fillInitial: 0.0,
  fillEnd: 0.0,
  titleOpacityEnd: 0,
  titleOpacityInitial: 0,
  timeFunc: 'linear' as 'linear' | 'ease-in',
  extraDelay: 500
};

export function Pressets({ transitioning }: RouteProps): JSX.Element {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const { presets, screen } = useAppSelector((state) => state);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [pressetSwiper, setPressetsSwiper] = useState<SwiperS | null>(null);
  const [pressetTitleSwiper, setPressetTitleSwiper] = useState(null);
  const titleSwiperRef = useRef<SwiperRef | null>(null);
  const circleOne = useRef<SVGCircleElement>(null);
  const animationInProgress = useRef(false);

  const [animation, setAnimation] = useState<AnimationData>(initialValue);

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
  const [startCoffe, setStartCoffe] = useState(false);
  const ready = useRef(false);

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
      pressDown() {
        switch (option.screen) {
          case 'HOME': {
            if (ready.current) return;

            circleOne.current = document.getElementById(
              'bar'
            ) as unknown as SVGCircleElement;

            circleOne.current.onanimationend = () => {
              setStartCoffe(true);
            };

            const currentStrokeDashValue = Math.round(
              (+getComputedStyle(circleOne.current)
                .strokeDasharray.split(',')[0]
                .replace('px', '') /
                circumference) *
                100
            );

            return setPercentaje((prev) => {
              if (!animationInProgress.current) {
                console.log('update animation');
                setAnimation((prev2) => ({
                  circlekey: prev2.circlekey + 1 > 10 ? 0 : prev2.circlekey + 1,
                  titlekey: prev2.titlekey + 1 > 30 ? 20 : prev2.titlekey + 1,
                  strokeDashValueInitial:
                    prev === 0 && currentStrokeDashValue > 0
                      ? currentStrokeDashValue
                      : Math.min(prev + 1, 99),
                  strokeDashValueEnd: 100,
                  fillInitial: currentStrokeDashValue / 100,
                  fillEnd: 0.7,
                  titleOpacityEnd: 0,
                  titleOpacityInitial: 0,
                  timeFunc: 'ease-in',
                  extraDelay: 600
                }));
              }

              animationInProgress.current = true;

              return prev === 0 && currentStrokeDashValue > 0
                ? currentStrokeDashValue
                : prev + 1;
            });

            break;
          }

          default:
            break;
        }
      },
      pressUp() {
        switch (option.screen) {
          case 'HOME': {
            if (ready.current) return;

            circleOne.current = document.getElementById(
              'bar'
            ) as unknown as SVGCircleElement;

            setStartCoffe(false);

            const currentStrokeDashValue = Math.round(
              (+getComputedStyle(circleOne.current)
                .strokeDasharray.split(',')[0]
                .replace('px', '') /
                circumference) *
                100
            );

            setPercentaje(() => {
              if (animationInProgress.current) {
                setAnimation((prev) => ({
                  circlekey: prev.circlekey + 1 > 10 ? 0 : prev.circlekey + 1,
                  titlekey: prev.titlekey + 1 > 30 ? 20 : prev.titlekey + 1,
                  strokeDashValueInitial: currentStrokeDashValue,
                  strokeDashValueEnd: 0,
                  fillInitial: currentStrokeDashValue / 100,
                  fillEnd: 0.0,
                  titleOpacityInitial: 1,
                  titleOpacityEnd: 0,
                  timeFunc: 'ease-in',
                  extraDelay: 100
                }));

                animationInProgress.current = false;
              }

              return 0;
            });
            break;
          }
        }
      },
      click() {
        switch (option.screen) {
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
            }, 300);
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
            setAnimation(initialValue);
            setPercentaje(0);
            animationInProgress.current = false;

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
            setAnimation(initialValue);
            setPercentaje(0);
            animationInProgress.current = false;

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
        circleOne.current.onanimationend = () => {
          setStartCoffe(true);
        };
      }
    }
  }, [percentaje]);

  useEffect(() => {
    const start = async () => {
      if (startCoffe) {
        ready.current = true;
        dispatch(setWaitingForAction(true));
        const preset = {
          name: presets.activePreset.name,
          settings: (presets.activePreset?.settings || []).filter(
            (item) => item.id !== -1 && item.id !== -2
          )
        };

        if (preset.settings.length === 0) return;

        const payload = generateSimplePayload({
          presset: preset as any,
          action: 'to_play'
        });

        const data = await loadProfileData(payload as Profile);

        if (data) await startProfile();

        dispatch(setScreen('barometer'));
      }
    };

    start();
  }, [startCoffe]);

  useEffect(() => {
    dispatch(setWaitingForAction(false));
    dispatch(getDeviceInfo());
  }, []);

  useEffect(() => {
    return () => {
      if (
        presets.activeIndexSwiper === presets.value.length &&
        screen.prev === 'pressets'
      ) {
        dispatch(setPrevPreset());
      }
    };
  }, [presets.activeIndexSwiper, presets.value.length, screen.prev]);

  return (
    <div className="preset-wrapper">
      <div className="cicle-container">
        <div
          style={{
            position: 'relative'
          }}
        >
          <TitleCircle
            key={animation.titlekey}
            value1={animation.strokeDashValueInitial}
            value2={animation.strokeDashValueEnd}
            titleOpacityEnd={animation.titleOpacityEnd}
            titleOpacityInitial={animation.titleOpacityInitial}
          />
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

            {option.screen === 'HOME' && (
              <Circle
                key={animation.circlekey}
                timeFunc={animation.timeFunc}
                fillEnd={animation.fillEnd}
                fillInitial={animation.fillInitial}
                strokeInitialValue={animation.strokeDashValueInitial}
                strokeEndValue={animation.strokeDashValueEnd}
                extraDelay={animation.extraDelay}
              />
            )}
          </svg>
        </div>
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
                <SwiperSlide key={preset.id.toString()}>
                  {() => (
                    <div>
                      <ProfileImage preset={preset} />
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
                <SwiperSlide key={preset.id.toString()}>
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
