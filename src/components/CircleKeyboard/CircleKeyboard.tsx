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
  SPECIAL_CHARACTERS,
  ALPHABETH_ONLY_LETTERS,
  ROTATE_VALUE_LETTERS,
  JUMP_ROTATE_LETTERS
} from './Keys';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppSelector } from '../../components/store/hooks';

interface IKeyboardProps {
  name: string;
  defaultValue?: string[];
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onChange?: (text: string) => void;
  onlyLetters?: boolean;
}

export function CircleKeyboard(props: IKeyboardProps): JSX.Element {
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const [rotate, setRotate] = useState<number>(FIRST_POSITION);
  const [keyboardType, setKeyboardType] = useState<KEYBOARD_TYPE>(() =>
    props.onlyLetters ? KEYBOARD_TYPE.OnlyLetters : KEYBOARD_TYPE.Default
  );
  const [alphabet, setAlphabet] = useState<string[]>(() => {
    return props.onlyLetters
      ? massageAlphabetWithMainChar(ALPHABETH_ONLY_LETTERS, 0)
      : massageAlphabetWithMainChar(DEFAULT_ALPHABET, 0);
  });
  const [mainLetter, setMainLetter] = useState<string>('a');
  const [capsLockActive, setCapsLockActive] = useState<{
    active: boolean;
    keep: boolean;
  }>({
    active: false,
    keep: false
  });

  // the fontsize is initially filled from the first render
  const [fontSize, setFontSize] = useState<string>(undefined);
  const [maxFontSize, setMaxFontSize] = useState<number>(25);

  const maxCaptionCharactersBeforeShrink = 10;
  const averageCaptionCharactersPerLine = 19;
  const captionMinFontSize = 28;
  const maxShownCharacters = 35;

  const firstKey =
    keyboardType === KEYBOARD_TYPE.Default
      ? DEFAULT_ALPHABET[0]
      : keyboardType === KEYBOARD_TYPE.AccentCharacters
        ? SMALL_ACCENT_CHARACTERS[0]
        : keyboardType === KEYBOARD_TYPE.OnlyLetters
          ? ALPHABETH_ONLY_LETTERS[0]
          : SPECIAL_CHARACTERS[0];

  const { name, defaultValue, onSubmit, onCancel, onChange } = props;
  const inputLimit = 64;

  const captionRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState(defaultValue || []);

  useEffect(() => {
    setCaption(defaultValue || []);
  }, [defaultValue]);

  const moveElements = (right: boolean) => {
    const newAlphabet = [...alphabet];
    const i = alphabet.findIndex((element) => {
      return element.toLowerCase() === mainLetter.toLowerCase();
    });
    const pm2 = i + (!right ? -2 : +2);
    const pmr =
      keyboardType === KEYBOARD_TYPE.OnlyLetters
        ? rotate + (right ? -ROTATE_VALUE_LETTERS : +ROTATE_VALUE_LETTERS)
        : rotate + (right ? -ROTATE_VALUE : +ROTATE_VALUE);
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
      console.log('jumpRotate: ', jumpRotate);
      const new_rotate =
        keyboardType === KEYBOARD_TYPE.OnlyLetters
          ? !right
            ? rotate + ROTATE_VALUE_LETTERS + JUMP_ROTATE_LETTERS
            : rotate - (ROTATE_VALUE_LETTERS + JUMP_ROTATE_LETTERS)
          : !right
            ? rotate + ROTATE_VALUE + jumpRotate
            : rotate - ROTATE_VALUE - jumpRotate;
      console.log('new rotate', new_rotate);
      // setRotate(
      //   !right
      //     ? rotate + ROTATE_VALUE + jumpRotate
      //     : rotate - ROTATE_VALUE - jumpRotate
      // );

      setRotate(new_rotate);
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

  useHandleGestures(
    {
      left() {
        moveElements(true);
      },
      right() {
        moveElements(false);
      },
      doubleClick() {
        if (mainLetter === 'capslock') {
          if (capsLockActive.active && caption.length === 0) {
            setCapsLockActive({ ...capsLockActive, keep: true });
            return;
          }

          setCapsLockActive({
            active: !capsLockActive.active,
            keep: !capsLockActive.keep
          });
        }
      },
      pressDown() {
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
          case 'space': {
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
            const captioValue = caption.concat(' ');
            setCaption(captioValue);
            if (onChange) onChange(captioValue.join(''));
            return;
          }
          case 'ok':
            if (caption.length === 0 || caption.join('').trim().length === 0) {
              addAnimation();
              return;
            }
            onSubmit(caption.join('').trim());
            return;
          case 'backspace':
            if (caption.length > 0) {
              const captionValue = caption.slice(0, -1);
              setCaption(captionValue);
              if (onChange) onChange(captionValue.join(''));
            }
            return;
          case 'cancel':
            onCancel();
            return;
          case 'capslock':
            setCapsLockActive({
              active: !capsLockActive.active,
              keep: capsLockActive.keep ? false : capsLockActive.keep
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
          default: {
            const captionValue = caption.concat(mainLetter);
            setCaption(captionValue);
            if (onChange) onChange(captionValue.join(''));
            if (!/^[A-Za-z]$/.test(mainLetter) && capsLockActive.active) {
              return;
            }
            if (!capsLockActive.keep && capsLockActive.active) {
              setCapsLockActive({
                ...capsLockActive,
                active: false
              });
            }
            break;
          }
        }
      }
    },
    bubbleDisplay.visible
  );

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

  // Recalculate caption style when the caption changes length
  useEffect(() => {
    if (caption.length === 0) {
      setCapsLockActive({ ...capsLockActive, active: true });
    }

    if (captionRef.current) {
      const computedStyle = getComputedStyle(captionRef.current);
      let baseFontSize = parseInt(computedStyle.fontSize, 10);
      if (baseFontSize > maxFontSize) setMaxFontSize(baseFontSize);

      let adjustedFontSize = baseFontSize;
      if (caption.length > maxCaptionCharactersBeforeShrink) {
        baseFontSize = Math.max(baseFontSize, maxFontSize);
        const fontScaleFactor = -(
          (baseFontSize - captionMinFontSize) /
          (maxCaptionCharactersBeforeShrink - averageCaptionCharactersPerLine)
        );
        const excessLength = caption.length - maxCaptionCharactersBeforeShrink;
        adjustedFontSize = Math.max(
          baseFontSize - excessLength * fontScaleFactor,
          captionMinFontSize
        );
      }

      setFontSize(`${adjustedFontSize}px`);
    }
  }, [caption.length]);

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
            fill="white"
          >
            🌐
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
                className={
                  'main-letter__label main-letter__label--bottom-20 $main-letter__label-color--white'
                }
              >
                {capsLockActive.active ? 'capslock' : 'CAPSLOCK'}
              </span>
              <div className={'main-letter__label-color--white'}>&#xe803;</div>
            </div>
          </div>
        );
      case 'keyboardType':
        return (
          <>
            <div className="main-letter-space icon-keyboard-type-selected letter-keyboard-type">
              <div className="relative">
                <span className="main-letter__label main-letter__label--top-62 main-letter__label--rigth-46">
                  Special Characters
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
        <div ref={captionRef} className="circle-caption" style={{ fontSize }}>
          {caption.length > maxShownCharacters && (
            <span key="caption_abreviation">
              ... <br />
            </span>
          )}
          {caption
            .slice(Math.max(caption.length - maxShownCharacters, 0))
            .map((el, index) => (
              <>
                <span key={index} className={el === ' ' ? 'transparent' : ''}>
                  {el === ' ' ? '_' : el}
                </span>
              </>
            ))}
          {caption.length > 0 && caption.length < inputLimit && (
            <span className="blink">_</span>
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
                <g
                  transform={`rotate(${index * (keyboardType === KEYBOARD_TYPE.OnlyLetters ? ROTATE_VALUE_LETTERS : ROTATE_VALUE)})`}
                  key={index}
                >
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
