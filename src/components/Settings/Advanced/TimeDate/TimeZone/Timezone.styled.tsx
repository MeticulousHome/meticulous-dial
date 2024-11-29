import { styled, keyframes, css } from 'styled-components';

const leftright = keyframes`
  0% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(calc(320px - 100%));
  }
`;

export const TextContainer = styled.p<{
  neednoWrap?: boolean;
  isactive?: boolean;
}>`
  white-space: nowrap;
  ${(props) =>
    props.neednoWrap &&
    props.isactive &&
    css`
      position: relative;
      display: inline-block;
      animation: ${leftright} 6s infinite alternate ease-in-out;
    `}
`;

export const Option = styled.span<{
  isactive?: boolean;
}>`
  color: ${(props) => (props.isactive ? '#f5c444' : '')};
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
