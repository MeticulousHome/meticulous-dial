export const FIRST_POSITION = 353;
export const LAST_KEY = 'cancel';

export enum KEYBOARD_TYPE {
  Default = 'DEFAULT',
  AccentCharacters = 'ACCENT',
  SpecialCharacters = 'SPECIAL'
}

//NOTE: We use ROTATE_VALUE x alphabet(items) to have x + JUMP_ROTATE = 360 degrees
export const ROTATE_VALUE = 7.25;
export const DEFAULT_ALPHABET = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  'space',
  'ok',
  'backspace',
  'capslock',
  'keyboardType',
  'cancel'
];

export const SMALL_ACCENT_CHARACTERS = [
  '&#224;',
  '&#225;',
  '&#226;',
  '&#227;',
  '&#228;',
  '&#229;',
  '&#230;',
  '&#231;',
  '&#232;',
  '&#233;',
  '&#234;',
  '&#235;',
  '&#236;',
  '&#237;',
  '&#238;',
  '&#239;',
  '&#240;',
  '&#241;',
  '&#242;',
  '&#243;',
  '&#244;',
  '&#245;',
  '&#246;',
  '&#247;',
  '&#248;',
  '&#249;',
  '&#250;',
  '&#251;',
  '&#252;',
  '&#255;',
  'space',
  'ok',
  'backspace',
  'capslock',
  'keyboardType',
  'cancel'
];

export const CAPITAL_ACCENT_CHARACTERS = [
  '&#192;',
  '&#193;',
  '&#194;',
  '&#195;',
  '&#196;',
  '&#197;',
  '&#198;',
  '&#199;',
  '&#200;',
  '&#201;',
  '&#202;',
  '&#203;',
  '&#204;',
  '&#205;',
  '&#206;',
  '&#207;',
  '&#208;',
  '&#209;',
  '&#210;',
  '&#211;',
  '&#212;',
  '&#213;',
  '&#214;',
  '&#215;',
  '&#216;',
  '&#217;',
  '&#218;',
  '&#219;',
  '&#220;',
  '&#221;',
  'space',
  'ok',
  'backspace',
  'capslock',
  'keyboardType',
  'cancel'
];

export const SPECIAL_CHARACTERS = [
  '-',
  '_',
  '!',
  '"',
  '#',
  '$',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '.',
  '/',
  ':',
  ';',
  '<',
  '=',
  '>',
  '?',
  '@',
  '[',
  ']',
  '^',
  '`',
  '{',
  '}',
  '|',
  '~',
  'space',
  'ok',
  'backspace',
  'keyboardType',
  'cancel'
];

export const CASE_ACCENT_TO_UPPERCASE_MAPPING: { [key: string]: string } = {};
SMALL_ACCENT_CHARACTERS.forEach((char, index) => {
  CASE_ACCENT_TO_UPPERCASE_MAPPING[char] = CAPITAL_ACCENT_CHARACTERS[index];
});

export const CASE_ACCENT_TO_LOWERCASE_MAPPING: { [key: string]: string } = {};
CAPITAL_ACCENT_CHARACTERS.forEach((char, index) => {
  CASE_ACCENT_TO_LOWERCASE_MAPPING[char] = SMALL_ACCENT_CHARACTERS[index];
});

// we filter empty string because they do not take up space.
export const getJumpRotate = (keyboardType: KEYBOARD_TYPE) => {
  const characters =
    keyboardType === KEYBOARD_TYPE.Default
      ? DEFAULT_ALPHABET
      : CAPITAL_ACCENT_CHARACTERS;
  return (
    360 -
    ROTATE_VALUE *
      characters.filter((alphabetItem) => alphabetItem.trim() !== '').length
  );
};

export const massageAlphabetWithMainChar = (
  alphabet: string[],
  index: number
) => {
  const newAlphabet = [...alphabet];
  newAlphabet.splice(index, 0, ' ');
  newAlphabet.splice(index + 2, 0, ' ');
  return newAlphabet;
};
