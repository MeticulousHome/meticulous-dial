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

import { loadProfileData, startProfile } from '../../api/profile';
import { CircleOverlay } from './CircleOverlay';
import './transitions.less';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { useSettings } from '../../hooks/useSettings';
import { useProfileContext } from '../../context/ProfileContext';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { PlusIcon } from './PlusIcon';
import { LastLabel } from './LastLabel';
import { useIsOnline } from '../../hooks/useIsOnline';

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

export const ProfileHomeScreen = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings } = useSettings();
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const isOnline = useIsOnline();

  const profileState = useProfileContext();

  const {
    localProfileIndex: activeOption,
    setLocalProfileIndex: setActiveOption,
    profileStarting,
    setProfileStarting,
    localHoverState,
    setLocalHoverState,
    mergedProfiles
  } = profileState;

  const [transitionDirection, setTransitionDirection] = useState<
    'left' | 'right' | 'none'
  >('none');
  const [isPressingDown, setIsPressingDown] = useState(false);
  const pressThroughTimer = useRef<NodeJS.Timeout | null>(null);

  const nodeRefs = useRef<Record<string, Ref<HTMLDivElement>>>({});

  const getOrCreateRef = (id: string) => {
    if (!nodeRefs.current[id]) {
      nodeRefs.current[id] = createRef();
    }
    return nodeRefs.current[id];
  };

  const animationFinished = async () => {
    setProfileStarting(true);
    const profile = mergedProfiles?.[activeOption];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isLast, temporary, ...cleanProfile } = profile;
    const data = await loadProfileData(cleanProfile);
    if (data) {
      await startProfile();
    }
  };

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
        if (globalSettings?.reverse_scrolling.home) {
          rotateRight();
        } else {
          rotateLeft();
        }
      },
      right() {
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
          dispatch(setScreen('defaultProfiles'));
        } else {
          if (!localHoverState) {
            setLocalHoverState(true);
            setTransitionDirection('none');
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
    bubbleDisplay.visible || profileStarting
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
                    {/* Only render images in those that are close to the active option */}
                    {Math.abs(index - activeOption) < 2 && (
                      <ProfileImage profile={profile} />
                    )}
                    {profile.isLast && (
                      <LastLabel isTemporary={profile.temporary} />
                    )}
                  </ProfileEntry>
                </CSSTransition>
              );
            })}
            {/* New button */}
            <ProfileEntry
              key={'new'}
              title={'new'}
              contentClassNames={
                !localHoverState &&
                Math.abs(mergedProfiles.length - activeOption) < 2 &&
                `animation-bounce-${transitionDirection}`
              }
              distanceToActive={mergedProfiles.length - activeOption}
              zoomedIn={localHoverState}
            >
              <PlusIcon />
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
