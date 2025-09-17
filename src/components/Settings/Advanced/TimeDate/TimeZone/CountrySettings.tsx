import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { useEffect, useState } from 'react';
import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { setScreen } from '../../../../store/features/screens/screens-slice';
import { setCountry } from '../../../../store/features/settings/settings-slice';
import { getTimezoneRegion } from '../../../../../api/api';
import { Regions } from '@meticulous-home/espresso-api';
import { useDimScreen } from '../../../../../hooks/useDimScreen';
import {
  Container,
  SettingsEntry,
  SettingsLabel,
  Title,
  Viewport
} from './Timezone.styled';

export default function CountrySettings() {
  const [activeIndex, setActiveIndex] = useState(0);

  const [availableCountries, setAvailableCountries] = useState<Regions>({
    countries: []
  });

  const countryLetter = useAppSelector((state) => state.settings.countryLetter);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const dispatch = useAppDispatch();

  useDimScreen();

  useEffect(() => {
    try {
      getTimezoneRegion('countries', countryLetter.toLowerCase()).then(
        (result) => {
          setAvailableCountries(result);
        }
      );
    } catch (error) {
      setAvailableCountries({ countries: [] });
      console.log('Error fetching countries: ', error);
    }
  }, []);

  useHandleGestures(
    {
      left() {
        const nextActiveIndex = activeIndex - 1;
        if (nextActiveIndex < 0) return;
        setActiveIndex(nextActiveIndex);
      },
      right() {
        const nextActiveIndex = activeIndex + 1;
        if (nextActiveIndex >= availableCountries['countries'].length + 1)
          return;
        setActiveIndex(nextActiveIndex);
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
      <Title>Country</Title>

      <Viewport $activeIndex={activeIndex}>
        <SettingsEntry $active={activeIndex == 0} key="back">
          <SettingsLabel
            $active={activeIndex == 0}
            style={activeIndex == 0 ? { color: '#f5c444' } : {}}
          >
            Back
          </SettingsLabel>
        </SettingsEntry>
        {availableCountries['countries'].map((country, index) => {
          const isActive = activeIndex - 1 == index;

          return (
            <SettingsEntry
              $marquee={isActive && country.length > 24}
              $active={isActive}
              key={index}
            >
              <SettingsLabel $active={isActive}>{country}</SettingsLabel>
            </SettingsEntry>
          );
        })}
      </Viewport>
    </Container>
  );
}
