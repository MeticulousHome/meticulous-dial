export const FIRST_POSITION = 353;
export const FIRST_KEY = 'a';
export const LAST_KEY = 'cancel';

//NOTE: We use ROTATE_VALUE x alphabet(items) to have x + JUMP_ROTATE = 360 degrees
export const ROTATE_VALUE = 7.25;
export const DEFAULT_ALPHABET = [
  ' ',
  'a',
  ' ',
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
  'cancel'
];

// we filter empty string because they do not take up space.
export const JUMP_ROTATE =
  360 -
  ROTATE_VALUE *
    DEFAULT_ALPHABET.filter((alphabetItem) => alphabetItem.trim() !== '')
      .length;
