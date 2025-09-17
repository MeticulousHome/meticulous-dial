import { useEffect, useState, useMemo } from 'react';

import { RouteProps } from '../../navigation';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

import './defaultProfile.css';
import { api, API_URL } from '../../api/api';
import { Profile } from '@meticulous-home/espresso-profile';
import { v4 as uuidv4 } from 'uuid';
import { useDimScreen } from '../../hooks/useDimScreen';
import { styled } from 'styled-components';
import {
  useSavePreset,
  useDefaultProfiles,
  useProfileDefaultImages
} from '../../hooks/useProfiles';
import { useProfileContext } from '../../context/ProfileContext';

const OPTIONS_HEIGHT = 86;
const CARD_GAP = 10;
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

const DefaultProfileEntry = styled.div`
  height: ${OPTIONS_HEIGHT}px;
  width: 100%;
  padding: 5px 10px;
  display: flex;
  border-radius: 4px;
  align-items: center;
`;

export const DefaultProfiles = ({ transitioning }: RouteProps): JSX.Element => {
  const { setDetailsProfileSelected } = useProfileContext();
  const createProfile = useSavePreset();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const currentScreen = useAppSelector((state) => state.screen.value);

  const { data: allDefaultProfiles, isLoading } = useDefaultProfiles();
  const defaultProfiles = useMemo(
    () =>
      allDefaultProfiles
        ? [...allDefaultProfiles.default, ...allDefaultProfiles.community]
        : [],
    [allDefaultProfiles]
  );

  const dispatch = useAppDispatch();
  const { data: defaultImages, isLoading: defaultImagesLoading } =
    useProfileDefaultImages();

  useDimScreen();

  useHandleGestures(
    {
      pressDown() {
        if (activeIndex === defaultProfiles.length)
          dispatch(setScreen('profileHome'));

        if (defaultProfiles && defaultProfiles[activeIndex]) {
          const { ...profileSelected } = defaultProfiles[
            activeIndex
          ] as Profile;
          createProfile.mutate({
            profile: {
              ...profileSelected,
              id: uuidv4()
            } as unknown as Profile
          });
          dispatch(setScreen('profileHome'));
        }
      },
      left() {
        if (transitioning) return;
        const next = Math.max(activeIndex - 1, 0);
        setActiveIndex(next);
      },
      right() {
        if (transitioning) return;
        const next = Math.min(activeIndex + 1, defaultProfiles.length);

        setActiveIndex(next);
      }
    },
    bubbleDisplay.interceptsGesture
  );

  useEffect(() => {
    if (activeIndex !== defaultProfiles.length) {
      setDetailsProfileSelected({
        ...defaultProfiles[activeIndex],
        display: {
          ...defaultProfiles[activeIndex].display,
          image: defaultImages[activeIndex % defaultImages.length]
        }
      });
    } else {
      setDetailsProfileSelected(null);
    }
  }, [activeIndex, defaultProfiles.length, defaultImages.length]);

  useEffect(() => {
    if (!isLoading && defaultProfiles.length === 0) {
      // if there is not default profile user is sent to pressets screen
      dispatch(setScreen('profileHome'));
    }
  }, [isLoading, defaultProfiles]);

  useEffect(() => {
    setActiveIndex(0);
    return () => {
      // Reset active index when unmounting
      // This is important to avoid keeping the last selected profile when navigating back
      // to the default profiles screen
      setActiveIndex(0);
      //Since DefaultProfileDetails is now treated as a screen and not as an element within the bubble display, we need to retain the selected profile so that the information is preserved when viewing its details.
      if (currentScreen === 'profileHome') setDetailsProfileSelected(null);
    };
  }, []);

  if (isLoading || defaultImagesLoading) {
    return <LoadingScreen />;
  }

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
      <Viewport $translateY={-activeIndex * (OPTIONS_HEIGHT + CARD_GAP)}>
        {defaultProfiles.map((preset, index: number) => {
          const profile_url =
            preset.display?.image ||
            defaultImages[index % defaultImages.length];
          return (
            <DefaultProfileEntry key={index}>
              <div className="default-profile-container__content__info">
                <img
                  src={API_URL + api.getProfileImageUrl(profile_url || '')}
                  alt="No image"
                  width="60"
                  height="60"
                  className="profile-image image-prev"
                  style={{
                    border: `8px solid ${
                      preset.display?.accentColor || '#e0dcd0'
                    }`,
                    display: 'block',
                    position: 'relative'
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    marginLeft: '10px'
                  }}
                >
                  {index > allDefaultProfiles.default.length - 1 && (
                    <span
                      style={{
                        fontSize: '15px'
                      }}
                      className={`default-profile-container__content__info__text ${
                        activeIndex === index
                          ? 'default-profile-container__content__info__text--active'
                          : ''
                      }`}
                    >
                      Community Profile:
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '20px'
                    }}
                    className={`default-profile-container__content__info__text default-profile-container__content__info__text--mb-10 ${
                      activeIndex === index
                        ? 'default-profile-container__content__info__text--active'
                        : ''
                    }`}
                  >
                    {preset.name}
                  </span>
                  <span className="default-profile-container__content__info__text">
                    {preset.display?.shortDescription}
                  </span>
                </div>
              </div>
            </DefaultProfileEntry>
          );
        })}
        <DefaultProfileEntry key={'back'}>
          <div className="default-profile-container__content__info">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                marginLeft: '10px'
              }}
            >
              <span
                style={{
                  fontSize: '20px'
                }}
                className={`default-profile-container__content__info__text default-profile-container__content__info__text--mb-10 ${
                  activeIndex === defaultProfiles.length
                    ? 'default-profile-container__content__info__text--active'
                    : ''
                }`}
              >
                Back
              </span>
            </div>
          </div>
        </DefaultProfileEntry>
      </Viewport>
    </Container>
  );
};
