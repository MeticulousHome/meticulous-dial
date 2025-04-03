// Core modules imports are same as usual
import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide, SwiperRef } from 'swiper/react';
import { Pagination as PaginationSwiper } from 'swiper/modules';
import SwiperS from 'swiper';

import 'swiper/css';

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
  setActiveIndexSwiper,
  setNextPreset,
  setOptionPressets,
  setPrevPreset
} from '../store/features/preset/preset-slice';
import { RouteProps } from '../../navigation';
import '../../navigation/navigation.less';
import { ProfileImage } from './ProfileImage';
import {
  setScreen,
  setBubbleDisplay
} from '../store/features/screens/screens-slice';
import { circumference, getDashArray } from '../SettingNumerical/Gauge';
import { setWaitingForAction } from '../store/features/stats/stats-slice';
import { Circle, radius, transform } from './Circle';
import { TitleCircle } from './Title';
import { loadProfileData, startProfile } from '../../api/profile';
import { useSocket } from '../store/SocketManager';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useSettings } from '../../hooks/useSettings';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { styled } from 'styled-components';

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

const PresetTitle = styled.div<{
  $size: 'default' | 'small' | 'very-small';
  $temp?: boolean;
  $visible: boolean;
}>`
  position: absolute;
  z-index: 10;
  width: 100%;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;

  top: ${(props) => (props.$visible ? '-68px' : '-80px')};
  opacity: ${(props) => (props.$visible ? '1' : '0')};
  transition:
    top 180ms linear,
    opacity 150ms ease;

  font-size: ${(props) =>
    props.$size === 'default'
      ? '30px'
      : props.$size === 'small'
        ? '20px'
        : '17px'};
  font-weight: 400;

  color: ${(props) => (props.$temp ? '#e74d4d' : '#e0dcd0')};
  letter-spacing: -0.025em;

  white-space: nowrap;
`;

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
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const { data: globalSettings } = useSettings();

  const [animation, setAnimation] = useState<AnimationData>(initialValue);

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [option, setOption] = useState<{
    screen: 'HOME' | 'PRESSETS';
    animating: boolean;
  }>({
    screen: presets.value.length === 0 ? 'PRESSETS' : presets.option,
    animating: false
  });

  const [percentaje, setPercentaje] = useState(0);
  const [startCoffe, setStartCoffe] = useState(false);
  const ready = useRef(false);
  const currentScreen = useAppSelector((state) => state.screen.value);

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

  useEffect(() => {
    if (currentScreen === 'profileHome') {
      return;
    }
    animationInProgress.current = false;
  }, [currentScreen]);

  useEffect(() => {
    if (!shouldGoToIdle) return;

    dispatch(setScreen('idle'));
    dispatch(setBubbleDisplay({ visible: false, component: null }));
  }, [shouldGoToIdle]);

  useEffect(() => {
    if (option.animating == false) {
      return;
    }
    setTimeout(() => {
      setOption((prev) => ({
        ...prev,
        animating: false
      }));
    }, 300);
  }, [option.animating]);

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

    clearSlides(pressetSwiper);

    handleAddIncreseAnimation(pressetSwiper);

    handleAddLeaveAnimation(pressetSwiper);
  };

  const rotateLeft = () => {
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

        clearSlides(pressetSwiper);

        handleAddDecreseAnimation(pressetSwiper);

        handleAddEnterAnimation(pressetSwiper);

        setTimeout(() => {
          setOption((prev) => ({ ...prev, animating: false }));
        }, 300);
      }
    }
  };

  const rotateRight = () => {
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

        clearSlides(pressetSwiper);

        handleAddDecreseAnimation(pressetSwiper);

        handleAddEnterAnimation(pressetSwiper);

        setTimeout(() => {
          setOption((prev) => ({ ...prev, animating: false }));
        }, 300);
      }
    }
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
        if (globalSettings?.reverse_scrolling.home) {
          rotateRight();
        } else {
          rotateLeft();
        }
      },
      right() {
        if (globalSettings?.reverse_scrolling.home) {
          rotateLeft();
        } else {
          rotateRight();
        }
      }
    },
    bubbleDisplay.visible || option.animating
  );

  useEffect(() => {
    const index = presets.activeIndexSwiper;
    presetSwiperRef.current?.swiper.slideTo(index);
  }, [presets.activeIndexSwiper, presetSwiperRef.current]);

  useEffect(() => {
    if (pressetSwiper) {
      if (option.screen === 'HOME') {
        pressetSwiper.pagination.el.classList.add('bullet-hidden');
        clearSlides(pressetSwiper);
        handleAddIncreseAnimation(pressetSwiper);
        handleAddLeaveAnimation(pressetSwiper);
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
    if (profileHoverId === '-1') {
      return;
    }

    setOption((prev) => ({ ...prev, animating: false }));
    const myIndex = presets.value.findIndex((e) => e.id === profileHoverId);
    presetSwiperRef.current?.swiper.slideTo(myIndex);
    dispatch(setActiveIndexSwiper(myIndex));
    setOption({ screen: 'PRESSETS', animating: false });
  }, [profileHoverId, presetSwiperRef.current]);

  useEffect(() => {
    if (profileFocusId === '' || profileFocusId === undefined) {
      return;
    }
    try {
      focusProfileHandle();
    } catch {
      /* empty */
    }
  }, [profileFocusId]);

  if (!globalSettings) {
    return <LoadingScreen />;
  }

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
            speed={140}
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
                      <PresetTitle
                        $temp={preset.isTemporary}
                        $size={
                          preset.name.length > 40
                            ? 'very-small'
                            : preset.name.length > 30
                              ? 'small'
                              : 'default'
                        }
                        $visible={
                          option.screen === 'PRESSETS' && !transitioning
                        }
                      >
                        {preset.name.length > 70
                          ? `${preset.name.substring(0, 70)}...`
                          : preset.name}
                      </PresetTitle>
                      <ProfileImage preset={preset} />
                    </div>
                  )}
                </SwiperSlide>
              ))}
            <SwiperSlide key="new">
              {() => (
                <div style={{ display: 'block' }}>
                  <PresetTitle $size="default" $visible={true}>
                    New
                  </PresetTitle>
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
              )}
            </SwiperSlide>
          </Swiper>
        </>
      )}
    </div>
  );
}
