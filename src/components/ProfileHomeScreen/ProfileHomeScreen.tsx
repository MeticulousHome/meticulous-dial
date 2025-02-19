import { useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useProfiles } from '../../hooks/useProfiles';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { PROFILE_ENTRY_SIZE, ProfileEntry } from './ProfileEntry';
import { ProfileImage } from './ProfileImage';

import { loadProfileData, startProfile } from '../../api/profile';
import { CircleOverlay } from './CircleOverlay';
import './transitions.less';
import {
  ProfileValue,
  setPresetState
} from '../store/features/preset/preset-slice';

const CARD_GAP = 79;
const CARD_SIZE = PROFILE_ENTRY_SIZE + CARD_GAP;
const CARD_PADDING = 480 / 2 - PROFILE_ENTRY_SIZE / 2;

const translationAnimationDuration = 150;

const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'ABC Diatype';
`;

const Viewport = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  position: relative;
`;

const InnerList = styled.div<{
  $translateX: number;
}>`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: ${CARD_GAP}px;

  transform: ${({ $translateX }) => `translateX(${$translateX}px)`};
  transition: transform ${translationAnimationDuration}ms ease;
`;

export const ProfileHomeScreen = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [transitionDirection, setTransitionDirection] = useState<
    'left' | 'right' | 'none'
  >('none');

  const [isPressingDown, setIsPressingDown] = useState(false);

  // TODO these should come from a context where they are synced with the server
  const { data: profiles } = useProfiles();
  const [zoomedIn, setZoomedIn] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const [coffeeLoading, setCoffeeLoading] = useState(false);

  //FIXME legacy
  const presetState = useAppSelector((state) => state.presets);

  console.log('state', presetState.activePreset.name);

  const animationFinished = async () => {
    setCoffeeLoading(true);
    console.log('starting coffee');
    const profile = profiles?.[activeOption];
    const data = await loadProfileData(profile);
    if (data) {
      await startProfile();
    }
  };

  //FIXME legacy code. Can be fully removed in the end
  useEffect(() => {
    if (!profiles) {
      return;
    }
    const state_copy = { ...presetState };
    if (activeOption < profiles.length) {
      state_copy.activePreset = profiles[activeOption] as ProfileValue;
      state_copy.updatingSettings = {
        presetId: state_copy.activePreset.id.toString(),
        settings: state_copy.activePreset.settings || []
      };
    }
    state_copy.activeIndexSwiper = activeOption;
    state_copy.profileFocused = zoomedIn;
    dispatch(
      setPresetState({
        ...state_copy
      })
    );
  }, [profiles, activeOption, zoomedIn]);

  useHandleGestures(
    {
      left() {
        if (zoomedIn) {
          setZoomedIn(false);
          return;
        }
        if (activeOption !== 0) {
          setTransitionDirection('left');
        }
        setActiveOption((prev) => Math.max(prev - 1, 0));
      },
      right() {
        if (zoomedIn) {
          setZoomedIn(false);
          return;
        }
        if (activeOption !== profiles?.length) {
          setTransitionDirection('right');
        }
        setActiveOption((prev) => Math.min(prev + 1, profiles?.length || 0));
      },
      pressDown() {
        // New profile button
        if (activeOption == profiles?.length) {
          dispatch(setScreen('defaultProfiles'));
        } else {
          if (!zoomedIn) {
            setZoomedIn(true);
            setTransitionDirection('none');
          } else {
            setIsPressingDown(true);
          }
        }
      },
      pressUp() {
        setIsPressingDown(false);
      }
    },
    bubbleDisplay.visible || coffeeLoading
  );

  if (!profiles) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Container>
        <Viewport>
          <InnerList $translateX={CARD_PADDING - activeOption * CARD_SIZE}>
            {profiles.map((profile, index) => {
              const backgroundColor = profile.display?.accentColor
                ? profile.display?.accentColor
                : '#e0dcd0';

              return (
                <ProfileEntry
                  key={index}
                  contentClassNames={
                    !zoomedIn &&
                    index === activeOption &&
                    `animation-bounce-${transitionDirection}`
                  }
                  containerStyle={{ backgroundColor }}
                  title={profile.name}
                  distanceToActive={index - activeOption}
                  zoomedIn={zoomedIn}
                >
                  {/* Only render images in those that are close to the active option */}
                  {Math.abs(index - activeOption) < 2 && (
                    <ProfileImage profile={profile} />
                  )}
                </ProfileEntry>
              );
            })}
            {/* New button */}
            <ProfileEntry
              key={'new'}
              title={'new'}
              contentClassNames={
                !zoomedIn &&
                profiles.length === activeOption &&
                `animation-bounce-${transitionDirection}`
              }
              distanceToActive={profiles.length - activeOption}
              zoomedIn={zoomedIn}
            >
              <svg
                width="166"
                height="166"
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
            </ProfileEntry>
          </InnerList>
        </Viewport>
      </Container>
      <CircleOverlay
        shouldAnimate={zoomedIn && isPressingDown}
        onAnimationFinished={animationFinished}
      />
    </>
  );
};
