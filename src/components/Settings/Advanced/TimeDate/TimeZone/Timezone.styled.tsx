import { styled, keyframes, css } from 'styled-components';

export const OPTIONS_HEIGHT = 50;
export const CARD_GAP = 2;
const translationAnimationDuration = 150;

export const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

export const Viewport = styled.div<{
  $activeIndex: number;
}>`
  height: 100%;
  width: 75%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  gap: ${CARD_GAP}px;
  transform: ${({ $activeIndex }) => {
    const translateY =
      -$activeIndex * (OPTIONS_HEIGHT + CARD_GAP) + 240 - OPTIONS_HEIGHT / 2;
    return `translateY(${translateY}px)`;
  }};
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

export const SettingsEntry = styled.div<{
  $small?: boolean;
  $active?: boolean;
  $marquee?: boolean;
}>`
  display: flex;
  flex-direction: row;
  justify-content: left;
  align-items: baseline;
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

export const SettingsLabel = styled.span<{ $active?: boolean }>`
  padding-right: 8px;
  color: ${(props) => (props.$active ? '#f5c444' : '#e7e7e790')};
`;

export const Title = styled.span`
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  color: #f3f4f6;
  font-size: 1rem;
  display: block;
  text-align: center;
  z-index: 10;
  text-transform: uppercase;
  opacity: 0.8;
`;
