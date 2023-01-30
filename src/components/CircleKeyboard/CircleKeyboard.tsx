import './circle-keyboard.css';
import '../../assets/fonts/custom/css/fontello.css';
import { useEffect, useState } from 'react';
import { letters } from './Keys';
import { useReduxSelector } from '../store/store';

export function CircleKeyboard(): JSX.Element {
  const G_ROTATE = 7.24;
  const [rotate, setRotate] = useState<number>(208);
  const [alphabet, setAlphabet] = useState<string[]>(letters);
  const [mainLetter, setMainLetter] = useState<string>('U');
  const gesture = useReduxSelector((state) => state.gesture);
  const [caption, setCaption] = useState<string>('');
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

    if (gesture.value === 'click') {
      setCaption(caption.concat(mainLetter));
    }
  }, [gesture]);

  const parseCharacter = (letter: string, index: number) => {
    switch (letter) {
      case 'space':
        return (
          <text key={index} y={-44} textAnchor="-120%" className="letter-space">
            &#xe800;
          </text>
        );
      case 'ok':
        return (
          <text key={index} y={-44} textAnchor="-120%" className="letter-space">
            &#xe801;
          </text>
        );
      case 'backspace':
        return (
          <text key={index} y={-44} textAnchor="-120%" className="letter-space">
            &#xe802;
          </text>
        );
      case 'capslock':
        return (
          <text
            key={index}
            y={-44}
            textAnchor="-120%"
            className="letter-space caps-active"
          >
            &#xe803;
          </text>
        );
      case 'cancel':
        return (
          <text key={index} y={-44} textAnchor="-120%" className="letter-space">
            &#xf02d;
          </text>
        );
      default:
        return (
          <text key={index} y={-44} className="letter" textAnchor="-120%">
            {letter}
          </text>
        );
    }
  };

  const getMainLetter = () => {
    switch (mainLetter) {
      case 'space':
        return (
          <div className="main-letter-space icon-space-selected">&#xe800;</div>
        );
      case 'ok':
        return (
          <div className="main-letter-space icon-ok-selected">&#xe801;</div>
        );
      case 'backspace':
        return (
          <div className="main-letter-space icon-backspace-selected">
            &#xe802;
          </div>
        );
      case 'capslock':
        return (
          <div className="main-letter-space icon-capslock-selected">
            &#xe803;
          </div>
        );
      case 'cancel':
        return (
          <div className="main-letter-space icon-cancel-selected">&#xf02d;</div>
        );
      default:
        return <div className="main-letter">{mainLetter}</div>;
    }
  };

  return (
    <div className="circle-keyboard-container">
      {getMainLetter()}
      <div className="caption-content">
        <div className="circle-title">Profile Name</div>
        <div className="circle-caption">{caption}</div>
      </div>
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
              return (
                <g transform={`rotate(${index * G_ROTATE})`} key={index}>
                  {parseCharacter(letter, index)}
                </g>
              );
            })}
          </g>
        </svg>
      </svg>
    </div>
  );
}
