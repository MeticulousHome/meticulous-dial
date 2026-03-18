import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from '../../../../store/features/screens/screens-slice';
import {
  Container,
  SettingsEntry,
  SettingsLabel,
  Title,
  Viewport
} from './Timezone.styled';
import { getTimezoneRegion, setTimezone } from '../../../../../api/api';
import { styled } from 'styled-components';
import { Regions } from '@meticulous-home/espresso-api';
import { useDimScreen } from '../../../../../hooks/useDimScreen';

const TimeZone = styled.span<{ isactive?: boolean }>`
  color: #f3f4f6;
  font-size: 24px;
  visibility: ${(props) => (props.isactive ? 'visible' : 'hidden')};
`;

export default function TimeZoneSettings() {
  const [activeIndex, setActiveIndex] = useState(0);

  const country = useAppSelector((state) => state.settings.country);
  const [timeZones, setTimeZones] = useState<Regions>({ cities: [] });

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const dispatch = useAppDispatch();

  useDimScreen();

  useEffect(() => {
    let cancelled = false;
    getTimezoneRegion('cities', country)
      .then((result) => {
        if (!cancelled) {
          setTimeZones(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.log('Error fetching cities: ', error);
          setTimeZones({ cities: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (nextActiveIndex >= timeZones['cities'].length + 1) return;
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
    bubbleDisplay.interceptsGesture
  );
  return (
    <Container>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(black 20%, transparent 50%, black 80%)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      <Title>Timezones</Title>

      <Viewport $activeIndex={activeIndex}>
        <SettingsEntry $active={activeIndex == 0} key="back">
          <SettingsLabel
            $active={activeIndex == 0}
            style={activeIndex == 0 ? { color: '#f5c444' } : {}}
          >
            Back
          </SettingsLabel>
        </SettingsEntry>
        {timeZones['cities'].map((timezone, index) => {
          const isActive = activeIndex - 1 == index;
          const city = Object.keys(timezone)[0];
          const tz_name = Object.values(timezone)[0];

          return (
            <SettingsEntry
              $marquee={isActive && city.length + tz_name.length > 24}
              $active={isActive}
              key={index}
            >
              <SettingsLabel $active={isActive}>{city}</SettingsLabel>
              <TimeZone isactive={isActive}>{tz_name}</TimeZone>
            </SettingsEntry>
          );
        })}
      </Viewport>
    </Container>
  );
}
