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
  'à',
  'á',
  'â',
  'ã',
  'ä',
  'å',
  'æ',
  'ç',
  'è',
  'é',
  'ê',
  'ë',
  'ì',
  'í',
  'î',
  'ï',
  'ð',
  'ñ',
  'ò',
  'ó',
  'ô',
  'õ',
  'ö',
  'ß', // This is &#223 instead of the division sign ÷ which would be &#247;
  'ø',
  'ù',
  'ú',
  'û',
  'ü',
  'ÿ',
  'space',
  'ok',
  'backspace',
  'capslock',
  'keyboardType',
  'cancel'
];

export const CAPITAL_ACCENT_CHARACTERS = [
  'À',
  'Á',
  'Â',
  'Ã',
  'Ä',
  'Å',
  'Æ',
  'Ç',
  'È',
  'É',
  'Ê',
  'Ë',
  'Ì',
  'Í',
  'Î',
  'Ï',
  'Ð',
  'Ñ',
  'Ò',
  'Ó',
  'Ô',
  'Õ',
  'Ö',
  'ẞ', // This is &#223 instead of the multiplication sign × which would be &#215;
  'Ø',
  'Ù',
  'Ú',
  'Û',
  'Ü',
  'Ý',
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
