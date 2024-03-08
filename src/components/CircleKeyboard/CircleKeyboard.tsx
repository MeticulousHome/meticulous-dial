import { useEffect, useRef, useState } from 'react';
import '../../assets/fonts/custom/css/fontello.css';
import './circle-keyboard.css';

import {
  DEFAULT_ALPHABET,
  SMALL_ACCENT_CHARACTERS,
  CAPITAL_ACCENT_CHARACTERS,
  FIRST_POSITION,
  LAST_KEY,
  ROTATE_VALUE,
  KEYBOARD_TYPE,
  getJumpRotate,
  CASE_ACCENT_TO_UPPERCASE_MAPPING,
  CASE_ACCENT_TO_LOWERCASE_MAPPING,
  massageAlphabetWithMainChar,
  SPECIAL_CHARACTERS
} from './Keys';
import { useHandleGestures } from '../../hooks/useHandleGestures';

interface IKeyboardProps {
  name: string;
  defaultValue?: string[];
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function CircleKeyboard(props: IKeyboardProps): JSX.Element {
  const [rotate, setRotate] = useState<number>(FIRST_POSITION);
  const [keyboardType, setKeyboardType] = useState<KEYBOARD_TYPE>(
    KEYBOARD_TYPE.Default
  );
  const [alphabet, setAlphabet] = useState<string[]>(
    massageAlphabetWithMainChar(DEFAULT_ALPHABET, 0)
  );
  const [mainLetter, setMainLetter] = useState<string>('a');
  const [capsLockActive, setCapsLockActive] = useState<{
    active: boolean;
    keep: boolean;
  }>({
    active: false,
    keep: false
  });

  const firstKey =
    keyboardType === KEYBOARD_TYPE.Default
      ? DEFAULT_ALPHABET[0]
      : keyboardType === KEYBOARD_TYPE.AccentCharacters
      ? SMALL_ACCENT_CHARACTERS[0]
      : SPECIAL_CHARACTERS[0];

  const { name, defaultValue, onSubmit, onCancel } = props;
  const inputLimit = 64;

  const captionRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState(defaultValue || []);

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
        newAlphabet.unshift(firstKey);
        newAlphabet.unshift(' ');
      }

      setAlphabet(toUpperOrLowerCase(newAlphabet) as string[]);
      setMainLetter(toUpperOrLowerCase(!right ? LAST_KEY : firstKey) as string);

