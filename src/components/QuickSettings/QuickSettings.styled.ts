import { styled, keyframes, css } from 'styled-components';

/**
 * Total height of the menu's visible area (in pixels).
 * It is also the size of the entire visible area in the application.
 * @constant {number}
 */
export const VIEWPORT_HEIGHT = 480;

/**
 * Height of each menu item (in pixels).
 * @constant {number}
 */
export const ITEM_HEIGHT = 38;

/**
 * Standard bottom margin between menu items (in pixels).
 * @constant {number}
 */

export const ITEM_MARGIN = 25;

/**
 * Additional margin applied after items with visual separators (in pixels).
 * @constant {number}
 */
export const EXTRA_MARGIN_AFTER_DELETE = 10;

/**
 * Minimum length of text for marquee animation (Scroll Text animation).
 * @constant {number}
 */
export const MARQUEE_MIN_TEXT_LENGTH = 24;

const QuickSettingsContainer = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  justify-content: center;
  font-family: 'ABC Diatype Mono';
`;

const Viewport = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #1d1d1d;
  height: 480px;
  padding-left: 28px;
`;

//slidable background for an interactive option like delete
// It makes the background move to the left.
const SlidableBackground = keyframes`
  0% {
    background-position: 100% 100%;
  }
  100% {
    background-position: 0% 100%;
  }
`;

const WhiteTextReveal = keyframes`
  0% {
    opacity: 0;
  }

  100% {
    opacity: 1;
    color: #ffffff;
  }
`;

const LeftRightAnimation = keyframes`
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
`;

const ActiveIndicator = styled.div<{ $holdAnimation: string }>`
  position: absolute;
  left: 228px;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 95%;
  height: ${ITEM_HEIGHT}px;
  background: linear-gradient(
    90deg,
    #1d1d1d 0%,
    #1d1d1d 50%,
    #f5c444 50%,
    #f5c444 100%
  );
  background-size: 200% 100%;
  background-position: 100% 100%;
  border-radius: 4px;
  overflow: hidden;
  z-index: 10;

  animation: ${({ $holdAnimation }) =>
    $holdAnimation === 'running'
      ? css`
          ${SlidableBackground} 1s ease normal
        `
      : 'none'};
`;

const OptionsContainer = styled.div<{
  $translateY: number;
  $isInner?: boolean;
  $bringToFront?: boolean;
}>`
  position: absolute;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  transform: ${({ $translateY, $isInner, $bringToFront }) =>
    $isInner
      ? `translate(-50%, 0) translateY(${$translateY}px)`
      : `translateY(${$translateY}px)`};

  ${({ $isInner }) => ($isInner ? 'color: #1d1d1d;' : 'color: #dddddd;')}
  ${({ $isInner }) => $isInner && 'top: 50%; left: 50%;'}
  ${({ $bringToFront }) => ($bringToFront ? 'z-index: 20;' : 'z-index: 10;')}
`;

const Option = styled.div<{
  $hasSeparator?: boolean;
  $isAnimating?: boolean;
  $isMarquee?: boolean;
}>`
  text-transform: uppercase;
  border-radius: 4px;
  font-size: 22px;
  text-align: left;
  width: 90%;
  letter-spacing: 1.3px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  position: relative;
  height: ${ITEM_HEIGHT}px;

  ${({ $hasSeparator }) =>
    $hasSeparator ? 'margin-bottom: 35px;' : 'margin-bottom: 25px;'}

  ${({ $hasSeparator }) =>
    $hasSeparator &&
    `
    &::after {
      content: '';
      position: absolute;
      bottom: -18px;
      width: 85%;
      border-top: 2px dashed rgba(245, 196, 68, 0.5);
    }
  `}

  span {
    ${({ $isAnimating }) =>
      $isAnimating &&
      css`
        animation: ${WhiteTextReveal} 1s ease forwards;
      `}
    ${({ $isMarquee }) =>
      $isMarquee &&
      css`
        position: relative;
        display: inline-block;
        animation: ${LeftRightAnimation} 6s infinite alternate ease-in-out;
        animation-delay: 0.5s;
      `}
  }
`;

const OsStatusOption = styled(Option)<{ $status?: string }>`
  text-transform: none;
  ${({ $status }) => $status === 'complete' && `color: #ffc107`}
  ${({ $status }) => $status === 'failed' && `color: #f44336`}
  ${({ $status }) => $status === 'downloading' && `color: #ffc107`}
  ${({ $status }) => $status === 'installing' && `color: #ffc107`}
`;

export default {
  QuickSettingsContainer,
  Viewport,
  ActiveIndicator,
  OptionsContainer,
  Option,
  OsStatusOption
};
