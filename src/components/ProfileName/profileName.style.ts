import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';

export const ProfileNameWrapper = styled(motion.div)<any>`
  ${(props) => css`
    position: absolute;
    z-index: 9999;
    left: 0;

    text-align: center;
    background: transparent;
    width: 480px;
    line-height: 20px;
  `}
`;
