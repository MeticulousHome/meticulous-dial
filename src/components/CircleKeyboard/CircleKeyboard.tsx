import { useCallback, useEffect, useState } from 'react';
import '../../assets/fonts/custom/css/fontello.css';
import './circle-keyboard.css';

import { useDispatch } from 'react-redux';
import { IPresetName, IPresetSetting } from '../../types';
import { updatePresetSetting } from '../store/features/presetSetting/presetSetting-slice';
import {
  DEFAULT_ALPHABET,
  FIRST_POSITION,
  FIRST_KEY,
  LAST_KEY,
  ROTATE_VALUE,
  JUMP_ROTATE
} from './Keys';
import { useAppSelector } from '../store/hooks';

export function CircleKeyboard({ callback }: any): JSX.Element {
  const [rotate, setRotate] = useState<number>(FIRST_POSITION);
  const [alphabet, setAlphabet] = useState<string[]>(DEFAULT_ALPHABET);
  const [mainLetter, setMainLetter] = useState<string>(FIRST_KEY);
  const [capsLockActive, setCapsLockActive] = useState<{
    active: boolean;
    keep: boolean;
  }>({
    active: false,
    keep: false
  });
  const { gesture, screen, presetSetting } = useAppSelector((state) => state);
  const setting = presetSetting?.updatingSettings.settings[
    presetSetting.activeSetting
  ] as IPresetName;

  const [caption, setCaption] = useState(() =>
    setting && setting.value ? setting.value.split('') : []
  );
  const dispatch = useDispatch();

  const moveElements = (right: boolean) => {
    const newAlphabet = [...alphabet];
    const i = alphabet.findIndex((element) => {
      return element.toLowerCase() === mainLetter.toLowerCase();
    });
    const pm2 = i + (!right ? -2 : +2);
    const pmr = rotate + (right ? -ROTATE_VALUE : +ROTATE_VALUE);
    const newLetter = alphabet[pm2];
    const p1 = i + 1;
    const m1 = i - 1;

    if (!alphabet[pm2]) {
      newAlphabet.splice(0, 1);
      newAlphabet.splice(-1);
      newAlphabet.splice(!right ? 1 : -2, 1);

      if (!right) {
        newAlphabet.push(' ');
        newAlphabet.push(LAST_KEY);
        newAlphabet.push(' ');
      } else {
        newAlphabet.unshift(' ');
        newAlphabet.unshift(FIRST_KEY);
        newAlphabet.unshift(' ');
      }

      setAlphabet(toUpperOrLowerCase(newAlphabet) as string[]);
      setMainLetter(
        toUpperOrLowerCase(!right ? LAST_KEY : FIRST_KEY) as string
      );
      setRotate(
        !right
          ? rotate + ROTATE_VALUE * JUMP_ROTATE
          : rotate - ROTATE_VALUE * JUMP_ROTATE
      );
      return;
    }

    newAlphabet[i] = ' ';
    newAlphabet[pm2] = ' ';

    newAlphabet[!right ? p1 : m1] = mainLetter;
    newAlphabet[!right ? m1 : p1] = newLetter;

    setAlphabet(toUpperOrLowerCase(newAlphabet) as string[]);
    setMainLetter(toUpperOrLowerCase(newLetter) as string);
    setRotate(pmr);
  };

  const updateSetting = (updatedText: string) => {
    console.log('updatedText: ', updatedText);
    const updatedSetting = {
      ...setting,
      value: updatedText
    } as IPresetSetting;
    dispatch(updatePresetSetting(updatedSetting));
  };

  useEffect(() => {
    if (setting?.type === 'text') {
      setCaption(setting.value.split(''));
    }
  }, [setting, screen]);

  useEffect(() => {
    if (screen.value !== 'circleKeyboard') return;

    if (gesture.value === 'left') {
      moveElements(true);
      return;
    }

    if (gesture.value === 'right') {
      moveElements(false);
      return;
    }

    if (gesture.value === 'doubleClick' && mainLetter === 'capslock') {
      setCapsLockActive({
        active: !capsLockActive.active,
        keep: !capsLockActive.keep
      });
      return;
    }

    const goToMainScreen = () => {
      setCapsLockActive({
        active: false,
        keep: false
      });
      setAlphabet(DEFAULT_ALPHABET);
      setRotate(FIRST_POSITION);
      setMainLetter(FIRST_KEY);
      callback();
    };

    if (gesture.value === 'click') {
      if (caption.length === 8 && mainLetter !== 'backspace') {
        if (mainLetter === 'ok') {
          updateSetting(caption.join(''));
          goToMainScreen();
        }
        if (mainLetter === 'cancel') {
          setCaption(setting ? setting.value.split('') : []);
          goToMainScreen();
        }
        return;
      }

      switch (mainLetter) {
        case 'space':
          setCaption(caption.concat('U+0020'));
          return;
        case 'ok':
          updateSetting(caption.join(''));
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
      }
    }
  }, [callback, gesture]);

  const toUpperOrLowerCase = (
    cpAlphabet: string[] | string
  ): string[] | string => {
    if (Array.isArray(cpAlphabet)) {
      cpAlphabet = cpAlphabet.map((c) => {
        if (c.length > 1) {
          return c;
        }
        return capsLockActive.active ? c.toUpperCase() : c.toLowerCase();
      });
    } else {
      cpAlphabet =
        cpAlphabet.length > 1
          ? cpAlphabet
          : capsLockActive.active
          ? cpAlphabet.toUpperCase()
          : cpAlphabet.toLowerCase();
    }

    return cpAlphabet;
  };

  useEffect(() => {
    setAlphabet(toUpperOrLowerCase([...alphabet]) as string[]);
    setMainLetter(toUpperOrLowerCase(mainLetter) as string);
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

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (
      (screen.value === 'scale' && screen.prev === 'circleKeyboard') ||
      (screen.value === 'circleKeyboard' && screen.prev === 'scale')
    ) {
      animation = '';
    } else if (screen.value === 'circleKeyboard') {
      animation = 'circleKeyboard__fadeIn';
    } else if (
      screen.value === 'pressetSettings' &&
      screen.prev === 'circleKeyboard'
    ) {
      animation = 'circleKeyboard__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className={`circle-keyboard-container ${getAnimation()}`}>
      {getMainLetter()}
      <div className="caption-content">
        <div className="circle-title">{setting?.label}</div>
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
