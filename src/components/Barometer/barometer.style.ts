import styled, { css } from 'styled-components';

export const BarNeedleWrapper = styled.div<any>`
  ${(props) => css`
    width: 100%;
    display: flex;
    justify-content: right;
    position: relative;

    > svg {
      position: absolute;
      left: 110px;
      transform-origin: 12.5% 50%;
      transform: ${props.transform};
    }
  `}
`;

export const BarometerCircleWrapper = styled.div`
  position: absolute;
  width: 100%;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;

  > svg {
  }
`;
