import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';

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
  /*position: relative;*/

  position: absolute;
  /*top:50%;
  left:50%;
  transform: translate(-50%,-50%);
  /*width:100%;
  height:100%; */

  > svg {
    /*position: absolute;
    top: 20px;
    left: 20px;*/
  }
`;

export const LogoWrapper = styled(motion.div)``;
