import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Temperature } from './Temperatures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';

const ArrowSVG = () => (
  <svg
    width="28"
    height="12"
    viewBox="0 0 28 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <path d="M0 5.5L20 5.5" stroke="#E7E7E7" stroke-width="3" />
      <path
        transform="translate(18,0)"
        d="M10.1934 5.88013L0.861196 11.2681L0.861196 0.492206L10.1934 5.88013Z"
        fill="#E7E7E7"
      />
    </g>
  </svg>
);

const HeaterCoil = ({
  mainColor,
  shadowColor
}: {
  mainColor: number[];
  shadowColor: number[];
}) => {
  const color = `hsl(${mainColor[0]}, ${mainColor[1]}%, ${mainColor[2]}%)`;
  const shadow = `hsl(${shadowColor[0]}, ${shadowColor[1]}%, ${shadowColor[2]}%)`;
  return (
    <svg
      width="150"
      height="75"
      viewBox="0 0 150 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M74.9999 2.94043C115.04 2.94044 147.5 19.4646 147.5 36.7727C147.5 54.0807 115.04 72.9404 74.9999 72.9404C34.9593 72.9404 2.5 61.3014 2.5 43.9933C2.5 26.9129 35.6874 21.2974 75 20.9349"
        stroke="url(#paint0_linear_1_1299)"
        stroke-width="4"
      />
      <defs>
        <linearGradient
          id="paint0_linear_1_1299"
          x1="75.0001"
          y1="75.4777"
          x2="75.0001"
          y2="2.94035"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.00492285" stop-color={color} />
          <stop offset="0.722243" stop-color={shadow} />
        </linearGradient>
      </defs>
    </svg>
  );
};

const gradients = [
  [
    [55, 15, 72],
    [0, 0, 4]
  ],
  [
    [29, 72, 70],
    [29, 79, 6]
  ],
  [
    [26, 71, 59],
    [16, 88, 8]
  ],
  [
    [25, 76, 50],
    [12, 85, 8]
  ],
  [
    [25, 100, 50],
    [0, 100, 9]
  ]
];

const getInterpolatedColor = (index: number) => {
  const currentIndex = Math.floor(index);
  const currentColor = gradients[currentIndex];
  const nextColor =
    currentIndex + 1 < gradients.length
      ? gradients[currentIndex + 1]
      : gradients[currentIndex];
  const factor = index - currentIndex;

  const mainColorInterpolated = currentColor[0].map((color, i) =>
    Math.round(color + (nextColor[0][i] - color) * factor)
  );

  const shadowColorInterpolated = currentColor[1].map((color, i) =>
    Math.round(color + (nextColor[1][i] - color) * factor)
  );
  return [mainColorInterpolated, shadowColorInterpolated];
};

export const PreheatScreen = () => {
  const dispatch = useAppDispatch();
  const temperature = useAppSelector((state) =>
    Math.round(state.stats.sensors.t)
  );

  const [colorIndex, setColorIndex] = useState(0);

  const [targetTemperature, setTargetTemperature] = useState(
    Math.max(30, temperature)
  );

  // Give the user an easy exit strategy
  useHandleGestures({
    left() {
      dispatch(setScreen('pressets'));
    },
    right() {
      dispatch(setScreen('pressets'));
    },
    pressDown() {
      dispatch(setScreen('pressets'));
    }
  });

  useEffect(() => {
    // Animate the color change
    const intervalRef = setInterval(() => {
      setColorIndex((prev) =>
        prev < gradients.length - 1 ? prev + 0.08 : gradients.length - 1
      );
    }, 30);

    const counterRef = setInterval(() => {
      setTargetTemperature((prev) => (prev < 65 ? prev + 1 : 65));
    }, 40);

    return () => {
      clearInterval(intervalRef);
      clearInterval(counterRef);
    };
  }, []);

  useEffect(() => {
    if (colorIndex >= gradients.length - 1) {
      // go back to the presets screen after a short moment of finishing the animation
      const timeoutRef = setTimeout(() => {
        dispatch(setScreen('pressets'));
      }, 900);
      return () => {
        clearTimeout(timeoutRef);
      };
    }
  }, [colorIndex]);

  const colors = getInterpolatedColor(colorIndex);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%'
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 270,
          left: -75,
          top: 30
        }}
      >
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * 18,
              zIndex: 9 - index
            }}
          >
            <HeaterCoil mainColor={colors[0]} shadowColor={colors[1]} />
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 200
        }}
      >
        <Temperature value={temperature} small animated />
        <ArrowSVG />
        <Temperature value={targetTemperature} animated />
      </div>
    </div>
  );
};
