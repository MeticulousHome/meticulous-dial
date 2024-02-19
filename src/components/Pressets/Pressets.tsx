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
import './pressets.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  addPresetNewOne,
  setNextPreset,
  setOptionPressets,
  setPrevPreset
} from '../store/features/preset/preset-slice';
import { Title, RouteProps } from '../../navigation';
// import { Pagination } from './Pagination';
import '../../navigation/navigation.less';
import { ProfileImage } from './ProfileImage';

export function Pressets({ transitioning }: RouteProps): JSX.Element {
  const dispatch = useAppDispatch();
  const { presets } = useAppSelector((state) => state);
  const presetSwiperRef = useRef<SwiperRef | null>(null);
  const [pressetSwiper, setPressetsSwiper] = useState<SwiperS | null>(null);
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
            }, 280);
          }
        }
      },
      left() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESETS') {
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
              screen: 'PRESETS',
              animating: true
            });

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

            // setTimeout(() => {
            //   dispatch(setNextPreset());
            // }, 250);
            setTimeout(() => {
              setOption((prev) => ({ ...prev, animating: false }));
            }, 280);
          }
        }
      },
      right() {
        if (!transitioning) {
          if (!option.animating && option.screen === 'PRESETS') {
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
              screen: 'PRESETS',
              animating: true
            });

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

            // setTimeout(() => {
            //   dispatch(setPrevPreset());
            // }, 280);
            setTimeout(() => {
              setOption((prev) => ({ ...prev, animating: false }));
            }, 280);
          }
        }
      }
    },
    bubbleDisplay.visible || option.animating
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
      if (
        pressetSwiper &&
        pressetSwiper.pagination &&
        pressetSwiper.pagination.el
      ) {
        pressetSwiper.pagination.el.classList.add('bullet-hidden');
      }
      clearSlides(pressetSwiper);
      handleAddIncreseAnimation(pressetSwiper);
      handleAddLeaveAnimation(pressetSwiper);
    }
  }, [pressetSwiper]);

  useEffect(() => {
    dispatch(setOptionPressets('HOME'));
  }, []);

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

  return (
    <div className="preset-wrapper">
      {presets.defaultPresetIndex > -1 && (
        <>
          <Swiper
            onSwiper={setPressetsSwiper}
            slidesPerView={2.15}
            spaceBetween={120}
            initialSlide={presets.activeIndexSwiper}
            centeredSlides={true}
            allowTouchMove={false}
            ref={presetSwiperRef}
            onSlideChange={handlePresetSlideChange}
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
                        image="https://s3-alpha-sig.figma.com/img/3bec/1eb7/70a88356f139d75984f876b73138c7e9?Expires=1709510400&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=S0XSq-zY7CaJCUd0YAwRYhxcEt6sLz6i-1RnLiuMBxuKvykhQUgLhLtlFKITfpdAzzT1ldraecIiKixshyJWbAuANdQiviWRLtjPM5J~sY8sF38NK1wdawZ9oC8Lom3l41BiEBwqM-UEO7NeXIYZHMczDhWAc4mtxKsiyzQD60ymbDGFf0ClroI9kPuESSDJfm5A1398bGjsGPHlL~~4v0nsjSKVtqtTcHfAJ7EXQyg7JLClu56zxDW4zL5NlweZbHcQsPtCB4BoJpX9OnKF77ebSGIiEv1GUWzxTuZOvfJOsJmX4Q-AZ68xCREVp9eIYPLFRGbBoS7zjk77Dn0Wkw__"
                        borderColor="#A56751"
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
