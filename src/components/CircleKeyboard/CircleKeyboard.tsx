import './circle-keyboard.css';
import '../../assets/fonts/custom-space/css/fontello.css';
import { useEffect, useState } from 'react';
import { letters } from './Keys';
import { useReduxSelector } from '../store/store';

export function CircleKeyboard(): JSX.Element {
  const G_ROTATE = 7.24;
  const [rotate, setRotate] = useState<number>(208);
  const [alphabet, setAlphabet] = useState<string[]>(letters);
  const [mainLetter, setMainLetter] = useState<string>('U');
  const gesture = useReduxSelector((state) => state.gesture);
  // const [capsLockActive, setCapsLockActive] = useState<boolean>(false);

  const moveElements = (right: boolean) => {
    const newAlphabet = [...alphabet];
    const i = alphabet.indexOf(mainLetter);
    const pm2 = i + (!right ? -2 : +2);
    const pmr = rotate + (right ? -7.25 : +7.25);
    const newLetter = alphabet[pm2];
    const p1 = i + 1;
    const m1 = i - 1;

    if (!alphabet[pm2]) {
      return;
    }

    newAlphabet[i] = ' ';
    newAlphabet[pm2] = ' ';

    newAlphabet[!right ? p1 : m1] = mainLetter;
    newAlphabet[!right ? m1 : p1] = newLetter;
    setAlphabet(newAlphabet);

    setMainLetter(newLetter);
    setRotate(pmr);
  };

  useEffect(() => {
    if (gesture.value === 'left') {
      moveElements(false);
    }
    if (gesture.value === 'right') {
      moveElements(true);
    }
  }, [gesture]);

  return (
    <div className="circle-keyboard-container">
      {mainLetter === '&#xe800;' ? (
        <div className="main-letter-space">&#xe800;</div>
      ) : (
        <div className="main-letter">{mainLetter}</div>
      )}
      <svg height="390" width="390">
        <svg viewBox="0 0 100 100">
          <g
            transform={`translate(50 50) rotate(${rotate})`}
            dominantBaseline="text-bottom"
            textAnchor="middle"
            textLength="120%"
            className="transition-all"
          >
            {alphabet.map((letter: string, index: number) => {
              if (letter === mainLetter) {
                return;
              }
              if (letter === '&#xe800;') {
                return (
                  <g transform={`rotate(${index * G_ROTATE})`} key={index}>
                    <text y={-44} textAnchor="-120%" className="letter-space">
                      &#xe800;
                    </text>
                  </g>
                );
              }
              return (
                <g transform={`rotate(${index * G_ROTATE})`} key={index}>
                  <text y={-44} className="letter" textAnchor="-120%">
                    {letter}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </svg>
    </div>
  );
}
