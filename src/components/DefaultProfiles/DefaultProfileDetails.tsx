import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { api } from '../../api/api';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useProfileContext } from '../../context/ProfileContext';
import { useBubbleContext } from '../Bubble/Bubble';
import { styled } from 'styled-components';

const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

const SCROLL_VALUE = 50;
export const MainQuickSettings = styled.div`
  height: 480px;
  align-items: center;
`;

export const Wrapper = styled.div`
  width: 100%;
  padding: 24px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
`;

export const ImageWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 32px;
`;

export const ProfileImage = styled.img<{ borderColor: string }>`
  border: 8px solid ${(props) => props.borderColor};
  display: block;
  position: relative;
  width: 66px;
  height: 66px;
`;

export const Name = styled.p`
  text-align: center;
  font-size: 24px;
  font-weight: bold;
`;

export const Description = styled.p`
  white-space: pre-wrap;
  overflow: hidden;
  scroll-behavior: smooth;
  max-height: 283px;
  max-width: 85%;
  margin: 0;
`;

export const BackButtonContainer = styled.div`
  margin-top: 80px;
  margin-bottom: 80px;
  max-width: 40%;
  border-radius: 9999px;
  margin-inline: auto;
  padding: 0;
`;

export const BackButtonInner = styled.div`
  padding: 8px 32px;
  width: auto;
  justify-content: center;
  align-items: center;
  gap: 8px;
  display: flex;
`;

export const DefaultProfileDetails = () => {
  const { bubbleContainerRef } = useBubbleContext();

  const dispatch = useAppDispatch();

  const { defaultProfileSelected: defaultProfile } = useProfileContext();

  const mainContainerRef = useRef<HTMLDivElement | null>(null);

  //When our component is mounted, we modify the styles of its container — the Bubble component in this case.
  //Once it is unmounted, we restore it to its original state.
  useEffect(() => {
    const $bubbleContainer = bubbleContainerRef?.current;
    if (!$bubbleContainer) return;
    const originalWidth = $bubbleContainer.style.width;
    const originalPadding = $bubbleContainer.style.padding;

    $bubbleContainer.style.width = '100%';
    $bubbleContainer.style.padding = '0px';

    return () => {
      $bubbleContainer.style.width = originalWidth;
      $bubbleContainer.style.padding = originalPadding;
    };
  }, []);

  useHandleGestures({
    left: () => {
      mainContainerScroll(true);
    },
    right: () => {
      mainContainerScroll(false);
    },
    pressDown: async () => {
      dispatch(
        setBubbleDisplay({ visible: true, component: 'quick-settings' })
      );
    }
  });

  const profile_url = defaultProfile.display?.image || '';

  const mainContainerScroll = (up: boolean) => {
    if (!mainContainerRef.current) {
      return;
    }

    mainContainerRef.current.scrollTop += up ? -SCROLL_VALUE : SCROLL_VALUE;
  };

  return (
    <MainQuickSettings className="main-quick-settings">
      <Wrapper>
        <ImageWrapper>
          <ProfileImage
            src={`${API_URL}${api.getProfileImageUrl(profile_url)}`}
            alt="No image"
            width="50"
            height="50"
            className="profile-image image-prev"
            borderColor={defaultProfile?.display?.accentColor ?? '#e0dcd0'}
          />
        </ImageWrapper>
        <Name>{defaultProfile?.name}</Name>
        <Description ref={mainContainerRef}>
          {defaultProfile?.display?.description ||
            'Shared by a member of the community, this profile is ready for you to discover in the cup. Perfect for those who enjoy exploring new extractions and finding their own balance.'}
          <BackButtonContainer className="settings-item active-setting">
            <BackButtonInner className="settings-entry">
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
        </Description>
      </Wrapper>
    </MainQuickSettings>
  );
};
