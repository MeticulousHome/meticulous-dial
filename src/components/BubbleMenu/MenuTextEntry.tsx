import { styled, css, keyframes } from 'styled-components';

export const TEXT_ENTRY_HEIGHT = 32;

// Define keyframes for hold animation
const holdAnimation = keyframes`
  0% {
    color: #1d1d1d;
    background-position: 100% 100%;
  }

  100% {
    color: #f5c444;
    background-position: 0% 100%;
  }
`;

// Extend Element with styled-components and filter out custom props
export const MenuText = styled.div<{
  selected: boolean;
  selectable: boolean;
  holding: boolean;
}>`
  height: ${TEXT_ENTRY_HEIGHT}px;
  width: 90%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'ABC Diatype Mono';

  text-transform: uppercase;
  border-radius: 4px 0 0 4px;
  font-size: 22px;
  color: #dddddd;
  text-align: left;
  font-weight: 400;
  letter-spacing: 1.3px;
  padding-left: 18px;
  padding-right: 18px;
  white-space: nowrap;

  ${({ selected, selectable, holding }) => css`
    /* Status (disabled or warning) styles */
    ${!selectable &&
    css`
      background: none;
      color: #ffc107 !important;
    `}

    /* Selected (active) styles */
    ${selected &&
    css`
      color: #1d1d1d;
      background: linear-gradient(
        90deg,
        #1d1d1d 0%,
        #1d1d1d 50%,
        #f5c444 50%,
        #f5c444 100%
      );
      background-size: 200% 100%;
      background-position: 100% 100%;
    `}

    /* Holding styles with animation */
    ${holding &&
    css`
      animation: ${holdAnimation} 1s;
    `}
  `}
`;
