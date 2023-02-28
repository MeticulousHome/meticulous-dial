import './circle-keyboard.css';
import '../../assets/fonts/custom/css/fontello.css';
import { useEffect, useState } from 'react';
import { letters } from './Keys';
import { useAppSelector } from '../store/hooks';

export function CircleKeyboard({ callback }: any): JSX.Element {
  const [rotate, setRotate] = useState<number>(208);
  const [alphabet, setAlphabet] = useState<string[]>(letters);
  const [mainLetter, setMainLetter] = useState<string>('u');
  const { gesture, screen } = useAppSelector((state) => state);
  const [caption, setCaption] = useState<string[]>([]);
  const [capsLockActive, setCapsLockActive] = useState<{
    active: boolean;
    keep: boolean;
  }>({
    active: false,
    keep: false
  });

  const moveElements = (right: boolean) => {
    const newAlphabet = [...alphabet];
    const i = alphabet.findIndex((element) => {
      return element.toLowerCase() === mainLetter.toLowerCase();
    });
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
    if (screen.value !== 'circleKeyboard') return;

    if (gesture.value === 'left') {
      moveElements(false);
      return;
    }

    if (gesture.value === 'right') {
      moveElements(true);
      return;
    }

    if (gesture.value === 'doubleTare' && mainLetter === 'capslock') {
      setCapsLockActive({
        active: true,
        keep: true
      });
      return;
    }

    const goToMainScreen = () => {
      setCapsLockActive({
        active: false,
        keep: false
      });
      setCaption([]);
      callback();
    };

    if (gesture.value === 'click') {
      if (caption.length === 8 && mainLetter !== 'backspace') {
        if (mainLetter === 'ok' || mainLetter === 'cancel') {
          goToMainScreen();
        }
        return;
      }

      switch (mainLetter) {
        case 'space':
          setCaption(caption.concat('U+0020'));
          return;
        case 'ok':
          goToMainScreen();
          return;
        case 'backspace':
          if (caption.length > 0) {
            setCaption(caption.slice(0, -1));
          }
          return;
        case 'cancel':
          goToMainScreen();
          return;
        case 'capslock':
          setCapsLockActive({
            active: !capsLockActive.active,
            keep: capsLockActive.keep ? false : capsLockActive.keep
          });
          return;
        default:
          setCaption(caption.concat(mainLetter));
          if (!/^[A-Za-z]$/.test(mainLetter) && capsLockActive.active) {
            return;
          }
          if (!capsLockActive.keep && capsLockActive.active) {
            setCapsLockActive({
              ...capsLockActive,
              active: false
            });
          }
          return;
      }
    }
  }, [callback, gesture]);

  useEffect(() => {
    let cpAlphabet = [...alphabet];
    cpAlphabet = cpAlphabet.map((c) => {
      if (c.length > 1) {
        return c;
      }
      return capsLockActive.active ? c.toUpperCase() : c.toLowerCase();
    });
    setAlphabet(cpAlphabet);
  }, [capsLockActive]);

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
            &#xf177;
          </text>
        );
      case 'capslock':
        return (
          <text
            key={index}
            y={-44}
            textAnchor="-120%"
            className={`letter-space ${
              capsLockActive.active ? 'caps-active' : 'caps-inactive'
            }`}
          >
            &#xe803;
          </text>
        );
      case 'cancel':
        return (
          <text key={index} y={-44} textAnchor="-120%" className="letter-space">
            &#xe802;
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
            &#xf177;
          </div>
        );
      case 'capslock':
        return (
          <div
            className={`main-letter-space icon-capslock-selected ${
              capsLockActive.active ? 'caps-active' : 'caps-inactive'
            }`}
          >
            &#xe803;
          </div>
        );
      case 'cancel':
        return (
          <div className="main-letter-space icon-cancel-selected">&#xe802;</div>
        );
      default:
        return <div className="main-letter">{mainLetter}</div>;
    }
  };

  return (
    <div
      className={`circle-keyboard-container ${
        screen.value === 'circleKeyboard'
          ? 'circleKeyboard__fadeIn'
          : screen.value === 'pressetSettings' &&
            screen.prev === 'circleKeyboard'
          ? 'circleKeyboard__fadeOut'
          : 'hidden'
      }`}
    >
      {getMainLetter()}
      <div className="caption-content">
        <div className="circle-title">Profile Name</div>
        <div className="circle-caption">
          {caption.map((el) => {
            if (el === 'U+0020') {
              return <div className="transparent">_</div>;
            }
            return <div>{el}</div>;
          })}
          {caption.length >= 0 && caption.length < 8 && (
            <div className="blink">_</div>
          )}
        </div>
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
              if (letter.toLowerCase() === mainLetter.toLowerCase()) {
                return;
              }
              return (
                <g transform={`rotate(${index * 7.24})`} key={index}>
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
