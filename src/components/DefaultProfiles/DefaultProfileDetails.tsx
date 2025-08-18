import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { api } from '../../api/api';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useProfileContext } from '../../context/ProfileContext';
import { styled, keyframes } from 'styled-components';

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

const SCROLL_VALUE = 50;

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  box-sizing: border-box;
`;

const ImageWrapper = styled.div`
  margin-top: 32px;
  margin-bottom: 24px;
`;

const ImageContainer = styled.div<{ accentColor: string }>`
  width: 80px;
  height: 80px;
  border: 8px solid ${({ accentColor }) => accentColor};
  border-radius: 4px;
`;

const ProfileImage = styled.img<{ src: string; alt: string }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Name = styled.h2`
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 16px 0;
`;

const Description = styled.p`
  position: relative;
  white-space: pre-wrap;
  overflow: hidden;
  scroll-behavior: smooth;
  height: 180px;
  width: 100%;
  max-width: 85%;
  margin: 0 0 64px 0;
  padding: 0 16px;
  color: #e6e6e6;
`;

const BackButtonContainer = styled.div`
  position: absolute;
  bottom: 32px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const BackButtonInner = styled.button`
  background-color: #f5c444;
  color: #000000;
  font-weight: bold;
  padding: 8px 32px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  border: none;
`;

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
`;

const ScrollIndicatorWrapper = styled.div<{ visible: boolean }>`
  position: absolute;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  display: ${(props) => (props.visible ? 'flex' : 'none')};
  justify-content: center;
  color: #f5c444;
`;

const BouncingArrow = styled.svg`
  animation: ${bounce} 2s infinite;
`;

export const ProfileDetails = () => {
  const dispatch = useAppDispatch();

  const { detailProfileSelected: profile } = useProfileContext();

  const descriptionDivRef = useRef<HTMLDivElement | null>(null);

  const prevScreen = useAppSelector((state) => state.screen.prev);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    dispatch(setBubbleDisplay({ visible: false, component: 'quick-settings' }));
  }, []);

  const mainContainerScroll = (up: boolean) => {
    if (!descriptionDivRef.current) return;
    descriptionDivRef.current.scrollTop += up ? -SCROLL_VALUE : SCROLL_VALUE;
  };

  useHandleGestures({
    left: () => {
      mainContainerScroll(true);
    },
    right: () => {
      mainContainerScroll(false);
    },
    pressDown: async () => {
      dispatch(setScreen(prevScreen || 'profileHome'));
      dispatch(
        setBubbleDisplay({ visible: false, component: 'quick-settings' })
      );
    }
  });

  // Check scrollability and scroll position
  useEffect(() => {
    const $descriptionDiv = descriptionDivRef.current;
    if (!$descriptionDiv) return;

    const SCROLL_BOTTOM_THRESHOLD = 5;

    const checkScrollState = () => {
      setIsScrollable(
        $descriptionDiv.scrollHeight > $descriptionDiv.clientHeight
      );
      const atBottom =
        $descriptionDiv.scrollHeight - $descriptionDiv.scrollTop <=
        $descriptionDiv.clientHeight + SCROLL_BOTTOM_THRESHOLD;
      setIsAtBottom(atBottom);
    };

    checkScrollState();
    $descriptionDiv.addEventListener('scroll', checkScrollState);

    return () =>
      $descriptionDiv.removeEventListener('scroll', checkScrollState);
  }, []);

  const profileUrl = profile?.display?.image || '';
  const profileDescription =
    profile?.display?.description ||
    'Shared by a member of the community, this profile is ready for you to discover in the cup. Perfect for those who enjoy exploring new extractions and finding their own balance.';

  return (
    <Container>
      <ImageWrapper>
        <ImageContainer
          accentColor={profile?.display?.accentColor ?? '#e0dcd0'}
        >
          <ProfileImage
            src={`${API_URL}${api.getProfileImageUrl(profileUrl)}`}
            alt="No image"
          />
        </ImageContainer>
      </ImageWrapper>
      <Name>{profile?.name}</Name>
      <Description ref={descriptionDivRef}>{profileDescription}</Description>

      <ScrollIndicatorWrapper visible={isScrollable && !isAtBottom}>
        <BouncingArrow
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </BouncingArrow>
      </ScrollIndicatorWrapper>

      <BackButtonContainer>
        <BackButtonInner>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          <span>Back</span>
        </BackButtonInner>
      </BackButtonContainer>
    </Container>
  );
};
