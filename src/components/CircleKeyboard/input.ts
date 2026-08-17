export const DEFAULT_KEYBOARD_INPUT_LIMIT = 64;

export const KEYBOARD_PUNCTUATION = [
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
  '~'
] as const;

export const appendKeyboardCharacter = (
  caption: readonly string[],
  character: string,
  inputLimit = DEFAULT_KEYBOARD_INPUT_LIMIT
): string[] => {
  if (caption.length >= inputLimit) return [...caption];
  return [...caption, character];
};

export const serializeKeyboardCaption = (
  caption: readonly string[],
  trimValue = true
): string => {
  const value = caption.join('');
  return trimValue ? value.trim() : value;
};
