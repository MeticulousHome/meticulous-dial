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
    localProfileIndex: activeOption,
    setLocalProfileIndex: setActiveOption,
    profileStarting,
    setProfileStarting,
    localHoverState,
    setLocalHoverState,
    mergedProfiles,
    limitedAccess
  } = profileState;

  const [transitionDirection, setTransitionDirection] =
    useState<dialDirection>('none');
  const [isPressingDown, setIsPressingDown] = useState(false);
  const pressThroughTimer = useRef<NodeJS.Timeout | null>(null);

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
    requiresPurge.current = PistonPos && PistonPos < PISTON_ON_PURGE_POSITION;
  }, [PistonPos]);

  useEffect(() => {
    if (!shouldGoToIdle) return;

    dispatch(setScreen('idle'));
    dispatch(setBubbleDisplay({ visible: false, component: undefined }));
  }, [shouldGoToIdle]);

  useEffect(() => {
    if (!mergedProfiles) return;

    if (activeOption > mergedProfiles.length) {
      setActiveOption(mergedProfiles.length);
      return;
    }

    // We are never zoomed in on the new button
    if (activeOption == mergedProfiles.length) {
      setLocalHoverState(false);
      return;
    }
  }, [mergedProfiles, activeOption]);

  const rotateLeft = () => {
    if (localHoverState) {
      setLocalHoverState(false);
      return;
    }
    if (activeOption !== mergedProfiles?.length) {
      setTransitionDirection('none');
      requestAnimationFrame(() => {
        setTransitionDirection('right');
      });
    }
    setActiveOption((prev) => Math.min(prev + 1, mergedProfiles?.length || 0));
  };

  const rotateRight = () => {
    if (localHoverState) {
      setLocalHoverState(false);
      return;
    }
    if (activeOption !== 0) {
      setTransitionDirection('none');

      requestAnimationFrame(() => {
        setTransitionDirection('left');
      });
    }
    setActiveOption((prev) => Math.max(prev - 1, 0));
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
        if (activeOption == mergedProfiles?.length) {
          if (!isOnline) return;
          if (limitedAccess) {
            dispatch(setScreen('unlock'));
            return;
          }
          dispatch(setScreen('defaultProfiles'));
        } else {
          if (!localHoverState) {
            setLocalHoverState(true);
            setTransitionDirection('none');
            const profile = mergedProfiles?.[activeOption];
            if (profile?.id) {
              socket.emit('profileHover', {
                id: profile.id,
                from: 'dial',
                type: 'focus'
              });
            }
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
              const itemRef = getOrCreateRef(index.toString());
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
                      !localHoverState &&
                      Math.abs(index - activeOption) < 2 &&
                      `animation-bounce-${transitionDirection}`
                    }
                    containerStyle={{ backgroundColor, position: 'relative' }}
                    title={profile.name}
                    distanceToActive={index - activeOption}
                    zoomedIn={localHoverState}
                  >
                    <ProfileImage profile={profile} />
                    {profile.isLast && (
                      <LastLabel isTemporary={profile.temporary} />
                    )}
                  </ProfileEntry>
                </CSSTransition>
              );
            })}
            {/* New button */}
            <ProfileEntry
              key={'unlock_new'}
              title={limitedAccess ? 'unlock all features' : 'new'}
              contentClassNames={
                Math.abs(mergedProfiles.length - activeOption) < 2 &&
                `animation-bounce-${transitionDirection}`
              }
              distanceToActive={mergedProfiles.length - activeOption}
              zoomedIn={localHoverState}
            >
              {limitedAccess ? <DownloadIcon /> : <PlusIcon />}
            </ProfileEntry>
          </InnerList>
        </Viewport>
      </Container>
      <CircleOverlay
        shouldAnimate={isPressingDown}
        onAnimationFinished={animationFinished}
      />
    </>
  );
};
