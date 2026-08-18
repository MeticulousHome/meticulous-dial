import { createRef, Ref, useEffect, useRef, useState } from 'react';
import { styled } from 'styled-components';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { PROFILE_ENTRY_SIZE, ProfileEntry } from './ProfileEntry';
import { ProfileImage } from './ProfileImage';

import { CircleOverlay } from './CircleOverlay';
import './transitions.less';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { useSettings } from '../../hooks/useSettings';
import { useProfileContext } from '../../context/ProfileContext';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { PlusIcon } from './PlusIcon';
import { LastLabel } from './LastLabel';
import { useIsOnline } from '../../hooks/useIsOnline';
import { loadProfileData, startProfile } from '../../api/profile';
import { DownloadIcon } from './DownloadIcon';
import { useSocket } from '../store/SocketManager';
import { invoke } from '@tauri-apps/api/core';
import { FreePourIcon } from '../../features/freePour/FreePourIcon';
import { logFreePourError } from '../../features/freePour/logging';
import { createRepeatPourOverProfile } from '../../features/freePour/profile';
import { getLatestFreePourOnlySession } from '../../features/freePour/storage';
import { PourOverProfile } from '../../features/freePour/types';
import {
  createDialProfileHover,
  getActiveHomeOption,
  getFreePourOptionIndex,
  getHomeSelection,
  getNewOptionIndex,
  getRepeatPourOptionIndex
} from './homeSelection';

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