      const jumpRotate = getJumpRotate(keyboardType);
      setRotate(
        !right
          ? rotate + ROTATE_VALUE + jumpRotate
          : rotate - ROTATE_VALUE - jumpRotate
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

  const addAnimation = () => {
    if (captionRef.current) {
      //add class to trigger animation
      captionRef.current.classList.add('caption_shake');
      setTimeout(() => {
        //remove class after finishing animation
        captionRef.current.classList.remove('caption_shake');
      }, 400);
    }
  };

  useHandleGestures({
    left() {
      moveElements(true);
    },
    right() {
      moveElements(false);
    },
    doubleClick() {
      if (mainLetter === 'capslock') {
        setCapsLockActive({
          active: !capsLockActive.active,
          keep: !capsLockActive.keep
        });
      }
    },
    click() {
      if (caption.length >= inputLimit && mainLetter !== 'backspace') {
        if (mainLetter === 'ok') {
          onSubmit(caption.join('').trim());
        }
        if (mainLetter === 'cancel') {
          setCaption(defaultValue);
          onCancel();
        }
        return;
      }
      if (captionRef.current) {
        //remove class to trigger animation if caption is empty next time
        captionRef.current.classList.remove('caption_shake');
      }
      switch (mainLetter) {
        case 'space':
          if (caption.length >= inputLimit - 1) {
            addAnimation();
            return;
          }

          if (
            caption.length < inputLimit &&
            caption.join('').trim().length === 0
          ) {
            addAnimation();
            return;
          }
          setCaption(caption.concat(' '));
          return;
        case 'ok':
          if (caption.length === 0 || caption.join('').trim().length === 0) {
            addAnimation();
            return;
          }
          onSubmit(caption.join('').trim());
          return;
        case 'backspace':
          if (caption.length > 0) {
            setCaption(caption.slice(0, -1));
          }
          return;
        case 'cancel':
          onCancel();
          return;
        case 'capslock':
          setCapsLockActive({
            active: !capsLockActive.active,
            keep: !capsLockActive.keep
          });
          return;
        case 'keyboardType':
          if (keyboardType === KEYBOARD_TYPE.Default) {
            setKeyboardType(KEYBOARD_TYPE.AccentCharacters);
            if (capsLockActive.active) {
              setAlphabet(
                massageAlphabetWithMainChar(
                  CAPITAL_ACCENT_CHARACTERS,
                  CAPITAL_ACCENT_CHARACTERS.length - 2
                )
              );
            } else {
              setAlphabet(
                massageAlphabetWithMainChar(
                  SMALL_ACCENT_CHARACTERS,
                  SMALL_ACCENT_CHARACTERS.length - 2
                )
              );
            }
            setRotate(467);
          } else if (keyboardType === KEYBOARD_TYPE.AccentCharacters) {
            setKeyboardType(KEYBOARD_TYPE.SpecialCharacters);
            setAlphabet(
              massageAlphabetWithMainChar(
                SPECIAL_CHARACTERS,
                SPECIAL_CHARACTERS.length - 2
              )
            );
            setRotate(466);
          } else {
            setKeyboardType(KEYBOARD_TYPE.Default);
            setAlphabet(
              massageAlphabetWithMainChar(
                DEFAULT_ALPHABET,
                DEFAULT_ALPHABET.length - 2
              )
            );
            setRotate(423);
          }
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
  });

  const toUpperOrLowerCase = (
    cpAlphabet: string[] | string
  ): string[] | string => {
    if (Array.isArray(cpAlphabet)) {
      cpAlphabet = cpAlphabet.map((c) => {
        if (keyboardType === KEYBOARD_TYPE.SpecialCharacters) {
          return c;
        }
        if (keyboardType === KEYBOARD_TYPE.AccentCharacters) {
          const mappedChar = capsLockActive.active
            ? CASE_ACCENT_TO_UPPERCASE_MAPPING[c]
            : CASE_ACCENT_TO_LOWERCASE_MAPPING[c];
          return mappedChar ? mappedChar : c;
        }
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
      case 'keyboardType':
        return (
          <text
            key={index}
            y={-44}
            textAnchor="-120%"
            className="letter-space letter-keyboard-type"
          >
            &#127760;
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
          <text
            key={index}
            y={-44}
            className="letter"
            textAnchor="-120%"
            dangerouslySetInnerHTML={{ __html: letter }}
          />
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
          <div className="main-letter-space icon-ok-selected">
            <div className="relative">
              <span className="main-letter__label main-letter__label--rigth-52 main-letter__label--bottom-16">
                Ok
              </span>
              <div>&#xe801;</div>
            </div>
          </div>
        );
      case 'backspace':
        return (
          <>
            <div className="main-letter-space icon-backspace-selected">
              <div className="relative">
                <span className="main-letter__label main-letter__label--bottom-11 main-letter__label--rigth-46">
                  Back
                </span>
                <div>&#xf177;</div>
              </div>
            </div>
          </>
        );
      case 'capslock':
        return (
          <div className="main-letter-space icon-capslock-selected">
            <div className="relative">
              <span
                className={`main-letter__label main-letter__label--bottom-20 ${
                  capsLockActive.active
                    ? 'main-letter__label-color--white'
                    : 'main-letter__label-color--grey'
                }`}
              >
                CAPSLock
              </span>
              <div
                className={`${
                  capsLockActive.active ? 'caps-active' : 'caps-inactive'
                }`}
              >
                &#xe803;
              </div>
            </div>
          </div>
        );
      case 'keyboardType':
        return (
          <>
            <div className="main-letter-space icon-backspace-selected letter-keyboard-type">
              <div className="relative">
                <span className="main-letter__label main-letter__label--bottom-11 main-letter__label--rigth-46">
                  Keyboard
                </span>
                <div>&#127760;</div>
              </div>
            </div>
          </>
        );
      case 'cancel':
        return (
          <div className="main-letter-space icon-cancel-selected">
            <div className="relative">
              <span className="main-letter__label main-letter__label--rigth-65">
                Abort
              </span>
              <div>&#xe802;</div>
            </div>
          </div>
        );
      default:
        return (
          <div
            className="main-letter"
            dangerouslySetInnerHTML={{ __html: mainLetter }}
          />
        );
    }
  };

  return (
    <div className="circle-keyboard-container">
      {getMainLetter()}
      <div className="caption-content">
        <div className="circle-content-wrapper">
          <div className="circle-title">{name}</div>
        </div>
        <div ref={captionRef} className="circle-caption">
          {caption.length > 10 && '...'}
          {caption.slice(Math.max(caption.length - 10, 0)).map((el, index) => {
            if (el === ' ') {
              return (
                <div key={index} className="transparent">
                  _
                </div>
              );
            }
            return <div key={index} dangerouslySetInnerHTML={{ __html: el }} />;
          })}
          {caption.length >= 0 && caption.length < inputLimit && (
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
