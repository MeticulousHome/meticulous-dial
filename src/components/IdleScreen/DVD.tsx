import { MutableRefObject, useEffect, useRef, useState } from 'react';
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

const ANIMATION_SPEED = 1;
interface point2D {
  x: number;
  y: number;
}

const isPointOutsideCircle = (point: point2D) => {
  const xCenter = 240;
  const yCenter = 240;
  const radius = 240;
  const distance = Math.sqrt(
    Math.pow(point.x - xCenter, 2) + Math.pow(point.y - yCenter, 2)
  );
  return distance > radius;
};

function doOverlap(position1: point2D, position2: point2D) {
  if (
    position1.x > position2.x + LogoSize ||
    position2.x > position1.x + LogoSize
  )
    return false;

  if (
    position1.y > position2.y + LogoSize ||
    position2.y > position1.y + LogoSize
  )
    return false;

  return true;
}

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

const BouncyLogo: React.FC<{
  imageSrc: string;
  position: MutableRefObject<object>;
}> = ({ imageSrc, position }) => {
  const logoRef = useRef<HTMLDivElement>(null);
  const lastInboundPos = useRef<point2D>({ x: 0, y: 0 });

  useEffect(() => {
    let x = 100 + Math.random() * 100;
    let y = 100 + Math.random() * 100;
    position.current = { x, y };
    const speed_angle = Math.random() * 2 * Math.PI;
    let dirX = ANIMATION_SPEED * Math.cos(speed_angle);
    let dirY = ANIMATION_SPEED * Math.sin(speed_angle);

    const elem = logoRef.current;

    const animate = () => {
      if (elem) {
        const logoCorners = [
          { x, y },
          { x: x, y: y + LogoSize },
          { x: x + LogoSize, y: y },
          { x: x + LogoSize, y: y + LogoSize }
        ];
        const offendingCorner = logoCorners.find(isPointOutsideCircle);
        if (offendingCorner) {
          x = lastInboundPos.current.x;
          y = lastInboundPos.current.y;

          // FOR A REASON UNBEKNOWNST TO ME, THIS SPAGHETTI WORKS BETTER THAN THE standard reflection formula IMPLMENTATION ( v' = v - 2 (v·n) n)
          const reflection_axis: point2D = {
            y: offendingCorner.y - 240,
            x: offendingCorner.x - 240
          };

          const alpha =
            Math.atan2(reflection_axis.y, reflection_axis.x) +
            (reflection_axis.x > 0 ? 0 : Math.PI); //angle from circle center to the offendign corner
          const beta =
            Math.atan2(dirY, dirX) + (reflection_axis.x > 0 ? 0 : Math.PI); // angle of the speed vector
          const d_angle = beta - alpha;
          const tau = beta + d_angle; // calculate new speed vector (its inverted)
          const reflected_angle = tau + Math.PI; // invert vector
          const exit_angle =
            reflected_angle + Math.random() * (d_angle < 0 ? -0.087 : 0.087); // add a random offset [-5deg, 5deg] prefering the direction of the reflected angle
          dirX = Math.cos(exit_angle);
          dirY = Math.sin(exit_angle);

          elem.style.backgroundColor = getNewRandomColor();
        } else {
          lastInboundPos.current = { x, y };
        }

        x += dirX * ANIMATION_SPEED;
        y += dirY * ANIMATION_SPEED;
        position.current = { x, y };
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
  const metPosition = useRef({ x: 0, y: 0 });
  const bqPosition = useRef({ x: 0, y: 0 });
  const [collision, setCollision] = useState<boolean>(
    doOverlap(metPosition.current, bqPosition.current)
  );

  useEffect(() => {
    const check_overlap = () => {
      const new_collision = doOverlap(metPosition.current, bqPosition.current);
      if (collision !== new_collision) {
        setCollision(new_collision);
      }
      requestAnimationFrame(check_overlap);
    };
    requestAnimationFrame(check_overlap);
  });

  return (
    <Container>
      <BouncyLogo position={metPosition} imageSrc="/logo.png" />
      <BouncyLogo position={bqPosition} imageSrc="/BQLogo.png" />
    </Container>
  );
};
