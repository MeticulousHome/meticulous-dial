import 'swiper/css';

import { useHandleGestures } from '../../hooks/useHandleGestures';

import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import { css, keyframes, styled } from 'styled-components';
import { api } from '../../api/api';
import { IPresetNumericalUnit } from '../../types';
import { useDimScreen } from '../../hooks/useDimScreen';
import { useProfileContext } from '../../context/ProfileContext';
import { useSavePreset } from '../../hooks/useProfiles';
import { applySettingsToProfile } from '../../utils/profiles';

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

const OPTIONS_HEIGHT = 50;
const CARD_GAP = 2;
const translationAnimationDuration = 150;

const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const Viewport = styled.div<{
  $translateY: number;
}>`
  height: 100%;
  width: 75%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  gap: ${CARD_GAP}px;
  transform: ${({ $translateY }) =>
    `translateY(${$translateY + 240 - OPTIONS_HEIGHT / 2}px)`};
  transition: transform ${translationAnimationDuration}ms ease;
`;

const MarqueeAnimation = keyframes` 
  0% {
    transform: translateX(0%);
  }
  50% {
    transform: translateX(calc(120px - 100%));
  }
  100% {
    transform: translateX(0%);
  }
`;

const SettingsEntry = styled.div<{
  $small?: boolean;
  $active?: boolean;
  $marquee?: boolean;
}>`
  display: flex;
  flex-direction: row;
  justify-content: left;
  align-items: center;
  height: ${OPTIONS_HEIGHT}px;
  width: 100%;

  font-family: 'ABC Diatype';
  font-size: 40px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.2;
  text-transform: capitalize;
  white-space: nowrap;
  ${(props) =>
    props.$marquee &&
    css`
      animation: ${MarqueeAnimation} 8s ease-in-out infinite;
    `};
`;

const SettingsLabel = styled.span<{ $active?: boolean }>`
  padding-right: 8px;
  color: ${(props) => (props.$active ? 'white' : '#e7e7e790')};
`;

const SettingsValue = styled.span<{ $small?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  max-width: 400px;

  font-size: ${(props) => (props.$small ? 25 : 40)}px;

  color: #f5c444;
  overflow: visible;
`;

const SettingsUnit = styled.span`
  font-size: 17px;
  font-family: 'ABC Diatype Mono';
  letter-spacing: -0.5px;
  text-transform: none;
  color: #f5c444;
  height: 100%;
  margin-top: 10px;
`;

export function PressetSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { settingsIndex, setSettingsIndex, settingsProfile } =
    useProfileContext();
  const settings = settingsProfile.settings;
  const activeSetting = settings[settingsIndex];

  console.log('settings', settings);
  const saveProfile = useSavePreset();

  useDimScreen();
  useHandleGestures(
    {
      left() {
        setSettingsIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setSettingsIndex((prev) => Math.min(prev + 1, settings.length - 1));
      },
      pressDown() {
        if (activeSetting.key === 'save') {
          const cleaned = { ...settingsProfile };
          delete cleaned.settings;
          const profile = applySettingsToProfile(
            cleaned,
            settingsProfile.settings
          );
          saveProfile.mutate({ profile });
          dispatch(setScreen('profileHome'));
        } else if (activeSetting.key == 'discard') {
          dispatch(setScreen('profileHome'));
        } else if (activeSetting.key === 'name') {
          dispatch(setScreen('name'));
        } else if (activeSetting.key === 'output') {
          dispatch(setScreen('output'));
        } else if (activeSetting.key.includes('pressure')) {
          dispatch(setScreen('pressure'));
        } else if (activeSetting.key.includes('time')) {
          dispatch(setScreen('time'));
        } else if (activeSetting.key.includes('weight')) {
          dispatch(setScreen('weight'));
        } else if (activeSetting.key.includes('flow')) {
          dispatch(setScreen('flow'));
        } else if (activeSetting.key === 'temperature') {
          dispatch(setScreen('temperature'));
        } else if (activeSetting.key === 'image') {
          dispatch(setScreen('pressetProfileImage'));
        }
      }
    },
    bubbleDisplay.visible
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
      <Viewport $translateY={-settingsIndex * (OPTIONS_HEIGHT + CARD_GAP)}>
        {settings.map((setting, index: number) => {
          const { label, value, type } = setting;
          const isActive = activeSetting.label === label;
          const isImage = type === 'image';
          const showValue =
            isActive &&
            (typeof value === 'number' || typeof value === 'string');
          const characters =
            label && value ? label.length + value.toString().length : 0;
          return (
            <SettingsEntry
              $marquee={isActive && !isImage && characters > 24}
              $active={isActive}
              key={index}
            >
              <SettingsLabel $active={isActive}>
                {label}
                {showValue && ':'}
              </SettingsLabel>
              {isActive &&
                (isImage ? (
                  <img
                    src={`${API_URL}${api.getProfileImageUrl(value)}`}
                    alt="No image"
                    width={OPTIONS_HEIGHT}
                    height={OPTIONS_HEIGHT}
                  />
                ) : (
                  <>
                    <SettingsValue $small={characters > 21}>
                      {showValue && (value || 0)}
                    </SettingsValue>
                    <SettingsUnit>
                      {(setting as IPresetNumericalUnit)?.unit}
                    </SettingsUnit>
                  </>
                ))}
            </SettingsEntry>
          );
        })}
      </Viewport>
    </Container>
  );
}
