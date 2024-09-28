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
  handlePresetSlideChange
} from '../../utils/preset';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import './pressets.less';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  cleanupInternalProfile,
  resetActiveSetting,
  setActiveIndexSwiper,
  setNextPreset,
  setOptionPressets,
  setPrevPreset
} from '../store/features/preset/preset-slice';
import { Title, RouteProps } from '../../navigation';
import '../../navigation/navigation.less';
import { ProfileImage } from './ProfileImage';
import { setScreen } from '../store/features/screens/screens-slice';
import { circumference, getDashArray } from '../SettingNumerical/Gauge';
import { setWaitingForAction } from '../store/features/stats/stats-slice';
import { Circle, radius, transform } from './Circle';
import { TitleCircle } from './Title';
import {
  fetchSettigns,
  getDeviceInfo
} from '../store/features/settings/settings-slice';
import { loadProfileData, startProfile } from '../../api/profile';
import { useSocket } from '../store/SocketManager';

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
  const dispatch = useAppDispatch();
  const presets = useAppSelector((state) => state.presets);
  const profileHoverId = useAppSelector((state) => state.presets.profileHover);
  const profileFocusId = useAppSelector((state) => state.presets.profileFocus);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [pressetSwiper, setPressetsSwiper] = useState<SwiperS | null>(null);
  const circleOne = useRef<SVGCircleElement>(null);
  const animationInProgress = useRef(false);
  const socket = useSocket();

  const [animation, setAnimation] = useState<AnimationData>(initialValue);

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [option, setOption] = useState<{
    screen: 'HOME' | 'PRESSETS';
    animating: boolean;
  }>({
    screen: presets.value.length === 0 ? 'PRESSETS' : presets.option,
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

  const sendCurrentPressetId = (index: number, focus: boolean) => {
    const mPresset = presets.value[index];
    if (mPresset === undefined) {
      return;
    }

    socket.emit('profileHover', {
      id: mPresset.id,
      from: 'dial',
      type: focus ? 'focus' : 'scroll'
    });
  };

  useEffect(() => {
    setOption({ screen: presets.option, animating: false });
  }, [presets.option]);

  const focusProfileHandle = () => {
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

    clearSlides(pressetSwiper);

    handleAddIncreseAnimation(pressetSwiper);

    handleAddLeaveAnimation(pressetSwiper);

    setTimeout(() => {
      setOption((prev) => ({
        ...prev,
        animating: false
      }));
    }, 300);
  };

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
          case 'PRESSETS': {
            if (presets.activeIndexSwiper === presets.value.length) {
              if (navigationTitleExistValidation()) {
                navigationTitleRef.current.classList.add('title-bottom');
              }

              return dispatch(setScreen('defaultProfiles'));
            }

            if (!pressetSwiper) {
              console.log('No swiper loaded, aborting gesture!');
              return;
            }

            focusProfileHandle();
            sendCurrentPressetId(presets.activeIndexSwiper, true);
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
      left() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESSETS') {
            dispatch(setNextPreset());
            sendCurrentPressetId(presets.activeIndexSwiper + 1, false);
          } else {
            setAnimation(initialValue);
            setPercentaje(0);
            animationInProgress.current = false;

            if (!pressetSwiper) {
              console.log('No swiper loaded, aborting gesture!');
              return;
            }

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

            clearSlides(pressetSwiper);

            handleAddDecreseAnimation(pressetSwiper);

            handleAddEnterAnimation(pressetSwiper);

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
            sendCurrentPressetId(presets.activeIndexSwiper - 1, false);
          } else {
            setAnimation(initialValue);
            setPercentaje(0);
            animationInProgress.current = false;

            if (!pressetSwiper) {
              console.log('No swiper loaded, aborting gesture!');
              return;
            }
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

            clearSlides(pressetSwiper);

            handleAddDecreseAnimation(pressetSwiper);

            handleAddEnterAnimation(pressetSwiper);

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
    const index = presets.activeIndexSwiper;
    presetSwiperRef.current?.swiper.slideTo(index);
  }, [presets.activeIndexSwiper]);

  useEffect(() => {
    if (pressetSwiper) {
      if (option.screen === 'HOME') {
        pressetSwiper.pagination.el.classList.add('bullet-hidden');
        clearSlides(pressetSwiper);
        handleAddIncreseAnimation(pressetSwiper);
        handleAddLeaveAnimation(pressetSwiper);

        if (pressetTitleContenExistValidation()) {
          pressetsTitleContentRef.current.classList.add(
            'animation-pressets-content-top'
          );
        }
      }
    }
  }, [pressetSwiper]);

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
        animationInProgress.current = false;
        dispatch(setWaitingForAction(true));
        const profile = cleanupInternalProfile({ ...presets.activePreset });
        const data = await loadProfileData(profile);
        if (data) {
          await startProfile();
        }
      }
    };

    start();
  }, [startCoffe]);

  useEffect(() => {
    dispatch(setWaitingForAction(false));
    dispatch(fetchSettigns());
    dispatch(getDeviceInfo());
  }, []);

  useEffect(() => {
    if (profileHoverId === '-1') {
      return;
    }

    setOption((prev) => ({ ...prev, animating: false }));
    const myIndex = presets.value.findIndex((e) => e.id === profileHoverId);
    presetSwiperRef.current.swiper.slideTo(myIndex);
    dispatch(setActiveIndexSwiper(myIndex));
    setOption({ screen: 'PRESSETS', animating: false });
  }, [profileHoverId]);

  useEffect(() => {
    if (profileFocusId === '' || profileFocusId === undefined) {
      return;
    }
    try {
      focusProfileHandle();
    } catch (e) {
      /* empty */
    }
  }, [profileFocusId]);

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
              presets.value.map((preset, index) => (
                <SwiperSlide
                  key={
                    preset.isTemporary
                      ? `temp_${index}_`
                      : `${preset.id.toString()}_${index}_`
                  }
                >
                  {() => (
                    <div>
                      <div className={`title-swiper`}>
                        {(option.screen === 'PRESSETS' || transitioning) && (
                          <div
                            className={`presset-title-top 
                              ${preset.isTemporary ? 'presset-title-temp' : ''} 
                              ${
                                preset.name.length > 30
                                  ? 'presset-title-small'
                                  : ''
                              }
                              ${
                                preset.name.length > 40
                                  ? 'presset-title-very-small'
                                  : ''
                              }
                        `}
                          >
                            {preset.name.length > 70
                              ? `${preset.name.substring(0, 70)}...`
                              : preset.name}
                          </div>
                        )}
                      </div>
                      <ProfileImage preset={preset} />
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          justifyContent: 'space-between'
                        }}
                        key="labels"
                      >
                        {preset.isLast ? (
                          <div key="last_label" style={{ fontSize: '10px' }}>
                            last
                          </div>
                        ) : null}
                        {preset.isTemporary ? (
                          <div
                            key="temporary_label"
                            style={{ fontSize: '10px' }}
                          >
                            temporary
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </SwiperSlide>
              ))}
            <SwiperSlide key="new">
              {() => (
                <div style={{ display: 'block' }}>
                  <div
                    className={`title-swiper ${
                      transitioning ? 'transitioning' : ''
                    }`}
                  >
                    <div className={'presset-title-top'}>New</div>
                  </div>
                  <div className="presset-image">
                    <div className="presset-icon">
                      <svg
                        width="204"
                        height="204"
                        viewBox="0 0 204 204"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
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
              )}
            </SwiperSlide>
          </Swiper>
        </>
      )}
    </div>
  );
}
