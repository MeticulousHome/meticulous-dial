import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { Option, TextContainer, Title } from './Timezone.styled';
import { setScreen } from '../../../../store/features/screens/screens-slice';
import { setCountry } from '../../../../store/features/settings/settings-slice';
import { getTimezoneRegion, isAPIError } from '../../../../../api/api';
import { Regions } from '@meticulous-home/espresso-api';

export default function CountrySettings() {
  const [swiper, setSwiper] = useState(null);
  const [animationStyle, setAnimationStyle] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const [availableCountries, setAvailableCountries] = useState<Regions>({
    countries: []
  });

  const countryLetter = useAppSelector((state) => state.settings.countryLetter);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (swiper) swiper.slideTo(activeIndex);
  }, [activeIndex, swiper]);

  useEffect(() => {
    console.log('requesting countries');
    getTimezoneRegion('countries', countryLetter.toLowerCase()).then(
      (result) => {
        setAvailableCountries(isAPIError(result) ? { countries: [] } : result);
      }
    );
  }, []);

  const slides = useMemo(() => {
    console.log(availableCountries);
    if (availableCountries['countries'].length == 0) {
      return [
        <SwiperSlide className="presset-option-item" key={`option-back`}>
          <div className={`${animationStyle}`}>
            <Option isactive={activeIndex === 0}>Back</Option>
          </div>
        </SwiperSlide>
      ];
    } else {
      return [
        <SwiperSlide className="presset-option-item" key={`option-back`}>
          <div className={`${animationStyle}`}>
            <Option isactive={activeIndex === 0}>Back</Option>
          </div>
        </SwiperSlide>,
        ...availableCountries['countries'].map((country, index) => {
          const isactive = index + 1 === activeIndex;
          return (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index + 1}`}
            >
              <div className={`${animationStyle}`}>
                <TextContainer
                  neednoWrap={country.length > 11}
                  isactive={isactive}
                >
                  <Option isactive={isactive}>{country}</Option>
                </TextContainer>
              </div>
            </SwiperSlide>
          );
        })
      ];
    }
  }, [activeIndex, animationStyle, availableCountries]);

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
          dispatch(setCountry(availableCountries.countries[activeIndex - 1]));
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
