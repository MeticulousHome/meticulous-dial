import styled, { css } from 'styled-components';

export const ProfileNameWrapper = styled.div<any>`
  ${(props) => css`
    position: absolute;
    z-index: 9999;
    left: 0;
    top: ${props.top};

    text-align: center;
    background: transparent;
    width: 100%;
    line-height: 20px;
    font-size: 20px;
  `}
`;