const InnerList = styled(TransitionGroup)<{
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
type dialDirection = 'left' | 'right' | 'none';

const PISTON_ON_PURGE_POSITION = 73; // value gotten from ComplexProfileConverter.head_template on 'prepare' stage

export const ProfileHomeScreen = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const isOnline = useIsOnline();
  const socket = useSocket();

  const profileState = useProfileContext();

  const {
    localProfileIndex,
    setLocalProfileIndex: setActiveProfileOption,
    homeMode,
    setHomeMode,
    profileStarting,
    setProfileStarting,
    localHoverState,
    setLocalHoverState,
    mergedProfiles,
    limitedAccess
  } = profileState;

  const [transitionDirection, setTransitionDirection] =
    useState<dialDirection>('none');
  const [homeHoverState, setHomeHoverState] = useState(false);
  const [isPressingDown, setIsPressingDown] = useState(false);
  const [repeatPourProfile, setRepeatPourProfile] =
    useState<PourOverProfile | null>(null);
  const pressThroughTimer = useRef<NodeJS.Timeout | null>(null);
  const homeReadyReported = useRef(false);

  // Espresso selection stays in ProfileContext so app and Dial socket events
  // share one source of truth. Machine-only Pour Over tiles follow the profiles.
  const hasRepeatPour = Boolean(repeatPourProfile);
  const repeatPourOptionIndex = getRepeatPourOptionIndex({
    profileCount: mergedProfiles.length,
    hasRepeatPour
  });
  const freePourOptionIndex = getFreePourOptionIndex({
    profileCount: mergedProfiles.length,
    hasRepeatPour
  });
  const newOptionIndex = getNewOptionIndex({
    profileCount: mergedProfiles.length,
    hasRepeatPour
  });
  const activeOption = getActiveHomeOption({
    mode: homeMode,
    profileIndex: localProfileIndex,
    profileCount: mergedProfiles.length,
    hasRepeatPour
  });
  const activeOptionRef = useRef(activeOption);
  activeOptionRef.current = activeOption;

  const nodeRefs = useRef<Record<string, Ref<HTMLDivElement>>>({});
  const requiresPurge = useRef<boolean>(false);
  const PistonPos = useAppSelector((state) => state.stats.sensorData.m_pos);

  const getOrCreateRef = (id: string) => {
    if (!nodeRefs.current[id]) {
      nodeRefs.current[id] = createRef();
    }
    return nodeRefs.current[id];
  };

  const animationFinished = async () => {
    if (activeOption === freePourOptionIndex) {
      setIsPressingDown(false);
      setHomeHoverState(false);
      if (pressThroughTimer.current) clearTimeout(pressThroughTimer.current);
      pressThroughTimer.current = null;
      dispatch(setScreen('freePour'));
      return;
    }

    if (repeatPourProfile && activeOption === repeatPourOptionIndex) {
      setIsPressingDown(false);
      setHomeHoverState(false);
      if (pressThroughTimer.current) clearTimeout(pressThroughTimer.current);
      pressThroughTimer.current = null;
      dispatch(setScreen('freePourRecipe'));
      return;
    }

    const loadAndStartProfile = async () => {
      const profile = mergedProfiles?.[activeOption];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isLast, temporary, ...cleanProfile } = profile;
      const data = await loadProfileData(cleanProfile);

      if (typeof data === 'object' && 'name' in data) {
        const response = await startProfile();
        if (!('error' in response)) {
          setProfileStarting(true);
          if (!requiresPurge.current) {
            dispatch(setScreen('heating'));
          } else {
            dispatch(setScreen('manual-purge'));
          }
          return true;
        }
        console.error(`Failed starting profile: ${response.error}`);
      } else {
        console.error(`Failed loading profile: ${data.error}`);
      }
      return false;
    };

    if (await loadAndStartProfile()) return;
    setProfileStarting(false);
    setIsPressingDown(false);
    if (pressThroughTimer.current) clearTimeout(pressThroughTimer.current);
    pressThroughTimer.current = null;
  };

  useEffect(() => {
    getLatestFreePourOnlySession()
      .then((session) =>
        setRepeatPourProfile(
          session ? createRepeatPourOverProfile(session) : null
        )
      )
      .catch((error) => {
        logFreePourError('repeat_profile_home_load_failed', error);
        setRepeatPourProfile(null);
      });
  }, []);

  useEffect(() => {
    requiresPurge.current = PistonPos && PistonPos < PISTON_ON_PURGE_POSITION;
  }, [PistonPos]);

  useEffect(() => {
    if (!shouldGoToIdle) return;

    dispatch(setScreen('idle'));
    dispatch(setBubbleDisplay({ visible: false, component: undefined }));
  }, [shouldGoToIdle]);

  useEffect(() => {
    if (!mergedProfiles) return;

    if (!homeReadyReported.current && '__TAURI_INTERNALS__' in window) {
      homeReadyReported.current = true;
      invoke('home_ready').catch((error) => {
        console.error('Failed to report profile home ready:', error);
      });
    }

    // We are never zoomed in on the new button
    if (activeOption == newOptionIndex) {
      setHomeHoverState(false);
      return;
    }
  }, [mergedProfiles, activeOption, newOptionIndex]);

  useEffect(() => {
    if (homeMode === 'espresso') {
      setHomeHoverState(localHoverState);
    } else if (localHoverState) {
      setLocalHoverState(false);
    }
  }, [homeMode, localHoverState, setLocalHoverState]);

  const selectHomeOption = (option: number) => {
    const selection = getHomeSelection(option, {
      profileCount: mergedProfiles.length,
      hasRepeatPour
    });

    if (selection.mode === 'espresso' && selection.profileIndex !== null) {
      setActiveProfileOption(selection.profileIndex);
      setHomeMode('espresso');
      return;
    }

    setHomeMode(selection.mode);
    setLocalHoverState(false);
  };

  const emitProfileHover = (option: number, type: 'focus' | 'scroll') => {
    const event = createDialProfileHover(
      option,
      mergedProfiles,
      hasRepeatPour,
      type
    );
    if (event) socket.emit('profileHover', event);
  };

  const moveActiveOption = (next: number) => {
    if (next === activeOptionRef.current) return;

    activeOptionRef.current = next;
    selectHomeOption(next);
    emitProfileHover(next, 'scroll');
  };

  const rotateLeft = () => {
    if (homeHoverState) {
      setHomeHoverState(false);
      setLocalHoverState(false);
      emitProfileHover(activeOptionRef.current, 'scroll');
      return;
    }
    if (activeOptionRef.current !== newOptionIndex) {
      setTransitionDirection('none');
      requestAnimationFrame(() => {
        setTransitionDirection('right');
      });
    }
    moveActiveOption(Math.min(activeOptionRef.current + 1, newOptionIndex));
  };

  const rotateRight = () => {
    if (homeHoverState) {
      setHomeHoverState(false);
      setLocalHoverState(false);
      emitProfileHover(activeOptionRef.current, 'scroll');
      return;
    }
    if (activeOptionRef.current !== 0) {
      setTransitionDirection('none');

      requestAnimationFrame(() => {
        setTransitionDirection('left');
      });
    }
    moveActiveOption(Math.max(activeOptionRef.current - 1, 0));
  };

  useHandleGestures(
    {
      left() {
        if (pressThroughTimer.current) return; //This locks the movement if we are pressing the button
        if (globalSettings?.reverse_scrolling.home) {
          rotateRight();
        } else {
          rotateLeft();
        }
      },
      right() {
        if (pressThroughTimer.current) return;
        if (globalSettings?.reverse_scrolling.home) {
          rotateLeft();
        } else {
          rotateRight();
        }
      },
      pressDown() {
        // New profile button
        if (activeOption == newOptionIndex) {
          if (!isOnline) return;
          if (limitedAccess) {
            dispatch(setScreen('unlock'));
            return;
          }
          dispatch(setScreen('defaultProfiles'));
        } else if (
          activeOption === freePourOptionIndex ||
          (repeatPourProfile && activeOption === repeatPourOptionIndex)
        ) {
          if (!homeHoverState) {
            setHomeHoverState(true);
            setTransitionDirection('none');
            pressThroughTimer.current = setTimeout(() => {
              setIsPressingDown(true);
            }, 300);
          } else {
            setIsPressingDown(true);
          }
        } else {
          if (!homeHoverState) {
            setHomeHoverState(true);
            setLocalHoverState(true);
            setTransitionDirection('none');
            emitProfileHover(activeOptionRef.current, 'focus');
            if (!isOnline) return;
            pressThroughTimer.current = setTimeout(() => {
              setIsPressingDown(true);
            }, 300);
          } else {
            if (!isOnline) return;
            setIsPressingDown(true);
          }
        }
      },
      pressUp() {
        if (pressThroughTimer.current) {
          clearTimeout(pressThroughTimer.current);
          pressThroughTimer.current = null;
        }
        setIsPressingDown(false);
      }
    },
    bubbleDisplay.interceptsGesture || profileStarting
  );
  if (!mergedProfiles) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Container>
        <Viewport>
          <InnerList
            $translateX={CARD_PADDING - activeOption * CARD_SIZE}
            component={'div'}
          >
            {mergedProfiles.map((profile, index) => {
              const carouselIndex = index;
              const itemRef = getOrCreateRef(carouselIndex.toString());
              const backgroundColor = profile.display?.accentColor
                ? profile.display?.accentColor
                : '#e0dcd0';

              return (
                <CSSTransition
                  key={index}
                  nodeRef={itemRef} // Pass the ref here
                  timeout={500}
                  classNames="slide"
                >
                  <ProfileEntry
                    ref={itemRef}
                    contentClassNames={
                      !homeHoverState &&
                      Math.abs(carouselIndex - activeOption) < 2 &&
                      `animation-bounce-${transitionDirection}`
                    }
                    containerStyle={{ backgroundColor, position: 'relative' }}
                    title={profile.name}
                    distanceToActive={carouselIndex - activeOption}
                    zoomedIn={homeHoverState}
                  >
                    <ProfileImage profile={profile} />
                    {profile.isLast && (
                      <LastLabel isTemporary={profile.temporary} />
                    )}
                  </ProfileEntry>
                </CSSTransition>
              );
            })}
            {repeatPourProfile && repeatPourOptionIndex !== null && (
              <ProfileEntry
                key="repeat-last-pour"
                title={repeatPourProfile.name}
                containerStyle={{
                  backgroundColor: '#1f3340',
                  color: '#78d6ff'
                }}
                contentClassNames={
                  Math.abs(activeOption - repeatPourOptionIndex) < 2 &&
                  `animation-bounce-${transitionDirection}`
                }
                distanceToActive={repeatPourOptionIndex - activeOption}
                zoomedIn={homeHoverState}
              >
                <FreePourIcon />
              </ProfileEntry>
            )}
            <ProfileEntry
              key="free-pour"
              title="Free Pour"
              containerStyle={{ backgroundColor: '#23383f', color: '#78d6ff' }}
              contentClassNames={
                Math.abs(activeOption - freePourOptionIndex) < 2 &&
                `animation-bounce-${transitionDirection}`
              }
              distanceToActive={freePourOptionIndex - activeOption}
              zoomedIn={homeHoverState}
            >
              <FreePourIcon />
            </ProfileEntry>
            {/* New button */}
            <ProfileEntry
              key={'unlock_new'}
              title={limitedAccess ? 'unlock all features' : 'new'}
              contentClassNames={
                Math.abs(newOptionIndex - activeOption) < 2 &&
                `animation-bounce-${transitionDirection}`
              }
              distanceToActive={newOptionIndex - activeOption}
              zoomedIn={homeHoverState}
            >
              {limitedAccess ? <DownloadIcon /> : <PlusIcon />}
            </ProfileEntry>
          </InnerList>
        </Viewport>
      </Container>
      <CircleOverlay
        shouldAnimate={isPressingDown}
        onAnimationFinished={animationFinished}
        hoverState={homeHoverState}
      />
    </>
  );
};
