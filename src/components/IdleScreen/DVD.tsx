import React, { useEffect, useRef } from 'react';
import { styled } from 'styled-components';

const LogoSize = 60;

const Container = styled.div`
  height: 480px;
  width: 480px;
  background-color: #111;
  border-radius: 50%;
  margin: 0;
  overflow: hidden;
  position: relative;
`;

const Dvd = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  height: 60px;
  max-width: 80px;
  background-color: red;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Logo = styled.img`
  height: ${LogoSize}px;
  width: ${LogoSize}px;
  object-fit: contain;
`;

const ANIMATION_SPEED = 0.5;

const isPointOutsideCircle = (x: number, y: number) => {
  const xCenter = 240;
  const yCenter = 240;
  const radius = 240;
  const distance = Math.sqrt(
    Math.pow(x - xCenter, 2) + Math.pow(y - yCenter, 2)
  );
  return distance > radius;
};

const palette = [
  '#FF0716',
  '#52c757',
  '#d6e97d',
  '#6613f0',
  '#b1dd52',
  '#ab87a4',
  '#095ff0',
  '#155e35',
  '#4d3d04',
  '#f62ebf',
  '#a760ff',
  '#a0ab3a',
  '#dade1f',
  '#d885cf',
  '#60e7d6',
  '#948a6b',
  '#f4e819',
  '#8d37fd',
  '#3d250e',
  '#5d336f',
  '#d48281',
  '#0ffd91',
  '#38460c',
  '#0aab95',
  '#59be2c',
  '#639697',
  '#93f1cc',
  '#8fdfbb',
  '#ebf841',
  '#70e478'
];
let prevColorChoiceIndex = 0;

const getNewRandomColor = () => {
  const currentPalette = [...palette];
  currentPalette.splice(prevColorChoiceIndex, 1);
  const colorChoiceIndex = Math.floor(Math.random() * currentPalette.length);
  prevColorChoiceIndex =
    colorChoiceIndex < prevColorChoiceIndex
      ? colorChoiceIndex
      : colorChoiceIndex + 1;
  return currentPalette[colorChoiceIndex];
};

const BouncyLogo: React.FC<{ imageSrc: string }> = ({ imageSrc }) => {
  const logoRef = useRef<HTMLDivElement>(null);
  const framesOutside = useRef(0);

  useEffect(() => {
    let x = 100 + Math.random() * 100;
    let y = 100 + Math.random() * 100;
    let dirX = Math.random();
    let dirY = Math.random();

    const elem = logoRef.current;

    const animate = () => {
      if (elem) {
        if (isPointOutsideCircle(x, y)) {
          dirX = -dirX + (Math.random() * 2 - 1) * 0.3;
          dirY = -dirY + (Math.random() * 2 - 1) * 0.3;
          elem.style.backgroundColor = getNewRandomColor();
        } else if (isPointOutsideCircle(x, y + LogoSize)) {
          dirX = -dirX + (Math.random() * 2 - 1) * 0.3;
          dirY = -dirY + (Math.random() * 2 - 1) * 0.3;
          elem.style.backgroundColor = getNewRandomColor();
        } else if (isPointOutsideCircle(x + LogoSize, y)) {
          dirX = -dirX + (Math.random() * 2 - 1) * 0.3;
          dirY = -dirY + (Math.random() * 2 - 1) * 0.3;
          elem.style.backgroundColor = getNewRandomColor();
        } else if (isPointOutsideCircle(x + LogoSize, y + LogoSize)) {
          dirX = -dirX + (Math.random() * 2 - 1) * 0.3;
          dirY = -dirY + (Math.random() * 2 - 1) * 0.3;
          elem.style.backgroundColor = getNewRandomColor();
        } else {
          framesOutside.current = 0;
        }
        framesOutside.current++;

        if (framesOutside.current > 100) {
          x = 100 + Math.random() * 100;
          y = 100 + Math.random() * 100;
          dirX = Math.random();
          dirY = Math.random();
        }

        x += dirX * ANIMATION_SPEED;
        y += dirY * ANIMATION_SPEED;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, []);

  return (
    <Dvd ref={logoRef}>
      <Logo src={imageSrc} />
    </Dvd>
  );
};

export const DVDIdleScreen: React.FC = () => {
  return (
    <Container>
      <BouncyLogo imageSrc="assets/logo.png" />
      <BouncyLogo imageSrc="assets/BQLogo.png" />
    </Container>
  );
};
