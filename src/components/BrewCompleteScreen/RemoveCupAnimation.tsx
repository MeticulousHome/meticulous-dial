import React from 'react';
import { styled, keyframes } from 'styled-components';

const DripTrayWidth = 130;
const DripTrayHeight = 101;

const fadeUp = keyframes`
0% {
    opacity: 0;
    transform: translateY(0);
}
10% {
    transform: translateY(0);
}
30% {
    opacity: 1;
}
70% {
    opacity: 1;
}
100% {
    opacity: 0;
    transform: translateY(-50px);
}
`;

const AnimationContainer = styled.div`
  position: relative;
  width: 130px;
  height: 150px;
`;

const DripTraySVG = styled.svg`
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 0;
`;

const DripTray = () => (
  <DripTraySVG
    width={DripTrayWidth}
    height={DripTrayHeight}
    viewBox={`0 0 ${DripTrayWidth} ${DripTrayHeight}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient
        id="cupGradient"
        cx={DripTrayWidth / 2}
        cy="-20"
        r={DripTrayWidth}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="10%" stopColor="black" />
        <stop offset="40%" stopColor="#152921" />
        <stop offset="60%" stopColor="#366a55" />
        <stop offset="70%" stopColor="#45866b" />
        <stop offset="100%" stopColor="#7BEEBF" />
      </radialGradient>
    </defs>
    <path
      d="M0.332031 99.726L129.784 99.726M0.332031 87.4186L129.784 87.4186M0.332031 75.1112L129.784 75.1112M0.332031 62.8037L129.784 62.8037M0.332031 50.4963L129.784 50.4963M0.332031 38.1889L129.784 38.1889M0.332031 25.8815L129.784 25.8817M0.332031 13.5741L129.784 13.5742M0.332031 1.2666L129.784 1.26662"
      stroke="url(#cupGradient)"
      strokeWidth="1.5"
    />
  </DripTraySVG>
);

const CupAnimationSVG = styled.svg`
  position: absolute;
  left: 0;
  bottom: 25px;
  z-index: 1;
  animation: ${fadeUp} 4s ease-out infinite;
`;

const CupWidth = 126;
const CupHeight = 167;
const CupAnimation = () => (
  <CupAnimationSVG
    width={CupWidth}
    height={CupHeight}
    viewBox={`0 0 ${CupWidth} ${CupHeight}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform={`translate(${CupWidth / 2 - 1.54297 - 23.8143 / 2}, 9)`}>
      <path
        d="M1.54297 12.5745L12.6783 1.43848L23.8143 12.5745"
        stroke="#7BEEBF"
        strokeWidth="2"
      />
      <path
        d="M12.6783 29.7676L12.6783 0.438477"
        stroke="#7BEEBF"
        strokeWidth="2"
      />
    </g>
    <g transform="translate(0, 30)">
      <path
        d="M63.0588 16.4141C37.3142 16.4141 16.3867 24.5058 16.3867 34.4486L31.7244 110.094C32.9758 116.358 46.5271 121.29 63.0598 121.29C79.6102 121.29 93.1727 116.347 94.3992 110.074L109.733 34.4486C109.733 24.5058 88.8034 16.4141 63.0588 16.4141Z"
        fill="black"
      />
      <path
        d="M22.9353 39.3721C22.9353 47.9356 40.9012 54.8778 63.0632 54.8778C85.2252 54.8778 103.191 47.9357 103.191 39.3721"
        stroke="#7BEEBF"
        strokeWidth="2"
      />
      <path
        d="M63.0624 23.7676C40.9281 23.7676 22.9353 30.7246 22.9353 39.273L36.1222 104.31C37.1981 109.696 48.849 113.937 63.0633 113.937C77.2927 113.937 88.9533 109.687 90.0078 104.293L103.191 39.273C103.191 30.7246 85.1967 23.7676 63.0624 23.7676Z"
        stroke="#7BEEBF"
        strokeWidth="2"
      />
    </g>
  </CupAnimationSVG>
);

export const RemoveCupAnimation: React.FC = () => {
  return (
    <AnimationContainer>
      <DripTray />
      <CupAnimation />
    </AnimationContainer>
  );
};
