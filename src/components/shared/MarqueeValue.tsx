import { styled, keyframes, css } from 'styled-components';

interface Props {
  enabled: boolean;
  val: string;
  len?: number;
  forceWidth?: number | string;
}

const createAnimation = (width: string) => keyframes`
  0% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(calc(${width} - 100%));
  }
`;

const AnimateMarquee = styled.span<{ width: string }>`
  position: relative;
  display: inline-block;
  ${({ width }) => css`
    animation: ${createAnimation(width)} 6s infinite alternate ease-in-out;
  `}
`;

export const marqueeIfNeeded = ({
  enabled,
  val,
  len = 24,
  forceWidth = 320 // Provide a default if not passed in
}: Props) => {
  if (enabled && val.length > len) {
    if (typeof forceWidth === 'number') {
      forceWidth = `${forceWidth}px`;
    }
    return <AnimateMarquee width={forceWidth}>{val}</AnimateMarquee>;
  }
  return <>{val}</>;
};
