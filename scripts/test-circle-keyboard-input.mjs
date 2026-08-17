import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendKeyboardCharacter,
  DEFAULT_KEYBOARD_INPUT_LIMIT,
  KEYBOARD_PUNCTUATION,
  serializeKeyboardCaption
} from '../src/components/CircleKeyboard/input.ts';

test('caret remains in the displayed and submitted password', () => {
  const caption = appendKeyboardCharacter([...'Coffee123'], '^');

  assert.equal(caption.at(-1), '^');
  assert.equal(serializeKeyboardCaption(caption, false), 'Coffee123^');
});

test('every keyboard punctuation character survives an exact round trip', () => {
  let caption = [];
  for (const character of KEYBOARD_PUNCTUATION) {
    caption = appendKeyboardCharacter(caption, character);
  }

  assert.equal(
    serializeKeyboardCaption(caption, false),
    KEYBOARD_PUNCTUATION.join('')
  );
});

test('Wi-Fi serialization does not alter leading or trailing characters', () => {
  const caption = [...' ^Coffee123^ '];

  assert.equal(serializeKeyboardCaption(caption, false), ' ^Coffee123^ ');
  assert.equal(serializeKeyboardCaption(caption), '^Coffee123^');
});

test('input remains bounded at the machine keyboard limit', () => {
  const fullCaption = Array(DEFAULT_KEYBOARD_INPUT_LIMIT).fill('a');
  const result = appendKeyboardCharacter(fullCaption, '^');

  assert.deepEqual(result, fullCaption);
  assert.notEqual(result, fullCaption);
});
