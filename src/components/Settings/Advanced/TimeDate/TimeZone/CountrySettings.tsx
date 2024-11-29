import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { MOCK_TZ_JSON, TimezoneData } from './mockTzJson';
import { useEffect, useMemo, useState } from 'react';
import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { Option, TextContainer, Title } from './Timezone.styled';
import { setScreen } from '../../../../store/features/screens/screens-slice';
import { setCountry } from '../../../../store/features/settings/settings-slice';

export const filterTimezonesByLetter = (data: TimezoneData, letter: string) => {
  return Object.entries(data)
    .filter(([country]) => country !== 'ETC' && country !== 'LINKS')
    .filter(
      ([country]) => country.charAt(0).toUpperCase() === letter.toUpperCase()
    )
    .map(([country, timezones]) => ({ [country]: timezones }));
};

export default function CountrySettings() {
  const [swiper, setSwiper] = useState(null);
  const [animationStyle, setAnimationStyle] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const countryLetter = useAppSelector((state) => state.settings.countryLetter);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const dispatch = useAppDispatch();

  const availableCountries = useMemo(
    () => filterTimezonesByLetter(MOCK_TZ_JSON, countryLetter),
    [countryLetter]
  );

  useEffect(() => {
    if (swiper) swiper.slideTo(activeIndex);
  }, [activeIndex, swiper]);

  const slides = useMemo(
    () => [
      <SwiperSlide className="presset-option-item" key={`option-back`}>
        <div className={`${animationStyle}`}>
          <Option isactive={activeIndex === 0}>Back</Option>
        </div>
      </SwiperSlide>,
      ...availableCountries.map((country, index) => {
        const [name] = Object.keys(country);
        const isactive = index + 1 === activeIndex;
        return (
          <SwiperSlide
            className="presset-option-item"
            key={`option-${index + 1}`}
          >
            <div className={`${animationStyle}`}>
              <TextContainer neednoWrap={name.length > 11} isactive={isactive}>
                <Option isactive={isactive}>{name}</Option>
              </TextContainer>
            </div>
          </SwiperSlide>
        );
      })
    ],
    [activeIndex, animationStyle]
  );

  useHandleGestures(
    {
      left() {
        const nextActiveIndex = activeIndex - 1;
        if (nextActiveIndex < 0) return;
        console.log('left, nextActiveIndex', nextActiveIndex);
        setActiveIndex(nextActiveIndex);
      },
      right() {
        const nextActiveIndex = activeIndex + 1;
        if (nextActiveIndex >= slides.length) return;
        setActiveIndex(nextActiveIndex);
        console.log('rigth, nextActiveIndex', nextActiveIndex);
      },
      pressDown() {
        if (activeIndex === 0) {
          dispatch(setScreen('selectLetterCountry'));
        } else {
          dispatch(setCountry(availableCountries[activeIndex - 1]));
          dispatch(setScreen('timeZoneSettings'));
        }
      }
    },
    bubbleDisplay.visible
  );

  return (
    <>
      <Title>countries</Title>
      <div className="presset-container">
        <div className="presset-options">
          <Swiper
            onSwiper={setSwiper}
            slidesPerView={9}
            allowTouchMove={false}
            direction="vertical"
            autoHeight={false}
            centeredSlides={true}
            initialSlide={0}
            onSlideNextTransitionStart={() => {
              setAnimationStyle('animation-next');
            }}
            onSlidePrevTransitionStart={() =>
              setAnimationStyle('animation-prev')
            }
            onSlideChangeTransitionEnd={() => setAnimationStyle('')}
          >
            {slides}
          </Swiper>
        </div>
        <div className="fade fade-top"></div>
        <div className="fade fade-bottom"></div>
      </div>
    </>
  );
}
