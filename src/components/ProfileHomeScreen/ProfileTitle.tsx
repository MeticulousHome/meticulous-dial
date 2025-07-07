import { useProfileContext } from '../../context/ProfileContext';
import { css, keyframes, styled } from 'styled-components';
import { useAppSelector } from '../store/hooks';
import { useEffect, useRef, useState } from 'react';

const Title = styled.div<{ $scroll: boolean; $isMarquee?: boolean }>`
  height: 44px;
  display: flex;
  flex-direction: column;
  padding-top: 2px;
  width: 100%;
  transition: transform 0.3s ease-in-out;
  transform: ${({ $scroll }) =>
    $scroll ? 'translateY(-50%)' : 'translateY(0)'};
};
`;

const PresetTitleMarquee = (width: number) => keyframes`
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-${width}px);
  }
`;

const TITLE_MAX_WIDTH = 400; // Maximum width for the title
const TITLE_GAP = 40;

const PresetTitle = styled.span<{ $marqueeWidth?: number }>`
  width: fit-content;
  min-width: 228px;
  ${({ $marqueeWidth }) =>
    $marqueeWidth > 0 &&
    css`
      position: relative;
      display: inline-block;
      animation: ${PresetTitleMarquee($marqueeWidth + TITLE_GAP)} 5s infinite
        linear;
      animation-delay: 0.9s;
    `}
`;

export const getProfilesTitle = () => <TitleProfiles />;
export const getActiveProfilesTitle = () => <TitleProfiles />;

export const TitleProfiles = () => {
  const { localHoverState, localProfile } = useProfileContext();
  const currentScreen = useAppSelector((state) => state.screen.value);
  const isHomeScreen = currentScreen == 'profileHome';
  const titleRef = useRef<HTMLSpanElement>(null);

  // Dynamically adjust marquee animation speed based on title width
  const [marqueeWidth, setMarqueeWidth] = useState(0);

  useEffect(() => {
    if (titleRef.current) {
      const width = titleRef.current.offsetWidth;
      const parentWidth = titleRef.current.parentElement?.offsetWidth || 0;
      console.log('Title width:', width, 'Parent width:', parentWidth);
      setMarqueeWidth(width > parentWidth ? width : 0);
    }
  }, [localProfile?.name, titleRef.current]);

  const scroll = localHoverState && isHomeScreen;
  const marquee = (isHomeScreen && scroll) || !isHomeScreen;

  let title = localProfile?.name || '';
  if (title.length > 40) {
    title = title.slice(0, 40) + '...';
  }

  return (
    <Title $scroll={scroll} $isMarquee={false}>
      {isHomeScreen && <span>Catalog</span>}
      <div>
        <PresetTitle ref={titleRef} $marqueeWidth={marquee ? marqueeWidth : 0}>
          {title}
        </PresetTitle>
        {marquee && marqueeWidth > 0 && (
          <PresetTitle
            $marqueeWidth={marquee ? marqueeWidth : 0}
            style={{ paddingLeft: TITLE_GAP }}
          >
            {title}
          </PresetTitle>
        )}
      </div>
    </Title>
  );
};
