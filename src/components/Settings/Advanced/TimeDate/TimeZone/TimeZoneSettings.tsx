import { useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../../../../store/features/screens/screens-slice';
import { Option, TextContainer, Title } from './Timezone.styled';
import { getTimezoneRegion, setTimezone } from '../../../../../api/api';
import { styled } from 'styled-components';
import { Regions } from '@meticulous-home/espresso-api';

const TimeZone = styled.span<{ isactive?: boolean }>`
  color: #f3f4f6;
  font-size: 24px;
  visibility: ${(props) => (props.isactive ? 'visible' : 'hidden')};
`;

export default function TimeZoneSettings() {
  const [swiper, setSwiper] = useState(null);
  const [animationStyle, setAnimationStyle] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const country = useAppSelector((state) => state.settings.country);
  const [timeZones, setTimeZones] = useState<Regions>({ cities: [] });

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (swiper) swiper.slideTo(activeIndex);
  }, [activeIndex, swiper]);

  useEffect(() => {
    try {
      getTimezoneRegion('cities', country).then((result) => {
        setTimeZones(result);
      });
    } catch (error) {
      console.log('Error fetching cities: ', error);
      setTimeZones({ cities: [] });
    }
  }, []);

  const slides = useMemo(() => {
    return [
      <SwiperSlide className="presset-option-item" key={`option-back`}>
        <div className={`${animationStyle}`}>
          <Option isactive={activeIndex === 0}>Back</Option>
        </div>
      </SwiperSlide>,
      ...timeZones['cities'].map((timezone, index) => {
        const isactive = index + 1 === activeIndex;
        const city = Object.keys(timezone)[0];
        const tz_name = Object.values(timezone)[0];
        const neednoWrap = city.length + tz_name.length > 11;
        return (
          <SwiperSlide
            className="presset-option-item"
            key={`option-${index + 1}`}
          >
            <div className={`${animationStyle}`}>
              <TextContainer neednoWrap={neednoWrap} isactive={isactive}>
                <Option isactive={isactive}>
                  <span>{city}</span>{' '}
                  <TimeZone isactive={isactive}>{tz_name}</TimeZone>
                </Option>
              </TextContainer>
            </div>
          </SwiperSlide>
        );
      })
    ];
  }, [activeIndex, animationStyle, timeZones]);

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
          dispatch(setScreen('countrySettings'));
        } else {
          const tz_selected = Object.values(
            timeZones.cities[activeIndex - 1]
          )[0];
          setTimezone(tz_selected);
          console.log('Seleccionar Ciudad/TimeZone:', tz_selected);
          dispatch(
            setBubbleDisplay({ visible: true, component: 'timeZoneConfig' })
          );
          dispatch(setScreen('barometer'));
        }
      }
    },
    bubbleDisplay.visible
  );
  return (
    <>
      <Title>timezones</Title>
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
