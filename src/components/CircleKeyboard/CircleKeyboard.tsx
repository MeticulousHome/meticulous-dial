import './circle-keyboard.css';
import { useState } from 'react';
const letters = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S ',
  'T',
  ' ',
  'U',
  ' ',
  'V',
  'W',
  'X',
  'Y',
  '<',
  '_',
  '^',
  '|',
  '#',
  'Z',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0'
];

export function CircleKeyboard(): JSX.Element {
  const [rotate, setRotate] = useState<number>(203.5);
  const [alphabet, setAlphabet] = useState<string[]>(letters);
  const [mainLetter, setMainLetter] = useState<string>('U');
  const [myIndex, setMyindex] = useState<number>(0);

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

    setRotate(pmr + (!right ? +0.21 : -0.21));

    newAlphabet[i] = ' ';
    newAlphabet[pm2] = ' ';

    newAlphabet[!right ? p1 : m1] = mainLetter;
    newAlphabet[!right ? m1 : p1] = newLetter;

    setMainLetter(newLetter);
    setAlphabet(newAlphabet);
    setMyindex(myIndex + 1);
  };

  return (
    <div className="circle-keyboard-container">
      <div className="main-letter">{mainLetter}</div>
      <svg height="390" width="390">
        <svg viewBox="0 0 100 100">
          <g
            transform={`translate(50 50) rotate(${rotate})`}
            dominantBaseline="text-bottom"
            textAnchor="middle"
            textLength="120%"
          >
            {alphabet.map((letter: string, index: number) => {
              if (letter === mainLetter) {
                return;
              }
              return (
                <g transform={`rotate(${index * 7.45})`} key={index}>
                  <text y={-44} className="letter">
                    {letter}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </svg>
      <div style={{ position: 'absolute', fill: 'rebeccapurple' }}>
        <button
          id="arrow-left"
          onClick={() => {
            moveElements(false);
          }}
        >
          Left
        </button>
        <button id="space">Click</button>
        <button
          id="arrow-right"
          onClick={() => {
            moveElements(true);
          }}
        >
          Right
        </button>
      </div>
    </div>
  );
}
